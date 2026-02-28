/**
 * ProtectedRoute - Redirects to login if not authenticated
 * Shows loading spinner while checking auth state
 * Role-based redirect: employee → Employee Dashboard, head → Head Dashboard
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading while Firebase Auth initializes
  if (loading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center min-vh-100"
        style={{ background: '#000', gap: '16px' }}
      >
        <div className="spinner-red" />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Authenticating…</span>
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login${requiredRole ? `?role=${requiredRole}` : ''}`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Wrong role → redirect to correct dashboard
  if (requiredRole && user?.role !== requiredRole) {
    if (user?.role === 'employee') return <Navigate to="/employee/dashboard" replace />;
    if (user?.role === 'head') return <Navigate to="/head/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}
