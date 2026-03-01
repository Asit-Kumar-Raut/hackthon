/**
 * AI Smart Posture & Crowd Monitoring System - Backend Server
 * Entry point: Express + Firebase Firestore + Socket.io
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Initialize Firebase Admin SDK
require('./firebase/config');

const authRoutes = require('./routes/auth');
const postureRoutes = require('./routes/posture');
const crowdRoutes = require('./routes/crowd');
const { authenticateToken } = require('./middleware/auth');
const { setupSocketHandlers } = require('./middleware/socketHandlers');

const app = express();
const httpServer = http.createServer(app);

// Socket.io with CORS for client origin
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Make io available to routes (for real-time updates)
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posture', authenticateToken, postureRoutes);
app.use('/api/crowd', authenticateToken, crowdRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI Smart Monitoring API' });
});

// Socket connection & handlers
io.on('connection', (socket) => {
  setupSocketHandlers(socket, io);
});

const PORT = process.env.PORT || 5000;

// handle listen errors (EADDRINUSE etc.) with a clear message
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Make sure no other server instance is running or change the PORT environment variable.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
