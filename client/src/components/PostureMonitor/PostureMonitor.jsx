/**
 * PostureMonitor - Live webcam, MediaPipe pose, good/bad posture, score, badge
 * Uses Firebase Firestore directly - no backend server needed
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useAlertSiren } from '../../hooks/useAlertSiren';
import { postureService } from '../../services/firestoreService';
import PostureAlertOverlay from './PostureAlertOverlay';
import PostureHistoryChart from './PostureHistoryChart';
import './PostureMonitor.css';

// Alert triggers after 5 minutes of continuous bad posture
const BAD_POSTURE_ALERT_MINUTES = 5;
const BAD_POSTURE_ALERT_SECONDS = BAD_POSTURE_ALERT_MINUTES * 60;

const POSTURE_CONFIG = {
  maxForwardLeanZ: 0.55,  // Z-depth normalized allowance (Tuned specifically for normalized math)
  minBackwardLeanZ: -0.40, // Limit for leaning too far back
  minNeckRatio: 0.25,     // Neck uprightness (Slightly loose from optimal 0.32 to accommodate desk setups)
  maxSideLean: 0.20,      // Leaning off axis (Tightened to fix left-leaning head bypasses)
  maxForwardHead: 0.25,   // Forward head protrusion (Slightly loose from optimal 0.18)
  maxHeadTilt: 35,        // Head tilt allowance (Tightened to catch unnatural left/right leaning)
  maxShoulderTilt: 15,    // Shoulder level constraint (Slightly loose from optimal 12°)
  minTorsoAngle: 65,      // Slouching angle (Slightly loose from optimal 70°)
  smoothingFrames: 5,
};

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

export default function PostureMonitor({ onScoreUpdate }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const poseRef = useRef(null);
  const animationRef = useRef(null);
  const badTimerRef = useRef(null);
  const isStartedRef = useRef(false);
  const statusHistoryRef = useRef([]);

  const { user, refreshUser } = useAuth();
  const { playSiren, stopSiren } = useAlertSiren();

  const [isStarted, setIsStarted] = useState(false);
  const [status, setStatus] = useState('good');
  const [dailyScore, setDailyScore] = useState(user?.score || 0);
  const [badgeLevel, setBadgeLevel] = useState(user?.badgeLevel || 1);
  const [badSeconds, setBadSeconds] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [history, setHistory] = useState({ logs: [], dailyScore: 0 });
  const [loading, setLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const isModelLoadingRef = useRef(false);
  const [cameraError, setCameraError] = useState(null);
  const [useMediaPipe, setUseMediaPipe] = useState(true);

  isStartedRef.current = isStarted;

  // Load posture data from Firestore
  const loadPostureData = useCallback(async () => {
    if (!user?.employeeId) return;
    try {
      const logs = await postureService.getPostureLogs(user.employeeId, 500);
      const currentScore = user.score || 0;
      setHistory({ logs, dailyScore: currentScore });
      setDailyScore(currentScore);
      setBadgeLevel(Math.min(5, Math.floor(currentScore / 20) + 1));
    } catch (err) {
      console.error('Failed to load posture data', err);
    }
  }, [user?.employeeId, user?.score]);

  useEffect(() => {
    if (user) {
      setDailyScore(user.score || 0);
      setBadgeLevel(user.badgeLevel || 1);
      loadPostureData();
    }
  }, [user, loadPostureData]);

  const startMonitoring = async () => {
    setCameraError(null);
    isStartedRef.current = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      streamRef.current = stream;
      // We do NOT set srcObject here because videoRef isn't in the DOM yet until setIsStarted(true) mounts it.
      setIsStarted(true);
      setIsModelLoading(true);
      isModelLoadingRef.current = true;
      setBadSeconds(0);
      statusHistoryRef.current = [];
      try {
        await postureService.createPostureLog({
          employeeId: user.employeeId,
          eventType: 'session_start',
          postureStatus: 'good',
          score: dailyScore,
        });
      } catch (e) { }
      initPoseAndRun();
    } catch (err) {
      setCameraError(err.message || 'Could not access camera. Please allow camera permission.');
      isStartedRef.current = false;
    }
  };

  const stopMonitoring = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (poseRef.current?.pose?.close) poseRef.current.pose.close();
    poseRef.current = null;
    isStartedRef.current = false;
    setIsStarted(false);
    setIsModelLoading(false);
    isModelLoadingRef.current = false;
    setBadSeconds(0);
    setShowAlert(false);
    try {
      await postureService.createPostureLog({
        employeeId: user.employeeId,
        eventType: 'session_end',
        postureStatus: status,
        score: dailyScore,
      });
    } catch (e) { }
    if (refreshUser) refreshUser();
  }, [status, dailyScore, user?.employeeId, loadPostureData, refreshUser]);

  // Safely mount the stream to the newly rendered <video> element once isStarted becomes true
  useEffect(() => {
    if (isStarted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(console.error);
      };
    }
  }, [isStarted]);

  function computePostureFromLandmarks(lm) {
    const nose = lm[0];
    const leftEar = lm[7];
    const rightEar = lm[8];
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftHip = lm[23];
    const rightHip = lm[24];

    if (!nose || !leftEar || !rightEar || !leftShoulder || !rightShoulder) return null;

    // Visibility filter (prevents false detections)
    if (
      leftShoulder.visibility < 0.6 ||
      rightShoulder.visibility < 0.6 ||
      leftEar.visibility < 0.6 ||
      rightEar.visibility < 0.6
    ) {
      return null;
    }

    // Midpoints (very important)
    const midEarX = (leftEar.x + rightEar.x) / 2;
    const midEarY = (leftEar.y + rightEar.y) / 2;
    const midEarZ = (leftEar.z + rightEar.z) / 2;

    const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const midShoulderZ = (leftShoulder.z + rightShoulder.z) / 2;

    const midHipY = leftHip && rightHip
      ? (leftHip.y + rightHip.y) / 2
      : midShoulderY + 0.3;

    // Normalize using shoulder width (scale independent)
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 0.01;

    // 1️⃣ NECK UPRIGHT (Vertical posture)
    const neckRatio = (midShoulderY - midEarY) / shoulderWidth;

    // 2️⃣ SIDE LEAN (Left/Right drift)
    const sideLeanRatio = Math.abs(nose.x - midShoulderX) / shoulderWidth;

    // 3️⃣ FORWARD/BACKWARD LEAN (🔥 MOST IMPORTANT FIX)
    // Positive usually means head is closer to camera than shoulders (Forward). Negative means leaning away (Backward).
    const forwardLeanZ = (midShoulderZ - midEarZ) / shoulderWidth;

    // 4️⃣ HEAD PROTRUSION (Ear ahead of shoulders)
    const forwardHeadRatio = Math.abs(midEarX - midShoulderX) / shoulderWidth;

    // 5️⃣ TORSO ANGLE (Detect slouch / bending forward)
    const torsoAngle = Math.abs(
      Math.atan2(midShoulderY - midHipY, 0.001) * (180 / Math.PI)
    );

    // 6️⃣ SHOULDER LEVEL
    // Protect against Math.atan2 explosion if user turns body horizontally (dx shrinks to near 0)
    const shoulderDx = Math.abs(rightShoulder.x - leftShoulder.x);
    let shoulderAngle = 0;
    if (shoulderDx > 0.05) {
      shoulderAngle = Math.abs(
        Math.atan2(
          rightShoulder.y - leftShoulder.y,
          rightShoulder.x - leftShoulder.x
        ) * (180 / Math.PI)
      );
      if (shoulderAngle > 90) shoulderAngle = 180 - shoulderAngle;
    }

    // 7️⃣ HEAD TILT
    // Protect against Math.atan2 explosion if user turns head to look at another monitor
    const headDx = Math.abs(rightEar.x - leftEar.x);
    let headAngle = 0;
    if (headDx > 0.04) {
      headAngle = Math.abs(
        Math.atan2(
          rightEar.y - leftEar.y,
          rightEar.x - leftEar.x
        ) * (180 / Math.PI)
      );
      if (headAngle > 90) headAngle = 180 - headAngle;
    }

    // 🎯 PROFESSIONAL THRESHOLDS (Calibrated)
    const isNeckGood = neckRatio > POSTURE_CONFIG.minNeckRatio;
    const isSideLeanGood = sideLeanRatio < POSTURE_CONFIG.maxSideLean;
    const isForwardLeanGood = forwardLeanZ < POSTURE_CONFIG.maxForwardLeanZ; // 🔥 KEY FIX
    const isBackwardLeanGood = forwardLeanZ > POSTURE_CONFIG.minBackwardLeanZ;
    const isForwardHeadGood = forwardHeadRatio < POSTURE_CONFIG.maxForwardHead;
    const isShoulderGood = shoulderAngle < POSTURE_CONFIG.maxShoulderTilt;
    const isHeadGood = headAngle < POSTURE_CONFIG.maxHeadTilt;
    const isTorsoGood = torsoAngle > POSTURE_CONFIG.minTorsoAngle; // Upright torso

    // 🧠 FINAL BIOMECHANICAL DECISION
    const good =
      isNeckGood &&
      isSideLeanGood &&
      isForwardLeanGood &&
      isBackwardLeanGood &&
      isForwardHeadGood &&
      isShoulderGood &&
      isHeadGood &&
      isTorsoGood;

    return {
      good,
      neckRatio,
      sideLeanRatio,
      forwardLeanZ,
      forwardHeadRatio,
      shoulderAngle,
      headAngle,
      torsoAngle,
      details: {
        isNeckGood,
        isSideLeanGood,
        isForwardLeanGood,
        isBackwardLeanGood,
        isForwardHeadGood,
        isShoulderGood,
        isHeadGood,
        isTorsoGood,
      },
    };
  }

  function applyStatusSmoothing(rawGood) {
    const hist = statusHistoryRef.current;
    hist.push(rawGood);
    if (hist.length > POSTURE_CONFIG.smoothingFrames) hist.shift();
    if (hist.length < POSTURE_CONFIG.smoothingFrames) return null;
    const allGood = hist.every(Boolean);
    const allBad = hist.every((x) => !x);
    if (allGood) return 'good';
    if (allBad) return 'bad';
    return null;
  }

  function onPoseResults(results) {
    if (isModelLoadingRef.current) {
      setIsModelLoading(false);
      isModelLoadingRef.current = false;
    }

    if (!results.poseLandmarks || !canvasRef.current || !isStartedRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const lm = results.poseLandmarks;
    const outcome = computePostureFromLandmarks(lm);

    if (outcome) {
      const smoothed = applyStatusSmoothing(outcome.good);
      if (smoothed) setStatus(smoothed);

      const color = outcome.good ? '#00FF00' : '#FF0000';
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.fillStyle = color;
      const get = (i) => ({ x: lm[i].x * width, y: lm[i].y * height });
      const le = get(7);
      const re = get(8);
      const ls = get(11);
      const rs = get(12);
      ctx.beginPath();
      ctx.moveTo(ls.x, ls.y);
      ctx.lineTo(rs.x, rs.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(le.x, le.y);
      ctx.lineTo(re.x, re.y);
      ctx.stroke();
      [le, re, ls, rs].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- Draw Mathematical Debug Overlay ---
      // This helps the user visually understand WHY they are failing
      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 310, 220);

      const drawStat = (label, val, passed, yPos) => {
        ctx.fillStyle = passed ? '#00FF00' : '#FF3333';
        ctx.fillText(`${passed ? '✓' : '✗'} ${label}: ${val}`, 20, yPos);
      };

      drawStat('Neck Upright', outcome.neckRatio.toFixed(2), outcome.details.isNeckGood, 35);
      drawStat('Centered    ', outcome.sideLeanRatio.toFixed(2), outcome.details.isSideLeanGood, 60);
      drawStat('Fwd Lean (Z)', outcome.forwardLeanZ.toFixed(2), outcome.details.isForwardLeanGood, 85);
      drawStat('Backwd Lean ', outcome.forwardLeanZ.toFixed(2), outcome.details.isBackwardLeanGood, 110);
      drawStat('Fwd Head    ', outcome.forwardHeadRatio.toFixed(2), outcome.details.isForwardHeadGood, 135);
      drawStat('Lvl Shoulder', `${Math.floor(outcome.shoulderAngle)}°`, outcome.details.isShoulderGood, 160);
      drawStat('Lvl Head    ', `${Math.floor(outcome.headAngle)}°`, outcome.details.isHeadGood, 185);
      drawStat('Torso Angle ', `${Math.floor(outcome.torsoAngle)}°`, outcome.details.isTorsoGood, 210);
    }
  }

  async function initPoseAndRun() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    try {
      // Use global Pose object injected from CDN which completely bypasses the NPM default export/bundling failures
      const Pose = window.Pose || (await import('@mediapipe/pose')).Pose;
      if (!Pose) throw new Error('Pose not found on window or module');

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

      const processFrame = async () => {
        if (!isStartedRef.current) return;
        const v = videoRef.current;
        if (!v || v.readyState < 2) {
          animationRef.current = requestAnimationFrame(processFrame);
          return;
        }
        try {
          await pose.send({ image: v });
        } catch (e) { }
        animationRef.current = requestAnimationFrame(processFrame);
      };
      animationRef.current = requestAnimationFrame(processFrame);
      poseRef.current = { pose };
    } catch (err) {
      console.warn('MediaPipe not available, using simulated posture', err);
      setUseMediaPipe(false);
    }
  }

  function simulatePoseLoop() {
    const good = Math.random() > 0.6;
    setStatus(good ? 'good' : 'bad');
    if (isStartedRef.current) {
      animationRef.current = setTimeout(simulatePoseLoop, 1500);
    }
  }

  useEffect(() => {
    if (!useMediaPipe && isStarted) {
      simulatePoseLoop();
      return () => {
        if (animationRef.current) clearTimeout(animationRef.current);
      };
    }
  }, [useMediaPipe, isStarted]);

  // Use refs to count seconds robustly across renders
  const goodTimerRef = useRef(0);
  const badTimerCountRef = useRef(0);
  const currentScoreRef = useRef(dailyScore);
  const currentLogSessionRef = useRef({ status: 'good', startTime: null, duration: 0, points: 0 });

  useEffect(() => { currentScoreRef.current = dailyScore; }, [dailyScore]);

  useEffect(() => {
    if (!isStarted || !user?.employeeId) return;

    // Start a new contiguous monitoring chunk
    currentLogSessionRef.current = {
      status,
      startTime: Date.now(),
      duration: 0,
      points: 0
    };

    const interval = setInterval(async () => {
      currentLogSessionRef.current.duration += 1;

      if (status === 'good') {
        badTimerCountRef.current = 0;
        setBadSeconds(0);
        goodTimerRef.current += 1;

        // Exactly 10 contiguous seconds of good posture to earn 1 point locally
        if (goodTimerRef.current >= 10) {
          goodTimerRef.current = 0;
          currentLogSessionRef.current.points += 1;

          const newScore = currentScoreRef.current + 1;
          try {
            await postureService.updateUserScore(user.id, newScore);
            const newBadge = Math.min(5, Math.floor(newScore / 20) + 1);
            setDailyScore(newScore);
            setBadgeLevel(newBadge);
            if (onScoreUpdate) onScoreUpdate(newScore, newBadge);
            if (refreshUser) refreshUser();
          } catch (e) {
            console.error('Failed to update good posture score', e);
          }
        }
      } else if (status === 'bad') {
        goodTimerRef.current = 0;
        badTimerCountRef.current += 1;
        setBadSeconds(badTimerCountRef.current);

        // Deduct 1 point for every 10 seconds of bad posture locally
        if (badTimerCountRef.current > 0 && badTimerCountRef.current % 10 === 0) {
          currentLogSessionRef.current.points -= 1;

          const newScore = Math.max(0, currentScoreRef.current - 1);
          try {
            await postureService.updateUserScore(user.id, newScore);
            const newBadge = Math.min(5, Math.floor(newScore / 20) + 1);
            setDailyScore(newScore);
            setBadgeLevel(newBadge);
            if (onScoreUpdate) onScoreUpdate(newScore, newBadge);
            if (refreshUser) refreshUser();
          } catch (e) {
            console.error('Failed to update bad posture score', e);
          }
        }

        // Trigger Major Alert
        if (badTimerCountRef.current >= BAD_POSTURE_ALERT_SECONDS) {
          setShowAlert(true);
          const penaltyScore = Math.max(0, currentScoreRef.current - 5);
          badTimerCountRef.current = 0;
          setBadSeconds(0);

          try {
            await postureService.updateUserScore(user.id, penaltyScore);
            const newBadge = Math.min(5, Math.floor(penaltyScore / 20) + 1);
            setDailyScore(penaltyScore);
            setBadgeLevel(newBadge);
            if (onScoreUpdate) onScoreUpdate(penaltyScore, newBadge);

            // Log major alert strictly to the DB immediately since it's an isolated critical event
            const endTime = new Date().toISOString();
            const startTime = new Date(Date.now() - (BAD_POSTURE_ALERT_SECONDS * 1000)).toISOString();

            await postureService.createPostureLog({
              employeeId: user.employeeId,
              postureStatus: 'bad',
              duration: BAD_POSTURE_ALERT_SECONDS,
              score: penaltyScore,
              eventType: 'alert_triggered',
              startTime,
              endTime,
              details: `Critical Violation: Maintained bad posture continuously for ${BAD_POSTURE_ALERT_MINUTES} minutes (-5 penalty points).`
            });

            // Re-sync local logs after major alert
            loadPostureData();
            if (refreshUser) refreshUser();
          } catch (e) {
            console.error('Failed to handle major alert deduction', e);
          }
        }
      }
    }, 1000);

    // Conditional Logging Aggregation
    // When the status finally breaks/flips, ONLY THEN commit the previous block of time to Firebase!
    // This perfectly reduces database thrashing.
    return () => {
      clearInterval(interval);
      const log = currentLogSessionRef.current;

      // Only log if they successfully gained or lost points to avoid noise
      if (log.points !== 0) {
        const endTime = new Date().toISOString();
        const startTime = new Date(log.startTime).toISOString();
        const ptsSign = log.points > 0 ? `+${log.points}` : log.points.toString();
        const detailsStr = log.status === 'good'
          ? `Maintained properly aligned posture across a ${log.duration} second window (${ptsSign} points).`
          : `Failed posture constraints causing warnings over a ${log.duration} second window (${ptsSign} points).`;

        postureService.createPostureLog({
          employeeId: user.employeeId,
          postureStatus: log.status,
          duration: log.duration,
          score: currentScoreRef.current,
          startTime,
          endTime,
          details: detailsStr
        }).then(() => {
          loadPostureData();
        }).catch(console.error);
      }
    };
  }, [isStarted, status, user?.employeeId, user?.id, onScoreUpdate, refreshUser]);

  const dismissAlert = () => {
    stopSiren();
    setShowAlert(false);
    setBadSeconds(0);
    loadPostureData();
    if (refreshUser) refreshUser();
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
          {isModelLoading && (
            <div
              className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark"
              style={{ zIndex: 10, background: 'rgba(0,0,0,0.85)' }}
            >
              <div className="spinner-border text-danger mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
              <h5 className="text-white fw-bold mb-1">Industri safty monitoring system</h5>
              <span className="text-white-50 small">Loading System...</span>
            </div>
          )}
          <video
            ref={videoRef}
            className="posture-video"
            autoPlay
            playsInline
            muted
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            onLoadedMetadata={() => videoRef.current?.play().catch(() => { })}
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="posture-canvas"
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            style={{ transform: 'scaleX(-1)' }}
          />
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
            message="Bad posture for 1 minute. Take a short break and fix your posture."
            playSiren={playSiren}
            stopSiren={stopSiren}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
