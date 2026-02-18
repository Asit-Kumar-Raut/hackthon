/**
 * Socket.io handlers for real-time updates (posture alerts, crowd alerts)
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { JWT_SECRET } = require('./auth');

/**
 * Setup socket connection, auth, and event handlers
 */
function setupSocketHandlers(socket, io) {
  // Optional: authenticate via token from handshake
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
    } catch (err) {
      // Allow connection without auth for public events; protect in handlers if needed
    }
  }

  socket.on('join_employee_room', (employeeId) => {
    socket.join(`employee:${employeeId}`);
  });

  socket.on('join_head_room', () => {
    socket.join('head_dashboard');
  });

  socket.on('disconnect', () => {
    // Cleanup if needed
  });
}

/**
 * Emit posture alert to specific employee (called from API)
 */
function emitPostureAlert(io, employeeId, data) {
  io.to(`employee:${employeeId}`).emit('posture_alert', data);
}

/**
 * Emit crowd alert to head dashboard (called from API)
 */
function emitCrowdAlert(io, data) {
  io.to('head_dashboard').emit('crowd_alert', data);
}

module.exports = {
  setupSocketHandlers,
  emitPostureAlert,
  emitCrowdAlert,
};
