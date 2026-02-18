/**
 * Auth Context - JWT, user state, login, register, logout
 * Wraps app for role-based access and protected routes
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Optionally validate token and set user from backend
      api
        .get('/api/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const login = async (employeeId, password) => {
    const res = await api.post('/api/auth/login', { employeeId, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return userData;
  };

  const register = async (employeeId, name, password, role) => {
    const res = await api.post('/api/auth/register', { employeeId, name, password, role });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isEmployee: user?.role === 'employee',
    isHead: user?.role === 'head',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
