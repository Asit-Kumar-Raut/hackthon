const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Note: Registration and login are now handled by Firebase Auth on the frontend
// These routes are kept for backward compatibility
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.me);

module.exports = router;
