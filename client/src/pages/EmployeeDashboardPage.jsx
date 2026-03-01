/**
 * Employee Dashboard - Posture monitoring, real-time score, badge, history
 * Integrates Socket.io for live score updates from backend
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Container } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import PostureMonitor from '../components/PostureMonitor/PostureMonitor';
import SafetyGearMonitor from '../components/SafetyGearMonitor/SafetyGearMonitor';
import NotificationPanel, { pushNotification } from '../components/NotificationPanel';
import { postureService } from '../services/firestoreService';
import { io } from 'socket.io-client';
import './DashboardPages.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function EmployeeDashboardPage({ defaultTab }) {
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const socketRef = useRef(null);
  const isPosturePage = location.pathname === '/employee/posture' || defaultTab === 'posture';
  const isSafetyPage = location.pathname === '/employee/safety' || defaultTab === 'safety';

  const [postureData, setPostureData] = useState({ logs: [], goodCount: 0, badCount: 0 });
  const [liveScore, setLiveScore] = useState(user?.score ?? 0);
  const [liveBadge, setLiveBadge] = useState(user?.badgeLevel ?? 1);
  const [navOpen, setNavOpen] = useState(false);

  // Load initial posture data
  useEffect(() => {
    if (!user?.employeeId) return;
    loadData();
  }, [user?.employeeId]);

  // Sync live score/badge whenever user refreshes
  useEffect(() => {
    if (user) {
      setLiveScore(user.score ?? 0);
      setLiveBadge(user.badgeLevel ?? 1);
    }
  }, [user?.score, user?.badgeLevel]);

  // Socket.io connection for real-time score updates
  useEffect(() => {
    if (!user?.employeeId) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_employee_room', user.employeeId);
    });

    // Live score update from backend
    socket.on('score_update', (data) => {
      if (data.employeeId === user.employeeId) {
        setLiveScore(data.score ?? 0);
        setLiveBadge(data.badgeLevel ?? 1);
      }
    });

    // Posture alert from backend
    socket.on('posture_alert', (data) => {
      pushNotification(data?.message || 'Posture alert triggered!', 'alert');
    });

    socket.on('disconnect', () => { });
    socket.on('connect_error', () => { });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.employeeId]);

  const loadData = async () => {
    try {
      const logs = await postureService.getPostureLogs(user.employeeId, 500);
      const goodCount = logs.filter((l) => l.postureStatus === 'good').length;
      const badCount = logs.filter((l) => l.postureStatus === 'bad').length;
      setPostureData({ logs, goodCount, badCount });
    } catch (err) {
      console.error('Failed to load posture data:', err);
    }
  };

  const badgeInfo = [
    { level: 1, label: 'Beginner', color: '#888', min: 0, max: 19 },
    { level: 2, label: 'Good', color: '#22c55e', min: 20, max: 39 },
    { level: 3, label: 'Great', color: '#3b82f6', min: 40, max: 59 },
    { level: 4, label: 'Expert', color: '#f59e0b', min: 60, max: 79 },
    { level: 5, label: 'Master', color: '#FF0000', min: 80, max: 999 },
  ];
  const currentBadge = badgeInfo.find((b) => b.level === liveBadge) || badgeInfo[0];

  return (
    <div className="dashboard-page employee-dashboard">
      <NotificationPanel />

      {/* Navbar */}
      <nav className="dashboard-navbar d-flex align-items-center gap-3">
        <span className="navbar-brand me-auto">
          🖥️ Employee Dashboard
        </span>

        {/* Nav tabs */}
        <div className="d-none d-md-flex gap-1">
          <Link
            to="/employee/dashboard"
            className={`nav-link ${(!isPosturePage && !isSafetyPage) ? 'active' : ''}`}
          >
            Overview
          </Link>
          <Link
            to="/employee/safety"
            className={`nav-link ${isSafetyPage ? 'active' : ''}`}
          >
            Safety Gear
          </Link>
        </div>

        {/* User chip */}
        <span className="user-chip d-none d-md-inline-flex">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          {user?.name} · {user?.employeeId}
        </span>

        <LogoutButton />
      </nav>

      <Container fluid className="py-4">
        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {(!isPosturePage && !isSafetyPage) && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="section-header">
                <span>📈</span> Posture Overview
              </div>

              <div className="row g-3 mb-4">
                {/* Score card */}
                <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
                  <div className="dashboard-card text-center">
                    <div className="stat-label">Daily Score</div>
                    <div className="stat-number" style={{ color: '#FF0000' }}>{liveScore}</div>
                  </div>
                </motion.div>

                {/* Badge card */}
                <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
                  <div className="dashboard-card text-center">
                    <div className="stat-label">Badge Level</div>
                    <div className="stat-number" style={{ color: currentBadge.color }}>Lv.{liveBadge}</div>
                    <div style={{ fontSize: '0.75rem', color: currentBadge.color, marginTop: 4 }}>
                      {currentBadge.label}
                    </div>
                  </div>
                </motion.div>

                {/* Good posture */}
                <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
                  <div className="dashboard-card text-center">
                    <div className="stat-label">Good Posture (Today)</div>
                    <div className="stat-number" style={{ color: '#22c55e' }}>{postureData.goodCount}</div>
                  </div>
                </motion.div>

                {/* Bad posture */}
                <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
                  <div className="dashboard-card text-center">
                    <div className="stat-label">Bad Posture (Today)</div>
                    <div className="stat-number" style={{ color: '#FF0000' }}>{postureData.badCount}</div>
                  </div>
                </motion.div>
              </div>

              {/* Badge Progress */}
              <motion.div
                className="dashboard-card mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Badge Progress</span>
                  <span style={{ fontSize: '0.85rem', color: currentBadge.color, fontWeight: 600 }}>
                    {currentBadge.label} → {badgeInfo[Math.min(4, liveBadge)].label}
                  </span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                  <motion.div
                    style={{
                      height: '100%',
                      background: `linear-gradient(90deg, #FF0000, ${currentBadge.color})`,
                      borderRadius: 6,
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, ((liveScore - currentBadge.min) / (currentBadge.max - currentBadge.min + 1)) * 100)}%`,
                    }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="d-flex justify-content-between mt-1">
                  {badgeInfo.map((b) => (
                    <span
                      key={b.level}
                      style={{
                        fontSize: '0.65rem',
                        color: liveBadge >= b.level ? b.color : 'rgba(255,255,255,0.2)',
                        fontWeight: liveBadge === b.level ? 700 : 400,
                      }}
                    >
                      Lv.{b.level}
                    </span>
                  ))}
                </div>
              </motion.div>



              {/* CTA to Safety page */}
              <motion.div
                className="dashboard-card mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <div className="section-header">
                  <span>🦺</span> Safety Gear Detection
                </div>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Use AI object detection to ensure compliance with personal protective equipment (PPE) standards. Real-time alerts for missing Hard Hats, Masks, and Vests.
                </p>
                <Link to="/employee/safety" className="btn-outline-red">
                  Start Safety Gear Detection →
                </Link>
              </motion.div>
            </motion.div>
          )}

          {/* Posture Correction Tab */}
          {isPosturePage && (
            <motion.div
              key="posture"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="section-header">
                <span>📹</span> Posture Correction
              </div>
              <PostureMonitor onScoreUpdate={(score, badge) => {
                setLiveScore(score);
                setLiveBadge(badge);
              }} />
            </motion.div>
          )}

          {/* Safety Gear Tab */}
          {isSafetyPage && (
            <motion.div
              key="safety"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="section-header">
                <span>🦺</span> Safety Gear Detection Monitor
              </div>
              <SafetyGearMonitor onScoreUpdate={(score) => {
                setLiveScore(score);
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </div>
  );
}
