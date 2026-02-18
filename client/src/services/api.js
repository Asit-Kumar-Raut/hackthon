/**
 * Axios API client - base URL and auth header
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;
