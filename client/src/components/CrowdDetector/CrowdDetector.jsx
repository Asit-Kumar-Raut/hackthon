/**
 * CrowdDetector - Live camera + person detection (YOLO Python / TensorFlow.js COCO-SSD / simulated)
 * Restricted area violation, crowd count, alert siren, red banner, log to API
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useAlertSiren } from '../../hooks/useAlertSiren';
import { crowdService } from '../../services/firestoreService';
import './CrowdDetector.css';

const RESTRICTED_THRESHOLD = 2; // Changed from 7 to match "increased from 2"
const DETECTION_INTERVAL_MS = 1500;
const MIN_CONFIDENCE = 0.5;
const SUSTAINED_FRAMES_FOR_VIOLATION = 3; // consecutive high-crowd frames before violation
const LOG_THROTTLE_MS = 5000; // don't log to API more than once per 5s unless count/violation changes

const DETECTOR_ENDPOINT = '/detector/detect';
const DETECTOR_HEALTH = '/detector/health';

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;

export default function CrowdDetector({ onAlert, onLog }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const intervalRef = useRef(null);
  const lastLogRef = useRef({ time: 0, count: -1, violation: false });
  const zoneStatesRef = useRef({
    1: { startTime: null, status: 'SAFE', count: 0 },
    2: { startTime: null, status: 'SAFE', count: 0 },
    3: { startTime: null, status: 'SAFE', count: 0 },
    4: { startTime: null, status: 'SAFE', count: 0 },
  });

  const { user } = useAuth();
  const { playSiren, stopSiren } = useAlertSiren();

  const [isStarted, setIsStarted] = useState(false);
  const [crowdCount, setCrowdCount] = useState(0);
  const [restrictedViolation, setRestrictedViolation] = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [detectionMode, setDetectionMode] = useState('yolo');
  const [detectorHealthy, setDetectorHealthy] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const loadModel = useCallback(async () => {
    if (modelRef.current) return true;
    try {
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      modelRef.current = model;
      setModelLoaded(true);
      return true;
    } catch (err) {
      console.warn('COCO-SSD load failed, using simulated detection:', err);
      setModelLoaded(false);
      setDetectionMode('simulate');
      return false;
    }
  }, []);

  const checkPythonDetector = useCallback(async () => {
    try {
      const res = await fetch(DETECTOR_HEALTH, { method: 'GET' });
      if (!res.ok) throw new Error('Detector not ok');
      setDetectorHealthy(true);
      return true;
    } catch (e) {
      setDetectorHealthy(false);
      return false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API not available in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
          facingMode: 'environment',
        },
        audio: false,
      });
      streamRef.current = stream;
      streamRef.current = stream;
      // We do NOT set srcObject here because videoRef isn't in the DOM yet until setIsStarted(true) mounts it.
      setIsStarted(true);
      setIsModelLoading(true);

      const detectorOk = await checkPythonDetector();
      if (detectorOk) {
        setDetectionMode('yolo');
      } else {
        const loaded = await loadModel();
        setDetectionMode(loaded ? 'tfjs' : 'simulate');
      }

      setIsModelLoading(false);
      Object.keys(zoneStatesRef.current).forEach(z => {
        zoneStatesRef.current[z] = { startTime: null, status: 'SAFE', count: 0 };
      });
      setAlertTriggered(false);
      setRestrictedViolation(false);
    } catch (err) {
      setCameraError(err.message || 'Could not access camera.');
    }
  }, [checkPythonDetector, loadModel]);

  const stopCamera = useCallback(() => {
    stopSiren();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStarted(false);
    setIsModelLoading(false);
    setCrowdCount(0);
    setRestrictedViolation(false);
    setAlertTriggered(false);
  }, [stopSiren]);

  // Safely mount the stream to the newly rendered <video> element once isStarted becomes true
  useEffect(() => {
    if (isStarted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(console.error);
      };
    }
  }, [isStarted]);

  const captureFrameDataUrl = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth || VIDEO_WIDTH;
    tmp.height = video.videoHeight || VIDEO_HEIGHT;
    const ctx = tmp.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, tmp.width, tmp.height);
    return tmp.toDataURL('image/jpeg', 0.75);
  }, []);

  const runPythonYoloDetection = useCallback(async () => {
    const image = captureFrameDataUrl();
    if (!image) throw new Error('No frame');
    const res = await fetch(DETECTOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Detector error');
    return data;
  }, [captureFrameDataUrl]);

  const drawBoxes = useCallback((boxes, isMirrored = true, sourceWidth = null, sourceHeight = null) => {
    const canvas = canvasRef.current;
    if (!canvas) return { playAlarm: false, hasViolation: false };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const scaleX = sourceWidth && sourceWidth !== w ? w / sourceWidth : 1;
    const scaleY = sourceHeight && sourceHeight !== h ? h / sourceHeight : 1;

    ctx.clearRect(0, 0, w, h);

    // 1. Calculate Zone Counts
    const zoneCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const scaledBoxes = (boxes || []).map(b => {
      let [x, y, bw, bh] = b.bbox;
      x *= scaleX; y *= scaleY; bw *= scaleX; bh *= scaleY;
      if (isMirrored) x = w - x - bw;

      const cx = x + bw / 2;
      const cy = y + bh / 2;

      let zone = 1;
      if (cx < w / 2) {
        zone = cy < h / 2 ? 1 : 3;
      } else {
        zone = cy < h / 2 ? 2 : 4;
      }
      zoneCounts[zone]++;

      return { ...b, x, y, bw, bh, cx, cy, zone };
    });

    // 2. State & Escalation Logic
    const now = Date.now();
    let playAlarm = false;
    let hasViolation = false;
    const zoneStates = zoneStatesRef.current;

    const zoneColors = {
      'SAFE': 'rgba(0, 255, 0, 0.25)',
      'WARNING': 'rgba(255, 255, 0, 0.35)',
      'RED ALERT': 'rgba(255, 0, 0, 0.45)',
    };
    const textColors = {
      'SAFE': '#00FF00',
      'WARNING': '#FFFF00',
      'RED ALERT': '#FF0000',
    };

    for (let z = 1; z <= 4; z++) {
      const count = zoneCounts[z];
      let state = zoneStates[z];
      state.count = count;

      if (count >= 2) {
        if (!state.startTime) state.startTime = now;
        const elapsedSec = (now - state.startTime) / 1000;

        if (elapsedSec >= 5) {
          state.status = 'RED ALERT';
          playAlarm = true;
          hasViolation = true;
        } else if (elapsedSec >= 3) {
          state.status = 'RED ALERT';
          hasViolation = true;
        } else {
          state.status = 'WARNING';
        }
      } else {
        state.startTime = null;
        state.status = 'SAFE';
      }
    }

    // 3. Draw Zone Backgrounds & Texts
    const halfW = w / 2;
    const halfH = h / 2;
    const zoneRects = {
      1: [0, 0, halfW, halfH],
      2: [halfW, 0, halfW, halfH],
      3: [0, halfH, halfW, halfH],
      4: [halfW, halfH, halfW, halfH]
    };

    for (let z = 1; z <= 4; z++) {
      const [zx, zy, zw, zh] = zoneRects[z];
      const status = zoneStates[z].status;

      ctx.fillStyle = zoneColors[status];
      ctx.fillRect(zx, zy, zw, zh);

      ctx.fillStyle = textColors[status];
      ctx.font = 'bold 18px sans-serif';
      const textX = zx + 10;
      const textY = zy + 30;
      ctx.fillText(`Zone ${z}`, textX, textY);
      ctx.font = '16px sans-serif';
      ctx.fillText(`Count: ${zoneStates[z].count}`, textX, textY + 25);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(status, textX, textY + 50);
    }

    // 4. Draw Grid Lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(halfW, 0); ctx.lineTo(halfW, h);
    ctx.moveTo(0, halfH); ctx.lineTo(w, halfH);
    ctx.stroke();

    // 5. Draw Boxes
    scaledBoxes.forEach(b => {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.bw, b.bh);
      ctx.fillStyle = '#FF0000';
      ctx.font = '14px sans-serif';
      const pct = (b.confidence ?? b.score ?? 0) * 100;
      ctx.fillText(`person ${pct.toFixed(0)}%`, b.x, Math.max(14, b.y - 4));

      ctx.beginPath();
      ctx.arc(b.cx, b.cy, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    return { playAlarm, hasViolation };
  }, []);

  const runDetection = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    let count = 0;
    let hasZoneViolation = false;
    let playZoneAlarm = false;

    if (detectionMode === 'yolo') {
      try {
        const data = await runPythonYoloDetection();
        count = data.count ?? 0;
        const res = drawBoxes(
          (data.boxes || []).map((b) => ({ ...b, confidence: b.confidence })),
          true,
          data.width,
          data.height
        );
        hasZoneViolation = res.hasViolation;
        playZoneAlarm = res.playAlarm;
      } catch (e) {
        setDetectorHealthy(false);
        if (modelRef.current) {
          try {
            const predictions = await modelRef.current.detect(video, undefined, MIN_CONFIDENCE);
            count = predictions.filter((p) => p.class === 'person').length;
            const res = drawBoxes(predictions.filter((p) => p.class === 'person').map((p) => ({ bbox: p.bbox, confidence: p.score })), true);
            hasZoneViolation = res.hasViolation;
            playZoneAlarm = res.playAlarm;
            setDetectionMode('tfjs');
          } catch (_) {
            count = Math.min(9, Math.floor(Math.random() * 5));
            setDetectionMode('simulate');
          }
        } else {
          count = Math.min(9, Math.floor(Math.random() * 5));
          setDetectionMode('simulate');
        }
      }
    } else if (detectionMode === 'tfjs' && modelRef.current) {
      try {
        const predictions = await modelRef.current.detect(video, undefined, MIN_CONFIDENCE);
        const person = predictions.filter((p) => p.class === 'person');
        count = person.length;
        const res = drawBoxes(person.map((p) => ({ bbox: p.bbox, confidence: p.score })), true);
        hasZoneViolation = res.hasViolation;
        playZoneAlarm = res.playAlarm;
      } catch (e) {
        count = Math.min(9, Math.floor(Math.random() * 5));
      }
    } else {
      count = Math.min(9, Math.floor(Math.random() * 5));
    }

    setCrowdCount(count);

    const sustainedViolation = hasZoneViolation;
    setRestrictedViolation(sustainedViolation);

    if (playZoneAlarm) {
      if (!alertTriggered) {
        setAlertTriggered(true);
        playSiren(10000);
      }
    } else {
      if (alertTriggered) {
        setAlertTriggered(false);
        stopSiren();
      }
    }

    const now = Date.now();
    const last = lastLogRef.current;
    const shouldLog =
      now - last.time >= LOG_THROTTLE_MS ||
      last.count !== count ||
      last.violation !== sustainedViolation;

    if (shouldLog && user?.employeeId && count > 2) {
      lastLogRef.current = { time: now, count, violation: sustainedViolation };
      try {
        await crowdService.createCrowdLog({
          detectedCount: count,
          restrictedViolation: sustainedViolation,
          recordedBy: user.employeeId,
        });
        // Pass live data to parent
        onLog?.({ count, violation: sustainedViolation });
        if (sustainedViolation) onAlert?.({ count, violation: sustainedViolation });
      } catch (e) {
        console.error('Failed to log crowd event:', e);
      }
    }
  }, [
    detectionMode,
    user?.employeeId,
    onLog,
    onAlert,
    playSiren,
    alertTriggered,
    runPythonYoloDetection,
    drawBoxes,
  ]);

  useEffect(() => {
    if (!isStarted) return;
    runDetection();
    intervalRef.current = setInterval(runDetection, DETECTION_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStarted, runDetection]);

  return (
    <motion.div
      className="crowd-detector"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="crowd-controls mb-3 d-flex align-items-center gap-2 flex-wrap">
        {!isStarted ? (
          <motion.button
            type="button"
            className="btn-outline-red"
            onClick={startCamera}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Start Camera (Crowd Detection)
          </motion.button>
        ) : (
          <>
            <motion.button
              type="button"
              className="btn-outline-red btn-danger-soft"
              onClick={stopCamera}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Stop Camera
            </motion.button>
            <span className="text-white-50 small">
              {detectionMode === 'yolo'
                ? detectorHealthy === false
                  ? 'YOLO offline (fallback)'
                  : 'OpenCV + YOLO'
                : modelLoaded
                  ? 'TensorFlow.js COCO-SSD'
                  : 'Simulated'}
            </span>
          </>
        )}
      </div>

      {cameraError && <div className="text-danger mb-2">{cameraError}</div>}

      {isStarted && (
        <>
          <div className="crowd-feed position-relative mb-3">
            {isModelLoading && (
              <div
                className="position-absolute w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark"
                style={{ zIndex: 10, background: 'rgba(0,0,0,0.85)' }}
              >
                <div className="spinner-border text-danger mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                <h5 className="text-white fw-bold mb-1">Industri safty monitoring system</h5>
                <span className="text-white-50 small">Connecting to monitoring service...</span>
              </div>
            )}
            <video
              ref={videoRef}
              className="crowd-video"
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
              className="crowd-canvas"
              width={VIDEO_WIDTH}
              height={VIDEO_HEIGHT}
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="crowd-count-badge">
              Crowd: <strong>{crowdCount}</strong>
            </div>
            {(restrictedViolation || alertTriggered) && (
              <div className="crowd-alert-badge">
                Restricted Area Violation — Siren Active
              </div>
            )}
          </div>
          <div className="row g-3">
            <motion.div className="col-md-6" whileHover={{ scale: 1.02 }}>
              <div className="dashboard-card text-center">
                <div className="text-muted small">Current Count</div>
                <div className="display-5 text-white">{crowdCount}</div>
              </div>
            </motion.div>
            <motion.div className="col-md-6" whileHover={{ scale: 1.02 }}>
              <div className="dashboard-card text-center">
                <div className="text-muted small">Status</div>
                <div className={restrictedViolation ? 'text-danger display-6' : 'text-success display-6'}>
                  {restrictedViolation ? 'Violation' : 'OK'}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </motion.div>
  );
}
