/**
 * LogoutButton - Logout and redirect to landing
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export function LogoutButton({ className = '' }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <motion.button
      type="button"
      className={`btn btn-outline-red ${className}`}
      onClick={handleLogout}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      Logout
    </motion.button>
  );
}
