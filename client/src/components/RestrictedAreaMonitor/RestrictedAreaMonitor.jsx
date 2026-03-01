/**
 * Restricted Area Monitor - Gandhi Engineering College (Autonomous), Bhubaneswar, Odisha
 * Map: Real GEC map. Video: draw zone, person detection, continuous siren. Live: webcam.
 */
import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { motion } from 'framer-motion';
import { pushNotification } from '../NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import { intrusionLogsService } from '../../services/intrusionLogs';
import { useAlertSiren } from '../../hooks/useAlertSiren';
import GECMap from './GECMap';
import './RestrictedAreaMonitor.css';

const MODE_MAP = 'map';
const MODE_VIDEO = 'video';
const MODE_LIVE = 'live';

const INTRUSION_CLASSES = new Set(['person']);

export default function RestrictedAreaMonitor({ onLogUpdate }) {
    const { user } = useAuth();
    const { playSirenContinuous, stopSiren } = useAlertSiren();
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [mode, setMode] = useState(MODE_MAP);
    const [model, setModel] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [status, setStatus] = useState('Initializing AI Model...');
    const [cameraActive, setCameraActive] = useState(false);
    const [isDrawing, setIsDrawing] = useState(true);

    const [boundaryPoints, setBoundaryPoints] = useState([]);
    const boundaryPointsRef = useRef([]);
    const [mousePos, setMousePos] = useState(null);

    // Map mode: boundary as latlngs [[lat,lng],...] for Leaflet
    const [mapBoundaryPoints, setMapBoundaryPoints] = useState([]);
    const [mapImageDimensions, setMapImageDimensions] = useState({ w: 640, h: 480 });

    // Video mode: uploaded video file
    const [videoFile, setVideoFile] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [restrictedAreaActivated, setRestrictedAreaActivated] = useState(false);
    const [videoProcessing, setVideoProcessing] = useState(false);
    const videoStopRef = useRef(false);

    const [isIntrusion, setIsIntrusion] = useState(false);
    const [intrusionCount, setIntrusionCount] = useState(0);

    const animationReq = useRef(null);
    const lastLogTime = useRef(0);
    const sirenActiveRef = useRef(false);

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
                setModel(loadedModel);
                setStatus('Select the restricted area on the GEC map, then click Send.');

                const existingBoundary = await intrusionLogsService.getBoundary('default_zone');
                if (existingBoundary && existingBoundary.coordinates?.length >= 3) {
                    const coords = existingBoundary.coordinates;
                    setBoundaryPoints(coords);
                    boundaryPointsRef.current = coords;
                    if (existingBoundary.latlngs?.length >= 3) {
                        setMapBoundaryPoints(existingBoundary.latlngs);
                    }
                    if (existingBoundary.sourceWidth && existingBoundary.sourceHeight) {
                        setMapImageDimensions({ w: existingBoundary.sourceWidth, h: existingBoundary.sourceHeight });
                    }
                }
            } catch (err) {
                console.error("Model load error:", err);
                setStatus("Error loading AI model.");
            }
        };
        loadModel();

        return () => {
            stopDetection();
            if (videoUrl) URL.revokeObjectURL(videoUrl);
        };
    }, []);

    // ------------ VIDEO MODE: Upload video (like SafetyGearMonitor file upload) ------------
    const handleVideoUpload = (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            const url = URL.createObjectURL(file);
            setVideoFile(file);
            setVideoUrl(url);
            setBoundaryPoints([]);
            boundaryPointsRef.current = [];
            setRestrictedAreaActivated(false);
            setVideoProcessing(false);
            setStatus('Video loaded. Draw restricted area on first frame, then click Send.');
        }
    };

    const handleVideoLoadedMetadata = () => {
        const v = videoRef.current;
        if (v) {
            setMapImageDimensions({ w: v.videoWidth, h: v.videoHeight });
            if (canvasRef.current) {
                canvasRef.current.width = v.videoWidth;
                canvasRef.current.height = v.videoHeight;
            }
        }
    };

    const drawVideoFirstFrame = () => {
        const v = videoRef.current;
        const ctx = canvasRef.current?.getContext('2d');
        if (v && ctx && v.readyState >= 2 && !videoProcessing) {
            canvasRef.current.width = v.videoWidth;
            canvasRef.current.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            drawBoundaryOnContext(ctx, boundaryPointsRef.current, false);
        }
    };

    // ------------ SEND: Activate restricted area camera ------------
    const handleSend = async () => {
        const pts = mode === MODE_MAP ? mapBoundaryPoints : boundaryPoints;
        if (pts.length < 3) {
            pushNotification('Draw a restricted area with at least 3 points first!', 'alert');
            return;
        }

        const coords = mode === MODE_MAP ? mapBoundaryPoints : boundaryPointsRef.current;
        const { w, h } = mapImageDimensions;
        const meta = mode === MODE_MAP
            ? { latlngs: mapBoundaryPoints }
            : { sourceWidth: w, sourceHeight: h };

        try {
            await intrusionLogsService.saveBoundary('default_zone', coords, user?.employeeId || 'admin', meta);
            pushNotification('Restriction area CCTV is activated!', 'success');
        } catch (e) {
            console.warn('Firebase save failed, activating locally:', e);
            pushNotification('Restriction area CCTV is activated (offline).', 'success');
        }

        setRestrictedAreaActivated(true);
        setStatus('Restriction area CCTV is activated.');

        if (mode === MODE_VIDEO && videoUrl) {
            videoStopRef.current = false;
            setVideoProcessing(true);
            setTimeout(() => processVideoFrames(), 100);
        }
    };

    // ------------ VIDEO: Process frames, detect persons in restricted zone, continuous siren ------------
    const processVideoFrames = async () => {
        const video = videoRef.current;
        if (!video || !model || !videoUrl || videoStopRef.current) return;

        video.loop = true;
        video.currentTime = 0;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        try {
            await video.play();
        } catch (e) {
            console.warn('Video autoplay:', e);
            setStatus('Click the video to play, or try a different video format.');
        }

        let sirenPlaying = false;
        let waitFrames = 0;

        const processFrame = async () => {
            if (videoStopRef.current) {
                if (sirenPlaying) stopSiren();
                setVideoProcessing(false);
                setRestrictedAreaActivated(false);
                setIsIntrusion(false);
                setStatus('Stopped. Draw area and click Send to activate again.');
                return;
            }

            const v = videoRef.current;
            if (!v || v.readyState < 2) {
                waitFrames++;
                if (waitFrames > 300) {
                    setStatus('Video not ready. Try a different format (MP4 recommended).');
                }
                requestAnimationFrame(processFrame);
                return;
            }

            if (v.videoWidth === 0 || v.videoHeight === 0) {
                requestAnimationFrame(processFrame);
                return;
            }

            let predictions = [];
            try {
                predictions = await model.detect(v);
            } catch (err) {
                console.warn('Detection error:', err);
            }
            const zone = boundaryPointsRef.current;
            let intrusionDetected = false;
            let detectedClass = '';

            for (const p of predictions) {
                if (INTRUSION_CLASSES.has(p.class) && p.score > 0.4) {
                    if (isBboxInZone(p.bbox, zone)) {
                        intrusionDetected = true;
                        detectedClass = p.class;
                        break;
                    }
                }
            }

            if (intrusionDetected) {
                if (!sirenPlaying) {
                    playSirenContinuous();
                    sirenPlaying = true;
                }
                setIntrusionCount((prev) => prev + 1);
                pushNotification(`⚠ ${detectedClass} detected in restricted area!`, 'alert');
                const now = Date.now();
                if (now - lastLogTime.current > 3000) {
                    lastLogTime.current = now;
                    intrusionLogsService.logIntrusion({
                        zoneId: 'default_zone',
                        detectedPerson: detectedClass,
                        confidenceScore: 0.9,
                        snapshotImage: null,
                    }).then(() => onLogUpdate?.());
                }
                setIsIntrusion(true);
            } else {
                if (sirenPlaying) {
                    stopSiren();
                    sirenPlaying = false;
                }
                setIsIntrusion(false);
            }

            // Draw overlay
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && v) {
                if (ctx.canvas.width !== v.videoWidth) {
                    ctx.canvas.width = v.videoWidth;
                    ctx.canvas.height = v.videoHeight;
                }
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.drawImage(v, 0, 0);
                predictions.forEach((p) => {
                    if (INTRUSION_CLASSES.has(p.class) && p.score > 0.4) {
                        const [x, y, w, h] = p.bbox;
                        const inside = isBboxInZone(p.bbox, zone);
                        ctx.strokeStyle = inside ? '#FF0000' : '#3b82f6';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, w, h);
                        if (inside) ctx.fillText(`INTRUSION: ${p.class.toUpperCase()}`, x, y - 5);
                    }
                });
                drawBoundaryOnContext(ctx, zone, intrusionDetected);
            }

            requestAnimationFrame(processFrame);
        };

        processFrame();
    };

    const stopVideoProcessing = () => {
        videoStopRef.current = true;
        stopSiren();
        setIsIntrusion(false);
        setRestrictedAreaActivated(false);
        if (videoRef.current) {
            videoRef.current.pause();
        }
        setVideoProcessing(false);
        setStatus('Stopped. Draw area and click Send to activate again.');
    };

    // ------------ LIVE CAMERA ------------
    const startDetection = async () => {
        if (!model) return;
        if (boundaryPoints.length < 3) {
            pushNotification('Please draw a boundary with at least 3 points first!', 'alert');
            return;
        }

        setStatus('Starting webcam...');
        setIsDrawing(false);
        videoStopRef.current = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'environment' },
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
        videoStopRef.current = true;
        sirenActiveRef.current = false;
        stopSiren();
        setCameraActive(false);
        setIsDetecting(false);
        setIsIntrusion(false);
        if (animationReq.current) cancelAnimationFrame(animationReq.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setStatus('Detection stopped.');
        drawBoundaryStatic(boundaryPointsRef.current);
    };

    // ------------ DRAWING ------------
    const getClickCoords = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY),
        };
    };

    const handleCanvasClick = (e) => {
        if (!isDrawing || cameraActive || videoProcessing) return;
        const coords = getClickCoords(e);
        if (!coords) return;

        const newPoints = [...boundaryPoints, coords];
        setBoundaryPoints(newPoints);
        boundaryPointsRef.current = newPoints;
        setMousePos(null);
        drawBoundaryWithPreview(newPoints, null);
    };

    const handleCanvasMouseMove = (e) => {
        if (!isDrawing || cameraActive || videoProcessing || boundaryPoints.length === 0) return;
        const coords = getClickCoords(e);
        if (coords) {
            setMousePos(coords);
            drawBoundaryWithPreview(boundaryPointsRef.current, coords);
        }
    };

    const handleCanvasMouseLeave = () => {
        setMousePos(null);
        drawBoundaryStatic(boundaryPointsRef.current);
    };

    const clearBoundary = () => {
        if (mode === MODE_MAP) {
            setMapBoundaryPoints([]);
        } else {
            setBoundaryPoints([]);
            boundaryPointsRef.current = [];
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                if (mode === MODE_VIDEO && videoRef.current && videoRef.current.readyState >= 2) {
                    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }
                drawBoundaryStatic([]);
            }
        }
    };

    const drawBoundaryOnContext = (ctx, points, intrusion = false, previewPoint = null) => {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (points?.length > 0) {
            ctx.beginPath();
            const p0 = points[0];
            const x0 = p0.x ?? p0[0];
            const y0 = p0.y ?? p0[1];
            ctx.moveTo(x0, y0);
            for (let i = 1; i < points.length; i++) {
                const p = points[i];
                ctx.lineTo(p.x ?? p[0], p.y ?? p[1]);
            }
            if (points.length >= 3) ctx.closePath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = intrusion ? '#FF0000' : '#000000';
            ctx.fillStyle = intrusion ? 'rgba(255,0,0,0.3)' : 'rgba(0,0,0,0.3)';
            if (points.length >= 3) ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#fff';
            points.forEach((p) => {
                const px = p.x ?? p[0];
                const py = p.y ?? p[1];
                ctx.beginPath();
                ctx.arc(px, py, 5, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        if (previewPoint && points?.length > 0) {
            const last = points[points.length - 1];
            const lx = last.x ?? last[0];
            const ly = last.y ?? last[1];
            ctx.setLineDash([8, 8]);
            ctx.strokeStyle = '#ffc107';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(previewPoint.x ?? previewPoint[0], previewPoint.y ?? previewPoint[1]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    };

    const drawBoundaryWithPreview = (points, previewPoint) => {
        if (!canvasRef.current || mode === MODE_MAP) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!cameraActive && !videoProcessing) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            if (mode === MODE_VIDEO && videoRef.current?.readyState >= 2) {
                ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
        drawBoundaryOnContext(ctx, points, isIntrusion, previewPoint);
    };

    const drawBoundaryStatic = (points) => {
        drawBoundaryWithPreview(points, null);
    };

    const isPointInPolygon = (point, vs) => {
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    };

    /** Check if person/animal bbox overlaps restricted zone - any part of bbox inside zone triggers */
    const isBboxInZone = (bbox, zone) => {
        if (!zone || zone.length < 3) return false;
        const [x, y, w, h] = bbox;
        const points = [
            { x: x, y: y },
            { x: x + w, y: y },
            { x: x + w, y: y + h },
            { x: x, y: y + h },
            { x: x + w / 2, y: y + h / 2 },
            { x: x + w / 2, y: y + h },
        ];
        return points.some((p) => isPointInPolygon(p, zone));
    };

    const detectWebcam = async () => {
        if (!videoRef.current || !isDetecting) return;
        const video = videoRef.current;
        if (video.readyState !== 4) {
            animationReq.current = requestAnimationFrame(detectWebcam);
            return;
        }

        const predictions = await model.detect(video);
        const ctx = canvasRef.current.getContext('2d');
        if (canvasRef.current.width !== video.videoWidth) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        let intrusionDetected = false;
        const zone = boundaryPointsRef.current;

        predictions.forEach((p) => {
            if (INTRUSION_CLASSES.has(p.class) && p.score > 0.4) {
                const [x, y, w, h] = p.bbox;
                const inside = isBboxInZone(p.bbox, zone);
                if (inside) intrusionDetected = true;
                ctx.strokeStyle = inside ? '#FF0000' : '#3b82f6';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, w, h);
                if (inside) {
                    ctx.fillStyle = '#FF0000';
                    ctx.fillText(`INTRUSION: ${p.class.toUpperCase()}`, x, y - 5);
                }
            }
        });
        setIsIntrusion(intrusionDetected);
        drawBoundaryOnContext(ctx, zone, intrusionDetected);

        if (intrusionDetected) {
            if (!sirenActiveRef.current) {
                playSirenContinuous();
                sirenActiveRef.current = true;
            }
            const now = Date.now();
            if (now - lastLogTime.current > 5000) {
                lastLogTime.current = now;
                setIntrusionCount((p) => p + 1);
                pushNotification('⚠ Unauthorized Entry Detected!', 'alert');
                intrusionLogsService.logIntrusion({ zoneId: 'default_zone', detectedPerson: 'unknown_intruder', confidenceScore: 0.9, snapshotImage: null }).then(() => onLogUpdate?.());
            }
        } else {
            if (sirenActiveRef.current) {
                stopSiren();
                sirenActiveRef.current = false;
            }
        }

        if (isDetecting) animationReq.current = requestAnimationFrame(detectWebcam);
    };

    // ------------ RENDER ------------
    const showMapOrVideoArea = mode === MODE_MAP || (mode === MODE_VIDEO && videoUrl);
    const mapCanSend = mapBoundaryPoints.length >= 3 && !restrictedAreaActivated;
    const videoCanSend = boundaryPoints.length >= 3 && videoUrl && !restrictedAreaActivated && !videoProcessing;
    const liveCanSend = boundaryPoints.length >= 3 && !restrictedAreaActivated;

    return (
        <div className="restricted-area-monitor">
            {/* Mode Tabs */}
            <div className="d-flex gap-2 mb-4 flex-wrap">
                <button className={`btn ${mode === MODE_MAP ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => { setMode(MODE_MAP); setStatus('Select the restricted area on the GEC map, then click Send.'); setRestrictedAreaActivated(false); }}>
                    🗺️ Map Setup (GEC)
                </button>
                <button className={`btn ${mode === MODE_VIDEO ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => { setMode(MODE_VIDEO); setStatus('Upload video, draw restricted area, click Send.'); setRestrictedAreaActivated(false); setVideoProcessing(false); videoStopRef.current = true; }}>
                    🎬 Video Upload
                </button>
                <button className={`btn ${mode === MODE_LIVE ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => { setMode(MODE_LIVE); setStatus('Draw boundary, then Start Monitoring.'); setRestrictedAreaActivated(false); }}>
                    📹 Live Camera
                </button>
            </div>

            <div className="row g-4">
                <div className="col-lg-8">
                    <div
                        className={`video-container position-relative bg-dark ${isIntrusion ? 'intrusion-flash' : ''}`}
                        style={{ cursor: isDrawing && !cameraActive && !videoProcessing ? 'crosshair' : 'default' }}
                    >
                        {/* Map mode: Real GEC map - Gandhi Engineering College (Autonomous), Bhubaneswar, Odisha */}
                        {mode === MODE_MAP && (
                            <GECMap
                                boundaryPoints={mapBoundaryPoints}
                                onBoundaryChange={setMapBoundaryPoints}
                                isDrawing={isDrawing}
                            />
                        )}

                        {/* Video mode: show video */}
                        {mode === MODE_VIDEO && videoUrl && (
                            <>
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    muted
                                    playsInline
                                    preload="auto"
                                    onLoadedMetadata={handleVideoLoadedMetadata}
                                    onLoadedData={() => {
                                        const v = videoRef.current;
                                        if (v && !videoProcessing) {
                                            v.currentTime = 0;
                                        }
                                    }}
                                    onSeeked={drawVideoFirstFrame}
                                    onCanPlay={drawVideoFirstFrame}
                                    style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    onClick={handleCanvasClick}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseLeave={handleCanvasMouseLeave}
                                    className="position-absolute top-0 start-0 w-100 h-100"
                                    style={{ objectFit: 'contain', pointerEvents: isDrawing && !videoProcessing ? 'auto' : 'none' }}
                                />
                            </>
                        )}

                        {/* Live mode: webcam */}
                        {mode === MODE_LIVE && (
                            <>
                                <video
                                    ref={videoRef}
                                    className="w-100 rounded"
                                    style={{ minHeight: '400px', objectFit: 'fill', display: cameraActive ? 'block' : 'none' }}
                                    muted
                                    playsInline
                                />
                                {!cameraActive && <div className="w-100 rounded" style={{ minHeight: '400px', background: '#111' }} />}
                                <canvas
                                    ref={canvasRef}
                                    onClick={handleCanvasClick}
                                    onMouseMove={handleCanvasMouseMove}
                                    onMouseLeave={handleCanvasMouseLeave}
                                    className={`position-absolute top-0 start-0 w-100 h-100 ${cameraActive ? 'pe-none' : ''}`}
                                    width={640}
                                    height={480}
                                />
                            </>
                        )}

                        {mode === MODE_VIDEO && !videoUrl && (
                            <div className="d-flex flex-column align-items-center justify-content-center p-5 text-muted" style={{ minHeight: '400px' }}>
                                <span style={{ fontSize: '3rem' }}>🎬</span>
                                <p className="mt-3">Upload video (CCTV/camera footage)</p>
                                <input type="file" accept="video/*" className="form-control w-auto" onChange={handleVideoUpload} />
                            </div>
                        )}

                        <div className={`status-overlay ${(cameraActive || isDrawing || showMapOrVideoArea) ? 'active' : ''}`}>
                            <span className={status.includes('Error') ? 'text-danger' : 'text-info'}>{status}</span>
                        </div>

                        {restrictedAreaActivated && (
                            <div className="position-absolute top-0 start-0 w-100 p-3 bg-success bg-opacity-75 text-center fw-bold rounded-bottom">
                                ✅ Restriction area CCTV is activated
                            </div>
                        )}

                        {isIntrusion && (cameraActive || videoProcessing) && (
                            <div className="position-absolute top-0 start-0 w-100 h-100 pe-none d-flex align-items-center justify-content-center" style={{ background: 'rgba(255,0,0,0.2)' }}>
                                <h2 className="text-danger fw-bold shadow-lg" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '10px' }}>⚠ UNAUTHORIZED ENTRY</h2>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="mt-4 p-3 dashboard-card d-flex flex-wrap gap-2 align-items-center">
                        {mode === MODE_MAP && (
                            <>
                                <button className={`btn ${isDrawing ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setIsDrawing(!isDrawing)}>✏️ {isDrawing ? 'Stop Drawing' : 'Draw Area'}</button>
                                <button className="btn btn-outline-danger" onClick={clearBoundary} disabled={mapBoundaryPoints.length === 0}>🗑️ Clear</button>
                                <button className="btn btn-success fw-bold px-4" onClick={handleSend} disabled={!mapCanSend}>📤 Send</button>
                            </>
                        )}
                        {mode === MODE_VIDEO && videoUrl && (
                            <>
                                <div>
                                    <label className="form-label small text-white-50 mb-0">Upload Video</label>
                                    <input type="file" accept="video/*" className="form-control form-control-sm" onChange={handleVideoUpload} />
                                </div>
                                <button className={`btn ${isDrawing && !videoProcessing ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setIsDrawing(!isDrawing)} disabled={videoProcessing}>✏️ {isDrawing ? 'Stop Drawing' : 'Draw Area'}</button>
                                <button className="btn btn-outline-danger" onClick={clearBoundary} disabled={boundaryPoints.length === 0 || videoProcessing}>🗑️ Clear</button>
                                {!videoProcessing ? (
                                    <button className="btn btn-success fw-bold px-4" onClick={handleSend} disabled={!videoCanSend}>📤 Send</button>
                                ) : (
                                    <button className="btn btn-danger" onClick={stopVideoProcessing}>⏹ Stop</button>
                                )}
                            </>
                        )}
                        {mode === MODE_LIVE && (
                            <>
                                {!cameraActive ? (
                                    <>
                                        <button className={`btn ${isDrawing ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => setIsDrawing(!isDrawing)}>✏️ {isDrawing ? 'Stop Drawing' : 'Draw Boundary'}</button>
                                        <button className="btn btn-outline-danger" onClick={clearBoundary} disabled={boundaryPoints.length === 0}>🗑️ Clear</button>
                                        <button className="btn btn-success fw-bold px-4" onClick={handleSend} disabled={!liveCanSend}>📤 Send</button>
                                        <div className="ms-auto">
                                            <button className="btn btn-primary fw-bold px-4" onClick={startDetection} disabled={!model}>🎥 Start Monitoring</button>
                                        </div>
                                    </>
                                ) : (
                                    <button className="btn btn-danger w-100 fw-bold" onClick={stopDetection}>⏹ Stop Monitoring</button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="col-lg-4">
                    <motion.div className="dashboard-card h-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h5 className="mb-3">🛡️ Zone Analytics</h5>
                        <div className="p-3 mb-3 text-center rounded border" style={{ background: isIntrusion ? 'rgba(255,0,0,0.1)' : 'rgba(34,197,94,0.1)', borderColor: isIntrusion ? '#ef4444' : '#22c55e' }}>
                            <div className="small text-muted mb-1">Status</div>
                            <h4 className="mb-0 fw-bold" style={{ color: isIntrusion ? '#ef4444' : '#22c55e' }}>
                                {isIntrusion ? '⚠ BREACHED' : restrictedAreaActivated ? '✅ ACTIVATED' : '⏳ READY'}
                            </h4>
                        </div>
                        <div className="d-flex justify-content-between text-muted mb-2 small border-bottom border-dark pb-2">
                            <span>Session Intrusions:</span>
                            <span className="fw-bold text-white fs-5">{intrusionCount}</span>
                        </div>
                        <div className="alert alert-dark small mb-0 mt-3 border-secondary">
                            <strong>Instructions:</strong>
                            <ul className="mb-0 ps-3 mt-1">
                                <li><strong>Map:</strong> When danger occurs, select the restricted area on the GEC map, click Send.</li>
                                <li><strong>Video:</strong> Upload video, draw area, click Send → siren rings immediately when person/animal detected in zone.</li>
                                <li><strong>Live:</strong> Draw boundary, Send, then Start Monitoring.</li>
                            </ul>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
