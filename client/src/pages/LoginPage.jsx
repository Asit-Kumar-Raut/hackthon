/**
 * Login Page - Employee ID & Password login
 * Redirects after auth based on role
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const roleHint = searchParams.get('role'); // 'employee' | 'head'

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (user.role === 'head') navigate('/head/dashboard', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await login(employeeId.trim(), password);
      if (userData.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (userData.role === 'head') navigate('/head/dashboard', { replace: true });
      else navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-page min-vh-100 d-flex align-items-center justify-content-center px-3"
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
          <h2 className="auth-title">
            Sign In
            {roleHint && (
              <span className="auth-role-badge">
                {roleHint === 'employee' ? 'employee' : 'maneger'}
              </span>
            )}
          </h2>
          <p className="auth-subtitle">Enter your credentials to access the dashboard</p>
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
            <label htmlFor="login-emp-id" className="form-label">Employee ID</label>
            <input
              id="login-emp-id"
              type="text"
              className="form-control form-control-custom"
              placeholder="e.g. EMP001"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-control form-control-custom"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <motion.button
            id="btn-login-submit"
            type="submit"
            className="btn-outline-red w-100 mb-3"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            {loading ? (
              <span className="d-flex align-items-center justify-content-center gap-2">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </motion.button>

          <p className="text-center mb-0" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)' }}>
            No account yet?{' '}
            <Link to="/register" style={{ color: 'rgba(255,80,80,0.8)' }}>
              Register here
            </Link>
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
}
