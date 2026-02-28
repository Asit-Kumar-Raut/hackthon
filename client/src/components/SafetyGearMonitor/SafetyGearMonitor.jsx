import React, { useRef, useEffect, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { motion } from 'framer-motion';
import { pushNotification } from '../NotificationPanel';
import { safetyGearService } from '../../services/safetyGearService';
import { useAuth } from '../../context/AuthContext';
import './SafetyGearMonitor.css';

export default function SafetyGearMonitor({ onScoreUpdate }) {
    const { user } = useAuth();
    const imageRef = useRef(null);
    const canvasRef = useRef(null);

    const [model, setModel] = useState(null);
    const [status, setStatus] = useState('Initializing AI Model...');
    const [threshold, setThreshold] = useState(0.5);

    // States for Safety Dashboard
    const [safetyScore, setSafetyScore] = useState(user?.currentSafetyScore ?? 100);
    const [gearStatus, setGearStatus] = useState({ helmet: true, mask: true, vest: true });
    const [logs, setLogs] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);

    // Demo Controls for Hackathon (simulating custom model PPE output for bounding boxes)
    const [demoMode, setDemoMode] = useState({ helmet: true, mask: true, vest: true });

    useEffect(() => {
        const loadModel = async () => {
            try {
                await tf.ready();
                const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
                setModel(loadedModel);
                setStatus('Ready. Upload an image to analyze.');
            } catch (err) {
                console.error("Model load error:", err);
                setStatus("Error loading AI model.");
            }
        };
        loadModel();

        if (user?.employeeId) {
            fetchLogs();
        }
    }, [user?.employeeId]);

    const fetchLogs = async () => {
        if (user?.employeeId) {
            const recentLogs = await safetyGearService.getSafetyLogs(user.employeeId, 5);
            setLogs(recentLogs);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setSelectedImage(imageUrl);
            setAnalysisResult(null);
            setStatus('Image loaded. Click "Analyze Image".');

            // Clear canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    };

    const analyzeImage = async () => {
        if (!model || !imageRef.current) return;
        setStatus('Analyzing Image...');

        const image = imageRef.current;

        // Run person detection
        const predictions = await model.detect(image, 10, threshold);

        // Map dimensions to canvas
        const ctx = canvasRef.current.getContext('2d');
        canvasRef.current.width = image.width;
        canvasRef.current.height = image.height;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const person = predictions.find(p => p.class === 'person');
        let currentPPEStatus = { helmet: demoMode.helmet, mask: demoMode.mask, vest: demoMode.vest };

        if (person) {
            const [x, y, width, height] = person.bbox;
            const confidence = Math.round(person.score * 100);

            // Main Person Box
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            const isHelmetWorn = currentPPEStatus.helmet;
            const isMaskWorn = currentPPEStatus.mask;
            const isVestWorn = currentPPEStatus.vest;

            // 1. Helmet Box (top of head)
            const hX = x + width * 0.2;
            const hY = y - height * 0.1;
            const hW = width * 0.6;
            const hH = height * 0.2;
            ctx.strokeStyle = isHelmetWorn ? '#22c55e' : '#FF0000';
            ctx.strokeRect(hX, hY, hW, hH);
            ctx.fillStyle = isHelmetWorn ? '#22c55e' : '#FF0000';
            ctx.font = "24px Arial";
            ctx.fillText(isHelmetWorn ? `Helmet: Yes ${confidence}%` : 'Helmet: No', hX, hY > 20 ? hY - 10 : 20);

            // 2. Mask Box (face area)
            const mX = x + width * 0.3;
            const mY = y + height * 0.15;
            const mW = width * 0.4;
            const mH = height * 0.15;
            ctx.strokeStyle = isMaskWorn ? '#22c55e' : '#FF0000';
            ctx.strokeRect(mX, mY, mW, mH);
            ctx.fillStyle = isMaskWorn ? '#22c55e' : '#FF0000';
            ctx.fillText(isMaskWorn ? 'Mask: Yes' : 'Mask: No', mX, mY > 20 ? mY - 10 : 20);

            // 3. Vest Box (torso area)
            const vX = x + width * 0.15;
            const vY = y + height * 0.35;
            const vW = width * 0.7;
            const vH = height * 0.5;
            ctx.strokeStyle = isVestWorn ? '#22c55e' : '#FF0000';
            ctx.strokeRect(vX, vY, vW, vH);
            ctx.fillStyle = isVestWorn ? '#22c55e' : '#FF0000';
            ctx.fillText(isVestWorn ? 'Vest: Yes' : 'Vest: No', vX, vY > 20 ? vY - 10 : 20);

            setGearStatus(currentPPEStatus);
            handleSafetyLogic(currentPPEStatus);
            setStatus('Analysis Complete.');
        } else {
            setStatus('No person detected in the image.');
            setAnalysisResult(["No person detected. Please upload a clearer image."]);
            setGearStatus({ helmet: false, mask: false, vest: false });
        }
    };

    const handleSafetyLogic = async (gear) => {
        const isMissingGear = !gear.helmet || !gear.mask || !gear.vest;

        let warnings = [];
        if (!gear.helmet) warnings.push('please wear helmet');
        if (!gear.mask) warnings.push('please wear mask');
        if (!gear.vest) warnings.push('please wear vest');

        if (isMissingGear) {
            setAnalysisResult(warnings);
            let incident = [];
            if (!gear.helmet) incident.push('Helmet');
            if (!gear.mask) incident.push('Mask');
            if (!gear.vest) incident.push('Vest');
            const incidentString = `Missing: ${incident.join(', ')}`;

            pushNotification(`Safety Alert: ${incidentString}! 🚨`, 'alert');

            let newScore = Math.max(0, safetyScore - 5);
            setSafetyScore(newScore);

            if (user?.employeeId && user?.uid) {
                try {
                    await safetyGearService.createSafetyLog({
                        employeeId: user.employeeId,
                        helmet: gear.helmet,
                        mask: gear.mask,
                        vest: gear.vest,
                        safetyScore: newScore,
                        incidentType: `Image Scan - ${incidentString}`
                    });
                    await safetyGearService.updateEmployeeSafetyStats(user.uid, newScore, incidentString);
                    if (onScoreUpdate) onScoreUpdate(newScore);
                    fetchLogs();
                } catch (err) {
                    console.error("Firebase log error:", err);
                }
            }
        } else {
            setAnalysisResult(["All safety gear worn correctly. Great job!"]);
            let newScore = Math.min(100, safetyScore + 1);
            setSafetyScore(newScore);
            if (user?.uid) {
                safetyGearService.updateEmployeeSafetyStats(user.uid, newScore, null);
                if (onScoreUpdate) onScoreUpdate(newScore);
            }
        }
    };

    return (
        <div className="safety-gear-monitor">
            <div className="row g-4 mb-4">
                {/* Left Column: Image & Controls */}
                <div className="col-lg-8">
                    <div className="video-container position-relative bg-dark d-flex align-items-center justify-content-center" style={{ minHeight: '400px', borderRadius: '12px', overflow: 'hidden' }}>
                        {selectedImage ? (
                            <>
                                <img
                                    ref={imageRef}
                                    src={selectedImage}
                                    alt="Upload for analysis"
                                    style={{ maxWidth: '100%', maxHeight: '600px', display: 'block' }}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="position-absolute top-0 start-50 translate-middle-x h-100 pe-none"
                                    style={{ zIndex: 5 }}
                                />
                            </>
                        ) : (
                            <div className="text-muted p-5 text-center">
                                <span style={{ fontSize: '3rem' }}>📸</span>
                                <p className="mt-2">Upload an image to start safety gear detection</p>
                            </div>
                        )}

                        {/* Overlay Status */}
                        <div className={`status-overlay ${selectedImage && analysisResult ? 'active' : ''}`} style={{ zIndex: 10 }}>
                            <span className={status.includes('Error') ? 'text-danger' : 'text-info'}>
                                {status}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 d-flex flex-wrap gap-3 align-items-end p-3 bg-dark rounded border border-secondary">
                        <div className="flex-grow-1">
                            <label className="form-label small text-white-50 mb-1">Upload Photo</label>
                            <input
                                type="file"
                                accept="image/*"
                                className="form-control"
                                onChange={handleImageUpload}
                            />
                        </div>

                        <button className="btn btn-primary px-4 py-2 fw-bold" onClick={analyzeImage} disabled={!model || !selectedImage}>
                            🔍 Analyze Image
                        </button>

                        <div className="d-flex align-items-center gap-2 text-white ms-md-auto">
                            <span className="small">Confidence: {Math.round(threshold * 100)}%</span>
                            <input
                                type="range"
                                className="form-range"
                                min="0.1" max="0.9" step="0.1"
                                value={threshold}
                                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                                style={{ width: '100px' }}
                            />
                        </div>
                    </div>

                    {/* Analysis Result Banner */}
                    {analysisResult && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`mt-4 p-4 rounded border ${analysisResult.length === 1 && analysisResult[0].includes('All safety gear') ? 'border-success bg-success text-success' : 'border-danger bg-danger text-danger'} bg-opacity-10`}
                        >
                            <h4 className="mb-3 d-flex align-items-center gap-2">
                                {analysisResult.length === 1 && analysisResult[0].includes('All') ? '✅' : '⚠️'}
                                Analysis Findings:
                            </h4>
                            <ul className="mb-0 ps-3">
                                {analysisResult.map((res, i) => (
                                    <li key={i} className="fw-bold fs-4 text-uppercase mb-2" style={{ letterSpacing: '1px' }}>{res}</li>
                                ))}
                            </ul>
                        </motion.div>
                    )}
                </div>

                {/* Right Column: Status & Demo Panel */}
                <div className="col-lg-4">
                    <motion.div className="dashboard-card h-100 position-relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h5 className="mb-4">🛡️ Safety Gear Status</h5>

                        <div className="gear-status-list">
                            <div className={`gear-item ${gearStatus.helmet ? 'good' : 'bad'}`}>
                                <span className="icon">👷</span>
                                <span className="label">Hard Hat (Helmet)</span>
                                <span className="badge">{gearStatus.helmet ? 'WORN' : 'MISSING'}</span>
                            </div>
                            <div className={`gear-item ${gearStatus.mask ? 'good' : 'bad'}`}>
                                <span className="icon">😷</span>
                                <span className="label">Face Mask</span>
                                <span className="badge">{gearStatus.mask ? 'WORN' : 'MISSING'}</span>
                            </div>
                            <div className={`gear-item ${gearStatus.vest ? 'good' : 'bad'}`}>
                                <span className="icon">🦺</span>
                                <span className="label">Safety Vest</span>
                                <span className="badge">{gearStatus.vest ? 'WORN' : 'MISSING'}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-top border-secondary">
                            <div className="text-center mb-2 text-muted small">Safety Score</div>
                            <div className="display-4 text-center fw-bold" style={{ color: safetyScore > 80 ? '#22c55e' : '#FF0000' }}>
                                {safetyScore}
                            </div>
                        </div>

                        {/* DEMO controls for Hackathon to simulate PPE changes */}
                        <div className="mt-4 p-3 bg-dark rounded border border-warning demo-panel">
                            <div className="small text-warning mb-2 fw-bold">⚠️ Model Simulation (Demo)</div>
                            <div className="small text-white-50 mb-3">Since YOLOv8 requires local PyTorch/ONNX setup, toggle these to simulate the YOLO PPE outputs, then click "Analyze Image" again:</div>
                            <div className="form-check form-switch mb-2">
                                <input className="form-check-input" type="checkbox" checked={demoMode.helmet} onChange={(e) => setDemoMode({ ...demoMode, helmet: e.target.checked })} />
                                <label className="form-check-label text-white small">Toggle Helmet</label>
                            </div>
                            <div className="form-check form-switch mb-2">
                                <input className="form-check-input" type="checkbox" checked={demoMode.mask} onChange={(e) => setDemoMode({ ...demoMode, mask: e.target.checked })} />
                                <label className="form-check-label text-white small">Toggle Mask</label>
                            </div>
                            <div className="form-check form-switch">
                                <input className="form-check-input" type="checkbox" checked={demoMode.vest} onChange={(e) => setDemoMode({ ...demoMode, vest: e.target.checked })} />
                                <label className="form-check-label text-white small">Toggle Vest</label>
                            </div>
                        </div>

                        {/* Incident Log History */}
                        <div className="mt-4 pt-3 border-top border-secondary">
                            <h6 className="mb-3 text-muted">Recent Incidents</h6>
                            <div className="log-history" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {logs.length === 0 ? (
                                    <div className="text-center small text-muted py-3">No recent incidents. Great job! 🎉</div>
                                ) : (
                                    <ul className="list-group list-group-flush bg-transparent">
                                        {logs.map(log => (
                                            <li key={log.id} className="list-group-item bg-transparent text-white-50 p-2 small border-bottom border-dark">
                                                <div className="d-flex justify-content-between text-white">
                                                    <span className="fw-bold text-danger">{log.incidentType}</span>
                                                    <span className="text-danger fw-bold">{log.safetyScore}</span>
                                                </div>
                                                <div className="d-flex justify-content-between mt-1" style={{ fontSize: '0.7rem' }}>
                                                    <span>Helmet: {log.helmet ? '✅' : '❌'} Mask: {log.mask ? '✅' : '❌'} Vest: {log.vest ? '✅' : '❌'}</span>
                                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
