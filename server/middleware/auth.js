/**
 * Firebase Authentication Middleware
 * Verifies Firebase ID tokens instead of custom JWT
 */

const { admin } = require('../firebase/config');
const { getUserByEmployeeId } = require('../services/userService');

/**
 * Verify Firebase ID token and attach user to request
 */
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // Get user data from Firestore
    const userDoc = await admin.firestore().collection('users').doc(firebaseUid).get();
    
    if (!userDoc.exists) {
      return res.status(401).json({ message: 'User not found in database.' });
    }

    const userData = userDoc.data();
    req.user = {
      id: firebaseUid,
      employeeId: userData.employeeId,
      name: userData.name,
      role: userData.role,
      score: userData.score || 0,
      badgeLevel: userData.badgeLevel || 1,
    };

    next();
  } catch (err) {
    console.error('Token verification error:', err);
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

module.exports = {
  authenticateToken,
  requireRole,
};
