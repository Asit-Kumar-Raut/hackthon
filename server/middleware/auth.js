/**
 * JWT authentication and role-based access middleware
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Verify JWT and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * Restrict route to specific role(s)
 * Usage: requireRole('employee') or requireRole('head', 'employee')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient role.' });
    }
    next();
  };
};

/**
 * Generate JWT for user
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
  authenticateToken,
  requireRole,
  generateToken,
  JWT_SECRET,
};
