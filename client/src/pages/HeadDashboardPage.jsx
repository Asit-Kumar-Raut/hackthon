/**
 * Head Employee Dashboard - Crowd monitoring, CCTV feed, alerts, Socket.io
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Container } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import CrowdDetector from '../components/CrowdDetector/CrowdDetector';
import CrowdAnalytics from '../components/CrowdDetector/CrowdAnalytics';
import NotificationPanel, { pushNotification } from '../components/NotificationPanel';
import { crowdService } from '../services/firestoreService';
import { io } from 'socket.io-client';
import './DashboardPages.css';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ALERT_TIMEOUT_MS = 90000; // Red banner stays 90s after last alert

export default function HeadDashboardPage() {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const alertTimeoutRef = useRef(null);

  const [crowdLogs, setCrowdLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showRedBanner, setShowRedBanner] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [isViolation, setIsViolation] = useState(false);

  // Load crowd data on mount and every 15s
  useEffect(() => {
    loadCrowdData();
    const interval = setInterval(loadCrowdData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Socket.io for real-time crowd alerts from backend
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_head_room');
    });

    socket.on('crowd_alert', (data) => {
      pushNotification(data?.message || '🚨 Crowd/Restricted Area Alert!', 'alert');
      triggerAlert();
      loadCrowdData(); // refresh logs
    });

    socket.on('connect_error', () => { });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const loadCrowdData = async () => {
    try {
      const logs = await crowdService.getCrowdLogs(200);
      setCrowdLogs(logs);
      const recentAlerts = logs.filter((l) => l.alertTriggered || l.restrictedViolation);
      setAlerts(recentAlerts.slice(0, 20));
      // Check if any alert is within the last 90 seconds
      const toDate = (l) => l?.createdAt ? new Date(l.createdAt) : l?.timestamp ? new Date(l.timestamp) : null;
      const hasRecent = recentAlerts.some((l) => {
        const d = toDate(l);
        return d && d > new Date(Date.now() - ALERT_TIMEOUT_MS);
      });
      if (hasRecent) triggerAlert();
    } catch (err) {
      console.error('Failed to load crowd data:', err);
    }
  };

  const triggerAlert = () => {
    setShowRedBanner(true);
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    alertTimeoutRef.current = setTimeout(() => setShowRedBanner(false), ALERT_TIMEOUT_MS);
  };

  const handleCrowdLog = (data) => {
    loadCrowdData();
    if (data) {
      setLiveCount(data.count ?? 0);
      setIsViolation(data.violation ?? false);
    }
  };

  const handleCrowdAlert = (data) => {
    triggerAlert();
    pushNotification('🚨 Restricted Area Violation Detected!', 'alert');
    loadCrowdData();
  };

  return (
    <div className="dashboard-page head-dashboard">
      <NotificationPanel />

      {/* Navbar */}
      <nav className="dashboard-navbar d-flex align-items-center gap-3">
        <span className="navbar-brand me-auto">
          maneger(head employee) dash board
        </span>

        {/* Nav tabs */}
        <div className="d-none d-md-flex gap-1">
          <Link
            to="/head/dashboard"
            className="nav-link active"
          >
            Crowd Dashboard
          </Link>
          <Link
            to="/head/restricted-area"
            className="nav-link"
          >
            Restricted Area
          </Link>
        </div>

        <span className="user-chip d-none d-md-inline-flex">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          {user?.name} · {user?.employeeId}
        </span>
        <LogoutButton />
      </nav>

      {/* Red Alert Banner */}
      <AnimatePresence>
        {showRedBanner && (
          <motion.div
            className="alert-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="alert mb-0 text-center">
              <strong>🚨 Crowd / Restricted Area Alert</strong> — Violation detected. Check the camera feed and alert log below.
              <button
                type="button"
                onClick={() => setShowRedBanner(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,128,128,0.7)', cursor: 'pointer', marginLeft: 12 }}
                aria-label="Dismiss alert banner"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Container fluid className="py-4">
        {/* Live stats row */}
        <div className="row g-3 mb-4">
          <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
            <div className="dashboard-card text-center">
              <div className="stat-label">Live Count</div>
              <div className="stat-number" style={{ color: liveCount > 3 ? '#FF0000' : '#22c55e' }}>
                {liveCount}
              </div>
            </div>
          </motion.div>
          <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
            <div className="dashboard-card text-center">
              <div className="stat-label">Status</div>
              <div className="stat-number" style={{ fontSize: '1.5rem', color: isViolation ? '#FF0000' : '#22c55e' }}>
                {isViolation ? '⚠️ VIOLATION' : '✅ CLEAR'}
              </div>
            </div>
          </motion.div>
          <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
            <div className="dashboard-card text-center">
              <div className="stat-label">Total Alerts Today</div>
              <div className="stat-number" style={{ color: '#FF0000' }}>{alerts.length}</div>
            </div>
          </motion.div>
          <motion.div className="col-6 col-md-3" whileHover={{ scale: 1.02 }}>
            <div className="dashboard-card text-center">
              <div className="stat-label">Logs Today</div>
              <div className="stat-number" style={{ color: '#fff' }}>{crowdLogs.length}</div>
            </div>
          </motion.div>
        </div>

        {/* Camera + Detection */}
        <div className="section-header mb-3">
          <span>📹</span> Crowd Detection Camera
        </div>
        <CrowdDetector
          onAlert={handleCrowdAlert}
          onLog={handleCrowdLog}
        />

        {/* Analytics */}
        <CrowdAnalytics logs={crowdLogs} />

        {/* Alert Log */}
        <motion.div
          className="dashboard-card mt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="section-header mb-3">
            <span>📋</span> Alert History
            {alerts.length > 0 && (
              <span className="ms-2 badge" style={{
                background: 'rgba(255,0,0,0.2)',
                border: '1px solid rgba(255,0,0,0.4)',
                color: '#FF0000',
                borderRadius: 99,
                padding: '2px 10px',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}>
                {alerts.length}
              </span>
            )}
          </div>

          <div className="alert-history-list">
            {alerts.length === 0 ? (
              <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem' }}>
                No alerts recorded yet. Violations will appear here.
              </div>
            ) : (
              alerts.map((log, i) => {
                const at = log.createdAt ? new Date(log.createdAt) : log.timestamp ? new Date(log.timestamp) : null;
                return (
                  <div key={log._id ?? log.id ?? i} className="alert-history-item">
                    <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem' }}>
                      <span style={{ color: '#FF0000', marginRight: 6 }}>⚠️</span>
                      Count: <strong>{log.detectedCount}</strong>
                      <span className="mx-2">·</span>
                      Violation: <strong style={{ color: log.restrictedViolation ? '#FF0000' : '#22c55e' }}>
                        {log.restrictedViolation ? 'YES' : 'No'}
                      </strong>
                      {log.recordedBy && (
                        <><span className="mx-2">·</span>By: {log.recordedBy}</>
                      )}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {at ? at.toLocaleString() : '—'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
