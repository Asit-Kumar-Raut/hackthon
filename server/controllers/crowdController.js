/**
 * Crowd controller: get crowd logs, log crowd/restricted area events
 */

const CrowdLog = require('../models/CrowdLog');
const { emitCrowdAlert } = require('../middleware/socketHandlers');

/**
 * GET /api/crowd/data
 * Get crowd logs (for head dashboard)
 */
exports.getCrowdData = async (req, res) => {
  try {
    if (req.user.role !== 'head') {
      return res.status(403).json({ message: 'Only head employees can access crowd data.' });
    }
    const logs = await CrowdLog.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch crowd data.' });
  }
};

/**
 * POST /api/crowd/log
 * Log crowd detection event (count, restrictedViolation, alertTriggered)
 */
exports.logCrowd = async (req, res) => {
  try {
    if (req.user.role !== 'head') {
      return res.status(403).json({ message: 'Only head employees can log crowd events.' });
    }
    const { detectedCount, restrictedViolation, alertTriggered } = req.body;
    const log = await CrowdLog.create({
      detectedCount: detectedCount ?? 0,
      restrictedViolation: !!restrictedViolation,
      alertTriggered: !!alertTriggered,
      recordedBy: req.user.employeeId,
    });

    if (log.alertTriggered || log.restrictedViolation) {
      const io = req.app.get('io');
      if (io) emitCrowdAlert(io, { log, message: 'Crowd or restricted area alert.' });
    }

    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log crowd event.' });
  }
};
