/**
 * Auth controller: login, register
 */

const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Register new employee or head (password hashed in User model)
 */
exports.register = async (req, res) => {
  try {
    const { employeeId, name, password, role } = req.body;
    if (!employeeId || !name || !password || !role) {
      return res.status(400).json({ message: 'employeeId, name, password, and role are required.' });
    }
    if (!['employee', 'head'].includes(role)) {
      return res.status(400).json({ message: 'Role must be employee or head.' });
    }
    const existing = await User.findOne({ employeeId });
    if (existing) {
      return res.status(400).json({ message: 'Employee ID already registered.' });
    }
    const user = await User.create({ employeeId, name, password, role });
    const token = generateToken(user._id);
    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed.' });
  }
};

/**
 * POST /api/auth/login
 * Login with employeeId and password; returns JWT and user
 */
exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ message: 'Employee ID and password are required.' });
    }
    const user = await User.findOne({ employeeId });
    if (!user) {
      return res.status(401).json({ message: 'Invalid employee ID or password.' });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid employee ID or password.' });
    }
    const token = generateToken(user._id);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Login failed.' });
  }
};

/**
 * GET /api/auth/me
 * Return current user from JWT (requires auth middleware)
 */
exports.me = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get user.' });
  }
};
