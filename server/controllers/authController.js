/**
 * Auth controller: Firebase Authentication endpoints
 * Note: Registration and login are now handled by Firebase Auth on the frontend
 * These endpoints are kept for backward compatibility or additional features
 */

const { admin } = require('../firebase/config');
const { getUserByEmployeeId } = require('../services/userService');

/**
 * GET /api/auth/me
 * Return current user from Firebase token (requires auth middleware)
 */
exports.me = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user.id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
        score: user.score || 0,
        badgeLevel: user.badgeLevel || 1,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get user.' });
  }
};

/**
 * POST /api/auth/register
 * Legacy endpoint - Registration is now handled by Firebase Auth on frontend
 * This endpoint can be used for admin operations or kept for backward compatibility
 */
exports.register = async (req, res) => {
  res.status(501).json({
    message: 'Registration is now handled by Firebase Authentication on the frontend.',
  });
};

/**
 * POST /api/auth/login
 * Legacy endpoint - Login is now handled by Firebase Auth on frontend
 * This endpoint can be removed or kept for backward compatibility
 */
exports.login = async (req, res) => {
  res.status(501).json({
    message: 'Login is now handled by Firebase Authentication on the frontend.',
  });
};
