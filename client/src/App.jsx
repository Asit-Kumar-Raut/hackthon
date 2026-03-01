/**
 * App.jsx - All routes, protected routes, role-based redirection,
 * Auth Provider wrapper + Unauthorized Alert Button integration
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import { ProtectedRoute } from './components/ProtectedRoute';
import AlertButton from './components/AlertButton'; // 🚨 IMPORT ALERT BUTTON

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


          {/* PUBLIC ROUTES */}

          <Route path="/" element={<LandingPage />} />

          <Route path="/login" element={<LoginPage />} />

          <Route path="/register" element={<RegisterEmployeePage />} />


          {/* EMPLOYEE ROUTES */}

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


          {/* HEAD ROUTES */}

          <Route
            path="/head/dashboard"
            element={
              <ProtectedRoute requiredRole="head">
                <HeadDashboardPage />
              </ProtectedRoute>
            }
          />


          {/* 🚨 RESTRICTED AREA ROUTE WITH ALERT BUTTON */}

          <Route
            path="/head/restricted-area"
            element={
              <ProtectedRoute requiredRole="head">

                <div style={{ position: "relative" }}>

                  {/* Restricted Area Page */}
                  <RestrictedAreaPage />

                  {/* Floating Alert Button */}
                  <div
                    style={{
                      position: "fixed",
                      bottom: "25px",
                      right: "25px",
                      zIndex: 9999
                    }}
                  >
                    <AlertButton />
                  </div>

                </div>

              </ProtectedRoute>
            }
          />


          {/* DEFAULT FALLBACK */}

          <Route path="*" element={<Navigate to="/" replace />} />


        </Routes>

      )}

    </AnimatePresence>

  );

}