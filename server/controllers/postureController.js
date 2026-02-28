/**
 * Posture controller: get posture data, log posture events
 */

const { getPostureLogsByEmployeeId, createPostureLog } = require('../services/postureService');
const { updateUserScore } = require('../services/userService');
const { emitPostureAlert, emitScoreUpdate } = require('../middleware/socketHandlers');
const { normalizeLogs } = require('../utils/normalizeLogs');

// Keep backend in sync with frontend: alert after 1 minute of bad posture
const BAD_POSTURE_ALERT_MINUTES = 1;

/**
 * GET /api/posture/data
 * Get posture logs and daily score for current user (employee only)
 */
exports.getPostureData = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'employee') {
      return res.status(403).json({ message: 'Only employees can access posture data.' });
    }
    const employeeId = user.employeeId;
    const logs = await getPostureLogsByEmployeeId(employeeId, 500);

    // Get current score from user document (not computed from logs)
    const dailyScore = user.score || 0;
    const goodCount = logs.filter((l) => l.postureStatus === 'good').length;
    const badCount = logs.filter((l) => l.postureStatus === 'bad').length;

    res.json({
      logs: normalizeLogs(logs),
      dailyScore,
      goodCount,
      badCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch posture data.' });
  }
};

/**
 * POST /api/posture/log
 * Log a posture event (status, duration, score, eventType)
 */
exports.logPosture = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'employee') {
      return res.status(403).json({ message: 'Only employees can log posture.' });
    }
    const { postureStatus, duration, score, eventType } = req.body;
    const employeeId = user.employeeId;

    // CRITICAL FIX: Update user score in the same document, not create new records
    let updatedScore = user.score || 0;
    if (score !== undefined && score !== null) {
      // Update the user's score in Firebase (updates existing document, no duplication)
      const updatedUser = await updateUserScore(employeeId, score);
      updatedScore = updatedUser.score;

      // Emit real-time score update via Socket.io
      const io = req.app.get('io');
      if (io) {
        emitScoreUpdate(io, employeeId, {
          score: updatedScore,
          badgeLevel: updatedUser.badgeLevel,
          employeeId,
        });
      }
    }

    // Create log entry with the updated score
    const log = await createPostureLog({
      employeeId,
      postureStatus: postureStatus || 'good',
      duration: duration || 0,
      scoreAfterUpdate: updatedScore,
      eventType: eventType || 'status_update',
    });

    // If alert triggered, emit socket event
    if (eventType === 'alert_triggered') {
      const io = req.app.get('io');
      if (io) {
        emitPostureAlert(io, employeeId, {
          log,
          message: `Bad posture exceeded ${BAD_POSTURE_ALERT_MINUTES} minute${BAD_POSTURE_ALERT_MINUTES > 1 ? 's' : ''}.`,
        });
      }
    }

    res.status(201).json({
      ...log,
      score: updatedScore, // Return updated score
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log posture.' });
  }
};
