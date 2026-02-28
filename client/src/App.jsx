/**
 * App.jsx - All routes, protected routes, role-based redirection, Auth Provider wrapper
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { ProtectedRoute } from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterEmployeePage from './pages/RegisterEmployeePage';
import EmployeeDashboardPage from './pages/EmployeeDashboardPage';
import HeadDashboardPage from './pages/HeadDashboardPage';
import RestrictedAreaPage from './pages/RestrictedAreaPage';

import { useAuth } from './context/AuthContext';
import GlobalLoader from './components/GlobalLoader/GlobalLoader';

export default function App() {
  const location = useLocation();
  const { loading } = useAuth();
  const [showLoader, setShowLoader] = React.useState(true);

  React.useEffect(() => {
    if (!loading) {
      // Impose a baseline dramatic viewing time for the AI Core loader
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <AnimatePresence mode="wait">
      {showLoader ? (
        <GlobalLoader key="global-loader" />
      ) : (
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterEmployeePage />} />

          <Route
            path="/employee/dashboard"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeeDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/posture"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeeDashboardPage defaultTab="posture" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/safety"
            element={
              <ProtectedRoute requiredRole="employee">
                <EmployeeDashboardPage defaultTab="safety" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/head/dashboard"
            element={
              <ProtectedRoute requiredRole="head">
                <HeadDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/head/restricted-area"
            element={
              <ProtectedRoute requiredRole="head">
                <RestrictedAreaPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AnimatePresence>
  );
}
