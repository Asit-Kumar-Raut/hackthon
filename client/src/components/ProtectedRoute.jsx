/**
 * ProtectedRoute - Redirects to login if not authenticated
 * Role-based redirect: employee -> EmployeeDashboard, head -> HeadDashboard
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to correct dashboard by role
    if (user?.role === 'employee') return <Navigate to="/employee/dashboard" replace />;
    if (user?.role === 'head') return <Navigate to="/head/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}
