/**
 * Head Employee Dashboard - Crowd detection, CCTV feed, alerts, notifications
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Container, Navbar, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import CrowdDetector from '../components/CrowdDetector/CrowdDetector';
import CrowdAnalytics from '../components/CrowdDetector/CrowdAnalytics';
import api from '../services/api';
import './DashboardPages.css';

export default function HeadDashboardPage() {
  const { user } = useAuth();
  const [crowdLogs, setCrowdLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showRedBanner, setShowRedBanner] = useState(false);

  useEffect(() => {
    loadCrowdData();
    const interval = setInterval(loadCrowdData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadCrowdData = () => {
    api
      .get('/api/crowd/data')
      .then((res) => {
        setCrowdLogs(res.data.logs || []);
        const recentAlerts = (res.data.logs || []).filter((l) => l.alertTriggered || l.restrictedViolation);
        setAlerts(recentAlerts.slice(0, 20));
        setShowRedBanner(recentAlerts.some((l) => new Date(l.createdAt) > new Date(Date.now() - 60000)));
      })
      .catch(() => {});
  };

  return (
    <div className="dashboard-page head-dashboard">
      <Navbar className="dashboard-navbar" expand="md">
        <Container fluid>
          <Navbar.Brand className="text-white">Head Employee Dashboard</Navbar.Brand>
          <Navbar.Collapse className="justify-content-end">
            <span className="text-white-50 me-3">{user?.name} ({user?.employeeId})</span>
            <LogoutButton />
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {showRedBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="alert-banner"
        >
          <Alert variant="danger" className="mb-0 rounded-0 text-center">
            <strong>Crowd / Restricted Area Alert</strong> — Check the feed and alert history.
          </Alert>
        </motion.div>
      )}

      <Container fluid className="py-4">
        <h4 className="text-white mb-4">Crowd Monitoring</h4>
        <CrowdDetector
          onAlert={() => {
            setShowRedBanner(true);
            loadCrowdData();
          }}
          onLog={loadCrowdData}
        />
        <CrowdAnalytics logs={crowdLogs} />
        <motion.div
          className="dashboard-card mt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h6 className="text-white mb-3">Alert History</h6>
          <div className="alert-history-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {alerts.length === 0 && <div className="text-muted small">No alerts yet.</div>}
            {alerts.map((log, i) => (
              <div key={log._id || i} className="d-flex justify-content-between py-2 border-bottom border-secondary">
                <span className="text-white-50">
                  Count: {log.detectedCount} | Violation: {log.restrictedViolation ? 'Yes' : 'No'} | Alert: {log.alertTriggered ? 'Yes' : 'No'}
                </span>
                <span className="text-muted small">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
