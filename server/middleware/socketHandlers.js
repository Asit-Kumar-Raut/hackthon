/**
 * Socket.io handlers for real-time updates (posture alerts, crowd alerts)
 * Uses Firebase Admin to verify socket tokens
 */

const { admin } = require('../firebase/config');

/**
 * Setup socket connection, auth, and event handlers
 */
function setupSocketHandlers(socket, io) {
  // Optional: authenticate via Firebase token from handshake
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    admin.auth().verifyIdToken(token)
      .then((decoded) => {
        socket.firebaseUid = decoded.uid;
      })
      .catch(() => {
        // Allow unauthenticated connections; protect socket events if needed
      });
  }

  // Employee joins their personal room for posture alerts
  socket.on('join_employee_room', (employeeId) => {
    socket.join(`employee:${employeeId}`);
  });

  // Head employee joins the head dashboard room
  socket.on('join_head_room', () => {
    socket.join('head_dashboard');
  });

  socket.on('disconnect', () => {
    // Cleanup handled automatically by Socket.io
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

/**
 * Emit posture score update to specific employee
 */
function emitScoreUpdate(io, employeeId, data) {
  io.to(`employee:${employeeId}`).emit('score_update', data);
}

module.exports = {
  setupSocketHandlers,
  emitPostureAlert,
  emitCrowdAlert,
  emitScoreUpdate,
};
