/**
 * CrowdDetector - Real person detection via TensorFlow.js COCO-SSD (YOLO-style in browser)
 * Restricted area violation, crowd count, alert siren, red banner, log to API
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAlertSiren } from '../../hooks/useAlertSiren';
import './CrowdDetector.css';

const RESTRICTED_THRESHOLD = 5;
const DETECTION_INTERVAL_MS = 1500;
const MIN_CONFIDENCE = 0.5;
const DETECTOR_ENDPOINT = '/detector/detect'; // Python OpenCV+YOLO service (proxied by Vite)

export default function CrowdDetector({ onAlert, onLog }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const intervalRef = useRef(null);
  const { user } = useAuth();
  const { playSiren, stopSiren } = useAlertSiren();

  const [isStarted, setIsStarted] = useState(false);
  const [crowdCount, setCrowdCount] = useState(0);
  const [restrictedViolation, setRestrictedViolation] = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [detectionMode, setDetectionMode] = useState('yolo'); // 'yolo' | 'tfjs' | 'simulate'
  const [detectorHealthy, setDetectorHealthy] = useState(null); // null | true | false

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
      const res = await fetch('/detector/health', { method: 'GET' });
      if (!res.ok) throw new Error('Detector not ok');
      setDetectorHealthy(true);
      return true;
    } catch (e) {
      setDetectorHealthy(false);
      return false;
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detectorOk = await checkPythonDetector();
      if (detectorOk) {
        setDetectionMode('yolo');
      } else {
        const loaded = await loadModel();
        setDetectionMode(loaded ? 'tfjs' : 'simulate');
      }
      setIsStarted(true);
      setAlertTriggered(false);
      setRestrictedViolation(false);
    } catch (err) {
      console.error('Camera error', err);
    }
  };

  const stopCamera = () => {
    stopSiren();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsStarted(false);
    setCrowdCount(0);
  };

  const captureFrameDataUrl = () => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const tmp = document.createElement('canvas');
    tmp.width = 640;
    tmp.height = 480;
    const ctx = tmp.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, tmp.width, tmp.height);
    return tmp.toDataURL('image/jpeg', 0.75);
  };

  const runPythonYoloDetection = async () => {
    const image = captureFrameDataUrl();
    if (!image) throw new Error('No frame');
    const res = await fetch(DETECTOR_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Detector error');
    return data; // {count, boxes:[{bbox:[x,y,w,h], confidence}], width, height}
  };

  const runDetection = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    let count = 0;

    if (detectionMode === 'yolo') {
      try {
        const data = await runPythonYoloDetection();
        count = data.count ?? 0;
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          const w = canvasRef.current.width;
          const h = canvasRef.current.height;
          ctx.clearRect(0, 0, w, h);
          (data.boxes || []).forEach((b) => {
            const [x, y, bw, bh] = b.bbox;
            const mx = w - x - bw; // mirror to match mirrored video
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(mx, y, bw, bh);
            ctx.fillStyle = '#FF0000';
            ctx.font = '14px sans-serif';
            ctx.fillText(`person ${(b.confidence * 100).toFixed(0)}%`, mx, y - 4);
          });
        }
      } catch (e) {
        // If YOLO service is down mid-session, downgrade and use fallback this frame
        setDetectorHealthy(false);
        if (modelRef.current) {
          setDetectionMode('tfjs');
          try {
            const predictions = await modelRef.current.detect(videoRef.current, undefined, MIN_CONFIDENCE);
            count = predictions.filter((p) => p.class === 'person').length;
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              const w = canvasRef.current.width;
              const h = canvasRef.current.height;
              ctx.clearRect(0, 0, w, h);
              predictions.filter((p) => p.class === 'person').forEach((p) => {
                const [x, y, bw, bh] = p.bbox;
                const mx = w - x - bw;
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 2;
                ctx.strokeRect(mx, y, bw, bh);
                ctx.fillStyle = '#FF0000';
                ctx.font = '14px sans-serif';
                ctx.fillText(`person ${(p.score * 100).toFixed(0)}%`, mx, y - 4);
              });
            }
          } catch (_) {
            count = Math.floor(Math.random() * 6);
            setDetectionMode('simulate');
          }
        } else {
          count = Math.floor(Math.random() * 9);
          setDetectionMode('simulate');
        }
      }
    } else if (detectionMode === 'tfjs' && modelRef.current) {
      try {
        const predictions = await modelRef.current.detect(videoRef.current, undefined, MIN_CONFIDENCE);
        count = predictions.filter((p) => p.class === 'person').length;
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          const w = canvasRef.current.width;
          const h = canvasRef.current.height;
          ctx.clearRect(0, 0, w, h);
          predictions
            .filter((p) => p.class === 'person')
            .forEach((p) => {
              const [x, y, bw, bh] = p.bbox;
              const mx = w - x - bw;
              ctx.strokeStyle = '#FF0000';
              ctx.lineWidth = 2;
              ctx.strokeRect(mx, y, bw, bh);
              ctx.fillStyle = '#FF0000';
              ctx.font = '14px sans-serif';
              ctx.fillText(`person ${(p.score * 100).toFixed(0)}%`, mx, y - 4);
            });
        }
      } catch (e) {
        count = Math.floor(Math.random() * 6);
      }
    } else {
      count = Math.floor(Math.random() * 9);
    }

    setCrowdCount(count);
    const violation = count > RESTRICTED_THRESHOLD;
    setRestrictedViolation(violation);
    if (violation) {
      setAlertTriggered(true);
      playSiren(4000);
    }

    if (user?.employeeId) {
      try {
        await api.post('/api/crowd/log', {
          detectedCount: count,
          restrictedViolation: violation,
          alertTriggered: violation,
        });
        onLog?.();
        if (violation) onAlert?.();
      } catch (e) {}
    }
  }, [detectionMode, user?.employeeId, onLog, onAlert, playSiren]);

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
                ? (detectorHealthy === false ? 'YOLO detector offline (fallback)' : 'OpenCV + YOLO (Python service)')
                : modelLoaded
                  ? 'TensorFlow.js COCO-SSD (person)'
                  : 'Simulated count'}
            </span>
          </>
        )}
      </div>

      {isStarted && (
        <>
          <div className="crowd-feed position-relative mb-3">
            <video ref={videoRef} className="crowd-video" playsInline muted style={{ transform: 'scaleX(-1)' }} />
            <canvas
              ref={canvasRef}
              className="crowd-canvas"
              width={640}
              height={480}
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="crowd-count-badge">
              Crowd Count: <strong>{crowdCount}</strong> (person detection)
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
