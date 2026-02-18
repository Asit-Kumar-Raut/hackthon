/**
 * RegisterEmployee Page - Dedicated registration: employeeId, name, password, role
 * Password stored securely (bcrypt on backend)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Container, Form, Button, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './AuthPages.css';

export default function RegisterEmployeePage() {
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

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
    try {
      const userData = await register(employeeId.trim(), name.trim(), password, role);
      if (userData.role === 'employee') navigate('/employee/dashboard', { replace: true });
      else if (userData.role === 'head') navigate('/head/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <motion.div
      className="auth-page min-vh-100 d-flex align-items-center justify-content-center py-5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Container className="auth-container">
        <motion.h2 className="auth-title mb-4" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          Register Employee
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
          <Form.Group className="mb-3">
            <Form.Label>Full Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-control-custom"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control-custom"
              required
              minLength={6}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-control-custom"
              required
            />
          </Form.Group>
          <Form.Group className="mb-4">
            <Form.Label>Role</Form.Label>
            <Form.Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-control-custom"
            >
              <option value="employee">Employee</option>
              <option value="head">Head Employee</option>
            </Form.Select>
          </Form.Group>
          <motion.div className="d-flex flex-column gap-2">
            <Button type="submit" className="btn-outline-red w-100">
              Register
            </Button>
            <Link to="/login" className="text-center text-white-50">
              Already have an account? Login here
            </Link>
          </motion.div>
        </Form>
      </Container>
    </motion.div>
  );
}
