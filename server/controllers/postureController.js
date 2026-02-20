/**
 * Posture controller: get posture data, log posture events
 */

const PostureLog = require('../models/PostureLog');
const { emitPostureAlert } = require('../middleware/socketHandlers');

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logs = await PostureLog.find({
      employeeId,
      createdAt: { $gte: today },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Compute daily score from logs (simplified: sum of score deltas or last score)
    let dailyScore = 0;
    const goodCount = logs.filter((l) => l.postureStatus === 'good').length;
    const badCount = logs.filter((l) => l.postureStatus === 'bad').length;
    dailyScore = Math.max(0, goodCount * 2 - badCount);

    res.json({
      logs,
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

    const log = await PostureLog.create({
      employeeId,
      postureStatus: postureStatus || 'good',
      duration: duration || 0,
      score: score ?? 0,
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

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log posture.' });
  }
};
