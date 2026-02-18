/**
 * Employee Dashboard - Posture monitoring, daily score, badge, history
 * Tab/link to Posture Correction page with Start/End monitoring
 */

import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import PostureMonitor from '../components/PostureMonitor/PostureMonitor';
import api from '../services/api';
import './DashboardPages.css';

export default function EmployeeDashboardPage({ defaultTab }) {
  const { user } = useAuth();
  const location = useLocation();
  const isPosturePage = location.pathname === '/employee/posture' || defaultTab === 'posture';
  const [postureData, setPostureData] = useState({ logs: [], dailyScore: 0, goodCount: 0, badCount: 0 });

  useEffect(() => {
    if (!user?.employeeId) return;
    api
      .get('/api/posture/data')
      .then((res) => setPostureData(res.data))
      .catch(() => {});
  }, [user?.employeeId]);

  const badgeLevel = Math.min(5, Math.floor((postureData.dailyScore ?? 0) / 20) + 1);

  return (
    <div className="dashboard-page employee-dashboard">
      <Navbar className="dashboard-navbar" expand="md">
        <Container fluid>
          <Navbar.Brand className="text-white">Employee Dashboard</Navbar.Brand>
          <Navbar.Toggle aria-controls="nav" />
          <Navbar.Collapse id="nav">
            <Nav className="me-auto">
              <Nav.Link
                as={Link}
                to="/employee/dashboard"
                className={!isPosturePage ? 'active text-white' : 'text-white-50'}
              >
                Overview
              </Nav.Link>
              <Nav.Link
                as={Link}
                to="/employee/posture"
                className={isPosturePage ? 'active text-white' : 'text-white-50'}
              >
                Posture Correction
              </Nav.Link>
            </Nav>
            <span className="text-white-50 me-3">{user?.name} ({user?.employeeId})</span>
            <LogoutButton />
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid className="py-4">
        {!isPosturePage && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h4 className="text-white mb-4">Posture Overview</h4>
            <div className="row g-3 mb-4">
              <motion.div className="col-md-4" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
                <div className="dashboard-card text-center">
                  <div className="text-muted small">Daily Score</div>
                  <div className="display-5 text-white">{postureData.dailyScore ?? 0}</div>
                </div>
              </motion.div>
              <motion.div className="col-md-4" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
                <div className="dashboard-card text-center">
                  <div className="text-muted small">Badge Level</div>
                  <div className="display-5 text-warning">Level {badgeLevel}</div>
                </div>
              </motion.div>
              <motion.div className="col-md-4" whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300 }}>
                <div className="dashboard-card text-center">
                  <div className="text-muted small">Today (Good / Bad)</div>
                  <div className="text-success">{postureData.goodCount ?? 0}</div>
                  <div className="text-danger">{postureData.badCount ?? 0}</div>
                </div>
              </motion.div>
            </div>
            <motion.div
              className="dashboard-card p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h6 className="text-white mb-3">Posture Correction</h6>
              <p className="text-white-50 mb-3">
                Go to the Posture Correction page to start or end your posture monitoring session. Use Start to begin monitoring and End when you finish work.
              </p>
              <Link to="/employee/posture" className="btn-outline-red btn btn-sm">
                Open Posture Correction
              </Link>
            </motion.div>
          </motion.div>
        )}

        {isPosturePage && (
          <motion.div
            key="posture"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h4 className="text-white mb-4">Posture Correction</h4>
            <PostureMonitor />
          </motion.div>
        )}
      </Container>
    </div>
  );
}
