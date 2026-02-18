/**
 * Landing Page - Title and two large buttons: Employee, Head Employee (Server)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Container } from 'react-bootstrap';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="landing-page min-vh-100 d-flex flex-column align-items-center justify-content-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Container className="text-center">
        <motion.h1
          className="landing-title mb-5"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          AI-Based Smart Monitoring System
        </motion.h1>

        <motion.div
          className="d-flex flex-column flex-sm-row gap-4 justify-content-center align-items-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <motion.button
            type="button"
            className="landing-btn"
            onClick={() => navigate('/login?role=employee')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255, 0, 0, 0.7)' }}
            whileTap={{ scale: 0.98 }}
          >
            Employee
          </motion.button>
          <motion.button
            type="button"
            className="landing-btn"
            onClick={() => navigate('/login?role=head')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255, 0, 0, 0.7)' }}
            whileTap={{ scale: 0.98 }}
          >
            Head Employee (Server)
          </motion.button>
        </motion.div>
      </Container>
    </motion.div>
  );
}
