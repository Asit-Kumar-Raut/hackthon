/**
 * Landing Page - Premium AI Monitoring System entry point
 * Title + two large buttons with futuristic red-black theme
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './LandingPage.css';

const features = [
  'safety gear',
  'Real-time Alerts',
  'YOLO restricted area detection and safety detection',
  'Firebase Firestore',
  'Socket.io Live Sync',
];

export default function LandingPage() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  return (
    <motion.div
      className="landing-page min-vh-100 d-flex flex-column align-items-center justify-content-center px-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="landing-content text-center w-100"
        style={{ maxWidth: 700 }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Brand label */}
        <motion.div className="landing-brand" variants={itemVariants}>
          INDUSTRI safty Monitoring System
        </motion.div>

        {/* Main title */}
        <motion.h1 className="landing-title" variants={itemVariants}>
          INDUSTRI safty<br />Monitoring System
        </motion.h1>

        {/* Subtitle */}
        <motion.p className="landing-subtitle" variants={itemVariants}>
          INDUSTRI safty Monitoring System
        </motion.p>

        {/* Red divider */}
        <motion.div className="landing-divider" variants={itemVariants} />

        {/* CTA Buttons */}
        <motion.div
          className="d-flex flex-column flex-sm-row gap-4 justify-content-center align-items-center"
          variants={itemVariants}
        >
          <motion.button
            id="btn-employee-login"
            type="button"
            className="landing-btn"
            onClick={() => navigate('/login?role=employee')}
            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(255, 0, 0, 0.65)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="landing-btn-icon">👨‍💻</span>
            <span className="landing-btn-label">employee</span>
          </motion.button>

          <motion.button
            id="btn-head-login"
            type="button"
            className="landing-btn"
            onClick={() => navigate('/login?role=head')}
            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(255, 0, 0, 0.65)' }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="landing-btn-icon">🛡️</span>
            <span className="landing-btn-label">maneger</span>
          </motion.button>
        </motion.div>

        {/* Feature pills */}
        <motion.div className="landing-features" variants={itemVariants}>
          {features.map((f) => (
            <span key={f} className="feature-pill">
              <span className="feature-pill-dot" />
              {f}
            </span>
          ))}
        </motion.div>

        {/* Register link */}
        <motion.p
          className="mt-4"
          style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}
          variants={itemVariants}
        >
          New user?{' '}
          <a href="/register" style={{ color: 'rgba(255,80,80,0.8)' }}>
            Register here
          </a>
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
