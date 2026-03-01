/**
 * Register Page - Create employee or head employee account
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

export default function RegisterEmployeePage() {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (user.role === 'head') navigate('/head/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!employeeId.trim()) {
      setError('Employee ID is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setLoading(true);
    try {
      const userData = await register(employeeId.trim(), name.trim(), email.trim(), password, role);
      if (userData.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (userData.role === 'head') navigate('/head/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-page min-vh-100 d-flex align-items-center justify-content-center px-3 py-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="auth-container"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {/* Header */}
        <div className="mb-4">
          <h2 className="auth-title">Create Account</h2>
          <p className="auth-subtitle">Register to access the AI monitoring system</p>
          <div className="auth-divider" />
        </div>

        {/* Error */}
        {error && (
          <motion.div
            className="alert alert-danger d-flex align-items-center gap-2 mb-3"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="reg-emp-id" className="form-label">Employee ID</label>
            <input
              id="reg-emp-id"
              type="text"
              className="form-control form-control-custom"
              placeholder="e.g. EMP001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="reg-name" className="form-label">Full Name</label>
            <input
              id="reg-name"
              type="text"
              className="form-control form-control-custom"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="reg-email" className="form-label">Email (Mandatory – used for alerts)</label>
            <input
              id="reg-email"
              type="email"
              className="form-control form-control-custom"
              placeholder="e.g. user@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="reg-role" className="form-label">Role</label>
            <select
              id="reg-role"
              className="form-select form-control-custom"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="employee">employee</option>
              <option value="head">maneger</option>
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="reg-password" className="form-label">Password</label>
            <input
              id="reg-password"
              type="password"
              className="form-control form-control-custom"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="reg-confirm-password" className="form-label">Confirm Password</label>
            <input
              id="reg-confirm-password"
              type="password"
              className="form-control form-control-custom"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <motion.button
            id="btn-register-submit"
            type="submit"
            className="btn-outline-red w-100 mb-3"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            {loading ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </motion.button>

          <p className="text-center mb-0" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'rgba(255,80,80,0.8)' }}>
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
}
