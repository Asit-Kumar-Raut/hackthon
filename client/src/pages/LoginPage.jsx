/**
 * Login Page - Employee ID and Password, JWT login
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Container, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './AuthPages.css';

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const roleHint = searchParams.get('role'); // employee | head

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
    try {
      const userData = await login(employeeId.trim(), password);
      if (userData.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (userData.role === 'head') navigate('/head/dashboard', { replace: true });
      else navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <motion.div
      className="auth-page min-vh-100 d-flex align-items-center justify-content-center"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container className="auth-container">
        <motion.h2
          className="auth-title mb-4"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Login
          {roleHint && (
            <span className="text-muted ms-2" style={{ fontSize: '0.9rem' }}>
              ({roleHint === 'employee' ? 'Employee' : 'Head Employee'})
            </span>
          )}
        </motion.h2>

        {error && (
          <Alert variant="danger" onClose={() => setError('')} dismissible>
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Employee ID</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="form-control-custom"
              required
            />
          </Form.Group>
          <Form.Group className="mb-4">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control-custom"
              required
            />
          </Form.Group>
          <motion.div className="d-flex flex-column gap-2" whileHover={{ x: 2 }}>
            <Button type="submit" className="btn-outline-red w-100">
              Sign In
            </Button>
            <Link to="/register" className="text-center text-white-50">
              Don&apos;t have an account? Register here
            </Link>
          </motion.div>
        </Form>
      </Container>
    </motion.div>
  );
}
