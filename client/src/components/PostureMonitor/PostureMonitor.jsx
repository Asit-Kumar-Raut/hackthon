/**
 * PostureMonitor - Live webcam, MediaPipe pose, good/bad posture, score, badge
 * Start/End: monitoring runs only when started; employee must click End to stop
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAlertSiren } from '../../hooks/useAlertSiren';
import PostureAlertOverlay from './PostureAlertOverlay';
import PostureHistoryChart from './PostureHistoryChart';
import './PostureMonitor.css';
const { Pose } = await import('@mediapipe/pose');
// After 1 minute of continuous bad posture, show blocking blur alert
const BAD_POSTURE_ALERT_MINUTES = 1;
const BAD_POSTURE_ALERT_SECONDS = BAD_POSTURE_ALERT_MINUTES * 60;

export default function PostureMonitor() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const animationRef = useRef(null);
  const { user } = useAuth();
  const { playSiren, stopSiren } = useAlertSiren();

  const [isStarted, setIsStarted] = useState(false);
  const [status, setStatus] = useState('good'); // good | bad
  const [dailyScore, setDailyScore] = useState(0);
  const [badgeLevel, setBadgeLevel] = useState(1);
  const [badSeconds, setBadSeconds] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [history, setHistory] = useState({ logs: [], dailyScore: 0 });
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [useMediaPipe, setUseMediaPipe] = useState(true);

  const badTimerRef = useRef(null);
  const isStartedRef = useRef(false);
  isStartedRef.current = isStarted;

  // Load posture data from API
  const loadPostureData = useCallback(async () => {
    if (!user?.employeeId) return;
    try {
      const res = await api.get('/api/posture/data');
      setHistory({ logs: res.data.logs || [], dailyScore: res.data.dailyScore ?? 0 });
      setDailyScore(res.data.dailyScore ?? 0);
      setBadgeLevel(Math.min(5, Math.floor((res.data.dailyScore ?? 0) / 20) + 1));
    } catch (err) {
      console.error('Failed to load posture data', err);
    }
  }, [user?.employeeId]);

  useEffect(() => {
    loadPostureData();
  }, [loadPostureData]);

  // Start camera and pose detection
  const startMonitoring = async () => {
    setCameraError(null);
    isStartedRef.current = true;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video play() failed, will rely on autoPlay/onLoadedMetadata', playErr);
        }
      }
      setIsStarted(true);
      setBadSeconds(0);
      // Log session start
      try {
        await api.post('/api/posture/log', { eventType: 'session_start', postureStatus: 'good', score: dailyScore });
      } catch (e) {}
      initPoseAndRun();
    } catch (err) {
      setCameraError('Could not access camera. Please allow camera permission.');
      console.error(err);
    }
  };

  const stopMonitoring = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (poseRef.current?.pose?.close) poseRef.current.pose.close();
    isStartedRef.current = false;
    setIsStarted(false);
    setBadSeconds(0);
    setShowAlert(false);
    try {
      await api.post('/api/posture/log', { eventType: 'session_end', postureStatus: status, score: dailyScore });
    } catch (e) {}
    loadPostureData();
  };

  async function initPoseAndRun() {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      const { Pose } = await import('@mediapipe/pose');
      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      pose.onResults((results) => onPoseResults(results));
      let lastTime = 0;
      const processFrame = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || !isStartedRef.current) return;
        try {
          await pose.send({ image: videoRef.current });
        } catch (e) {}
        if (isStartedRef.current) animationRef.current = requestAnimationFrame(processFrame);
      };
      animationRef.current = requestAnimationFrame(processFrame);
      poseRef.current = { pose };
    } catch (err) {
      console.warn('MediaPipe not available, using simulated posture', err);
      setUseMediaPipe(false);
    }
  }

  function onPoseResults(results) {
    if (!results.poseLandmarks || !canvasRef.current || !isStarted) return;
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    ctx.clearRect(0, 0, width, height);

    const lm = results.poseLandmarks;
    const get = (i) => ({ x: lm[i].x * width, y: lm[i].y * height });

    const leftEar = lm[7];
    const rightEar = lm[8];
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];

    if (leftEar && rightEar && leftShoulder && rightShoulder) {
      const earY = (leftEar.y + rightEar.y) / 2;
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const earX = (leftEar.x + rightEar.x) / 2;
      const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;

      const tilt = Math.abs(earX - shoulderX);
      const slouch = earY - shoulderY;

      // Extremely strict "good" zone:
      // - Head almost perfectly above shoulders (very small horizontal offset)
      // - Ears almost level with shoulders (very small vertical offset)
      //
      // This means that a relaxed / slightly slouched pose like in your photo
      // will be classified as BAD, and only a very upright pose will be GOOD.
      const good =
        tilt < 0.03 && // almost no sideways tilt
        slouch > -0.01 && // not leaning back
        slouch < 0.03; // not leaning forward

      setStatus(good ? 'good' : 'bad');

      // Simple skeleton overlay so user can clearly see detection
      const color = good ? '#00FF00' : '#FF0000';
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.fillStyle = color;

      const le = get(7);
      const re = get(8);
      const ls = get(11);
      const rs = get(12);

      // Draw shoulders line
      ctx.beginPath();
      ctx.moveTo(ls.x, ls.y);
      ctx.lineTo(rs.x, rs.y);
      ctx.stroke();

      // Draw ears line
      ctx.beginPath();
      ctx.moveTo(le.x, le.y);
      ctx.lineTo(re.x, re.y);
      ctx.stroke();

      // Draw joints as more visible circles
      [le, re, ls, rs].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function simulatePoseLoop() {
    // In fallback mode, be stricter so that posture is often flagged as bad
    const good = Math.random() > 0.7;
    setStatus(good ? 'good' : 'bad');
    animationRef.current = setTimeout(simulatePoseLoop, 1500);
  }

  useEffect(() => {
    if (!useMediaPipe && isStarted) {
      simulatePoseLoop();
      return () => {
        if (animationRef.current) clearTimeout(animationRef.current);
      };
    }
  }, [useMediaPipe, isStarted]);

  // Bad posture timer and score updates
  useEffect(() => {
    if (!isStarted) return;
    if (status === 'bad') {
      badTimerRef.current = setInterval(() => {
        setBadSeconds((prev) => {
          const next = prev + 1;
          if (next >= BAD_POSTURE_ALERT_SECONDS) {
            setShowAlert(true);
            api.post('/api/posture/log', {
              postureStatus: 'bad',
              duration: BAD_POSTURE_ALERT_SECONDS,
              // treat alert as a penalty on score
              score: Math.max(0, dailyScore - 5),
              eventType: 'alert_triggered',
            });
            loadPostureData();
          }
          return next;
        });
      }, 1000);
    } else {
      if (badTimerRef.current) clearInterval(badTimerRef.current);
      setBadSeconds(0);
    }
    return () => {
      if (badTimerRef.current) clearInterval(badTimerRef.current);
    };
  }, [isStarted, status, dailyScore, loadPostureData]);

  // Log and update score periodically
  useEffect(() => {
    if (!isStarted || !user?.employeeId) return;
    const interval = setInterval(async () => {
      try {
        if (status === 'good') {
          const newScore = dailyScore + 1;
          setDailyScore(newScore);
          setBadgeLevel(Math.min(5, Math.floor(newScore / 20) + 1));
          await api.post('/api/posture/log', { postureStatus: 'good', duration: 0, score: newScore });
        } else {
          const newScore = Math.max(0, dailyScore - 1);
          setDailyScore(newScore);
          await api.post('/api/posture/log', { postureStatus: 'bad', duration: 1, score: newScore });
        }
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [isStarted, status, user?.employeeId, dailyScore]);

  const dismissAlert = () => {
    stopSiren();
    setShowAlert(false);
    setBadSeconds(0);
    loadPostureData();
  };

  return (
    <motion.div
      className="posture-monitor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="posture-controls mb-3 d-flex gap-2 flex-wrap justify-content-center">
        {!isStarted ? (
          <motion.button
            type="button"
            className="btn-outline-red"
            onClick={startMonitoring}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Start Monitoring
          </motion.button>
        ) : (
          <motion.button
            type="button"
            className="btn-outline-red btn-danger-soft"
            onClick={stopMonitoring}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            End Monitoring
          </motion.button>
        )}
      </div>

      {cameraError && <div className="text-danger mb-2">{cameraError}</div>}

      {isStarted && (
        <div className="posture-feed mb-3 position-relative">
          <video
            ref={videoRef}
            className="posture-video"
            controls
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(() => {});
              }
            }}
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="posture-canvas" width={640} height={480} />
          <div className={`posture-status-badge ${status}`}>
            {status === 'good' ? 'Good Posture' : 'Bad Posture'}
            {status === 'bad' && badSeconds > 0 && (
              <span className="ms-2">({Math.floor(badSeconds / 60)}m)</span>
            )}
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <motion.div className="col-md-4" whileHover={{ scale: 1.02 }}>
          <div className="dashboard-card text-center">
            <div className="text-muted small">Daily Score</div>
            <div className="display-6 text-white">{dailyScore}</div>
          </div>
        </motion.div>
        <motion.div className="col-md-4" whileHover={{ scale: 1.02 }}>
          <div className="dashboard-card text-center">
            <div className="text-muted small">Badge Level</div>
            <div className="display-6 text-warning">Level {badgeLevel}</div>
          </div>
        </motion.div>
        <motion.div className="col-md-4" whileHover={{ scale: 1.02 }}>
          <div className="dashboard-card text-center">
            <div className="text-muted small">Current Status</div>
            <div className={`display-6 ${status === 'good' ? 'text-success' : 'text-danger'}`}>
              {isStarted ? (status === 'good' ? 'Good' : 'Bad') : '—'}
            </div>
          </div>
        </motion.div>
      </div>

      <PostureHistoryChart logs={history.logs} />

      <AnimatePresence>
        {showAlert && (
          <PostureAlertOverlay
            onDismiss={dismissAlert}
            // short, strong message in center of the screen
            message="Bad posture for 1 minute. Take a short break and fix your posture."
            playSiren={playSiren}
            stopSiren={stopSiren}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
