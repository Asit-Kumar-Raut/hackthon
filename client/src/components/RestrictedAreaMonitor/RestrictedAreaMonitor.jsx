import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { motion } from 'framer-motion';
import { pushNotification } from '../NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import { intrusionLogsService } from '../../services/intrusionLogs';
import './RestrictedAreaMonitor.css';

export default function RestrictedAreaMonitor({ onLogUpdate }) {
    const { user } = useAuth();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [model, setModel] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [status, setStatus] = useState('Initializing AI Model...');
    const [cameraActive, setCameraActive] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);

    const [boundaryPoints, setBoundaryPoints] = useState([]); // Array of {x, y}
    const boundaryPointsRef = useRef([]); // To access inside animation frame

    // Analytics/UI states
    const [isIntrusion, setIsIntrusion] = useState(false);
    const [intrusionCount, setIntrusionCount] = useState(0);

    const animationReq = useRef(null);
    const lastLogTime = useRef(0);

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
                setModel(loadedModel);
                setStatus('Ready. Draw boundary, then Start Monitoring.');

                // Fetch existing boundary preset if available
                const existingBoundary = await intrusionLogsService.getBoundary('default_zone');
                if (existingBoundary && existingBoundary.coordinates) {
                    setBoundaryPoints(existingBoundary.coordinates);
                    boundaryPointsRef.current = existingBoundary.coordinates;
                    drawBoundaryStatic(existingBoundary.coordinates);
                }
            } catch (err) {
                console.error("Model load error:", err);
                setStatus("Error loading AI model.");
            }
        };
        loadModel();

        return () => stopDetection();
    }, []);

    const startDetection = async () => {
        if (!model) return;

        if (boundaryPoints.length < 3) {
            pushNotification('Please draw a boundary with at least 3 points first!', 'alert');
            return;
        }

        setStatus('Starting webcam...');
        setIsDrawing(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'environment' } // Environment camera for surveillance
            });
            videoRef.current.srcObject = stream;
            streamRef.current = stream;

            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play();
                setCameraActive(true);
                setStatus('Monitoring Restricted Area...');
                setIsDetecting(true);
                detectWebcam();
            };
        } catch (err) {
            console.error('Webcam error:', err);
            setStatus('Webcam access denied or unavailable.');
            pushNotification('Cannot access webcam.', 'alert');
        }
    };

    const stopDetection = () => {
        setCameraActive(false);
        setIsDetecting(false);
        setIsIntrusion(false);
        if (animationReq.current) cancelAnimationFrame(animationReq.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setStatus('Detection stopped.');

        // Redraw persistent boundary on blank canvas
        drawBoundaryStatic(boundaryPointsRef.current);
    };

    // ------------- DRAWING LOGIC -------------
    const handleCanvasClick = (e) => {
        if (!isDrawing || cameraActive) return; // Only draw when active and video off

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Scale appropriately if canvas CSS size != true pixel size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        const newPoints = [...boundaryPoints, { x, y }];
        setBoundaryPoints(newPoints);
        boundaryPointsRef.current = newPoints;

        drawBoundaryStatic(newPoints);
    };

    const clearBoundary = () => {
        setBoundaryPoints([]);
        boundaryPointsRef.current = [];
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const saveBoundary = async () => {
        if (boundaryPoints.length < 3) {
            pushNotification('Need at least 3 points for a valid zone.', 'alert');
            return;
        }
        try {
            await intrusionLogsService.saveBoundary('default_zone', boundaryPoints, user?.employeeId || 'admin');
            pushNotification('Boundary preset saved successfully!', 'success');
        } catch (e) {
            pushNotification('Failed to save boundary.', 'alert');
        }
    };

    const drawBoundaryStatic = (points) => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        // If not running video, we clear first
        if (!cameraActive) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }

        if (points.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        // Style
        ctx.lineWidth = 3;
        ctx.strokeStyle = isIntrusion ? '#FF0000' : '#ffff00';
        ctx.fillStyle = isIntrusion ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.15)';

        ctx.fill();
        ctx.stroke();

        // Draw point dots
        ctx.fillStyle = '#ffffff';
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    };

    // ------------- DETECTION LOGIC -------------

    // Ray-casting algorithm to determine if a point is inside a polygon
    const isPointInPolygon = (point, vs) => {
        // vs is an array of [x,y] or {x,y}
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;

            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const playSiren = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            setTimeout(() => osc.stop(), 400);
        } catch (e) {
            console.log('Audio disabled automatically');
        }
    };

    const detectWebcam = async () => {
        if (!videoRef.current || !isDetecting) return;
        const video = videoRef.current;

        if (video.readyState !== 4) {
            animationReq.current = requestAnimationFrame(detectWebcam);
            return;
        }

        // We run detection
        const predictions = await model.detect(video);

        const ctx = canvasRef.current.getContext('2d');
        // Set canvas dimensions explicitly to match video stream size on first frame
        if (canvasRef.current.width !== video.videoWidth) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        let intrusionDetected = false;
        const currentZone = boundaryPointsRef.current;

        predictions.forEach(prediction => {
            if (prediction.class === 'person' && prediction.score > 0.5) {
                const [x, y, width, height] = prediction.bbox;

                // Draw person bounding box
                ctx.strokeStyle = '#3b82f6'; // Blue for normal person
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);

                // Calculate centroid (bottom center of feet is usually best for "stepped into" zone)
                const centroid = {
                    x: x + width / 2,
                    y: y + height // bottom of bounding box
                };

                // Draw centroid
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.arc(centroid.x, centroid.y, 5, 0, 2 * Math.PI);
                ctx.fill();

                // Check intersection
                if (currentZone.length >= 3) {
                    const inside = isPointInPolygon(centroid, currentZone);
                    if (inside) {
                        intrusionDetected = true;
                        // Turn bounding box RED
                        ctx.strokeStyle = '#FF0000';
                        ctx.strokeRect(x, y, width, height);
                        ctx.fillStyle = '#FF0000';
                        ctx.fillText('UNAUTHORIZED ENTRY', x, y - 5);
                    }
                }
            }
        });

        // Update state to trigger UI
        setIsIntrusion(intrusionDetected);

        // Draw the zone polygon over video
        drawBoundaryStatic(currentZone);

        // Handle Logging
        if (intrusionDetected) {
            const now = Date.now();
            if (now - lastLogTime.current > 5000) { // Log once every 5 seconds to prevent spam
                lastLogTime.current = now;
                playSiren();
                setIntrusionCount(prev => prev + 1);

                pushNotification('⚠ Unauthorized Entry Detected!', 'alert');

                // In production: grab full base64 snapshot
                // const snapshotImage = canvasRef.current.toDataURL('image/jpeg', 0.5);

                intrusionLogsService.logIntrusion({
                    zoneId: 'default_zone',
                    detectedPerson: 'unknown_intruder',
                    confidenceScore: 0.9,
                    snapshotImage: null
                }).then(() => {
                    if (onLogUpdate) onLogUpdate();
                });
            }
        }

        if (isDetecting) {
            animationReq.current = requestAnimationFrame(detectWebcam);
        }
    };

    return (
        <div className="restricted-area-monitor">
            <div className="row g-4">
                {/* Left Column: Video */}
                <div className="col-lg-8">
                    <div
                        className={`video-container position-relative bg-dark ${isIntrusion ? 'intrusion-flash' : ''}`}
                        style={{ cursor: isDrawing && !cameraActive ? 'crosshair' : 'default' }}
                    >
                        <video
                            ref={videoRef}
                            className="w-100 rounded"
                            style={{ minHeight: '400px', objectFit: 'fill', display: cameraActive ? 'block' : 'none' }}
                            muted
                            playsInline
                        />
                        {/* Dummy background when camera is off */}
                        {!cameraActive && (
                            <div className="w-100 rounded" style={{ minHeight: '400px', background: '#111' }} />
                        )}
                        <canvas
                            ref={canvasRef}
                            onClick={handleCanvasClick}
                            className={`position-absolute top-0 start-0 w-100 h-100 ${cameraActive ? 'pe-none' : ''}`}
                            width={640} // Default logic size before real stream load
                            height={480}
                        />

                        {/* Overlay Status */}
                        <div className={`status-overlay ${(cameraActive || isDrawing) ? 'active' : ''}`}>
                            <span className={status.includes('Error') ? 'text-danger' : 'text-info'}>
                                {status}
                            </span>
                        </div>

                        {/* Intrusion Warning Overlay inside video */}
                        {isIntrusion && cameraActive && (
                            <div className="position-absolute top-0 start-0 w-100 h-100 pe-none d-flex align-items-center justify-content-center" style={{ background: 'rgba(255,0,0,0.2)' }}>
                                <h2 className="text-danger fw-bold shadow-lg" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '10px' }}>⚠ UNAUTHORIZED ENTRY</h2>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-3 dashboard-card d-flex flex-wrap gap-2 align-items-center">
                        <span className="fw-bold me-2">Controls:</span>
                        {!cameraActive ? (
                            <>
                                <button className={`btn ${isDrawing ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setIsDrawing(!isDrawing)}>
                                    ✏️ {isDrawing ? 'Stop Drawing' : 'Draw Boundary'}
                                </button>
                                <button className="btn btn-outline-danger" onClick={clearBoundary} disabled={boundaryPoints.length === 0}>
                                    🗑️ Clear
                                </button>
                                <button className="btn btn-outline-success" onClick={saveBoundary} disabled={boundaryPoints.length < 3}>
                                    💾 Save Preset
                                </button>
                                <div className="ms-auto">
                                    <button className="btn btn-primary fw-bold px-4" onClick={startDetection} disabled={!model}>
                                        🎥 Start Monitoring
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button className="btn btn-danger w-100 fw-bold" onClick={stopDetection}>
                                ⏹ Stop Monitoring
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Column: Analytics / Status */}
                <div className="col-lg-4">
                    <motion.div className="dashboard-card h-100 position-relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h5 className="mb-3">🛡️ Zone Analytics</h5>

                        <div className="p-3 mb-3 text-center rounded border" style={{ background: isIntrusion ? 'rgba(255,0,0,0.1)' : 'rgba(34,197,94,0.1)', borderColor: isIntrusion ? '#ef4444' : '#22c55e' }}>
                            <div className="small text-muted mb-1">Status</div>
                            <h4 className="mb-0 fw-bold" style={{ color: isIntrusion ? '#ef4444' : '#22c55e' }}>
                                {isIntrusion ? '⚠ BREACHED' : '✅ SECURE'}
                            </h4>
                        </div>

                        <div className="d-flex justify-content-between text-muted mb-2 small border-bottom border-dark pb-2">
                            <span>Current Session Intrusions:</span>
                            <span className="fw-bold text-white fs-5">{intrusionCount}</span>
                        </div>

                        <div className="alert alert-dark small mb-0 mt-3 border-secondary">
                            <strong>Instructions:</strong>
                            <ol className="mb-0 ps-3 mt-1">
                                <li>Click 'Draw Boundary'</li>
                                <li>Click on the black screen to place points for your polygon (min 3 points)</li>
                                <li>Click 'Start Monitoring'</li>
                                <li>If a person steps inside, siren and logs trigger.</li>
                            </ol>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
