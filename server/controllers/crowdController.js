/**
 * Crowd controller: get crowd logs, log crowd/restricted area events
 */

const { getCrowdLogs, createCrowdLog } = require('../services/crowdService');
const { emitCrowdAlert } = require('../middleware/socketHandlers');
const { normalizeLog, normalizeLogs } = require('../utils/normalizeLogs');

/**
 * GET /api/crowd/data
 * Get crowd logs (for head dashboard)
 */
exports.getCrowdData = async (req, res) => {
  try {
    if (req.user.role !== 'head') {
      return res.status(403).json({ message: 'Only head employees can access crowd data.' });
    }
    const logs = await getCrowdLogs(200);
    res.json({ logs: normalizeLogs(logs) });
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
    const { detectedCount, restrictedViolation } = req.body;
    const log = await createCrowdLog({
      detectedCount: detectedCount ?? 0,
      restrictedViolation: !!restrictedViolation,
      recordedBy: req.user.employeeId,
    });

    if (log.alertTriggered || log.restrictedViolation) {
      const io = req.app.get('io');
      if (io) emitCrowdAlert(io, { log, message: 'Crowd or restricted area alert.' });
    }

    res.status(201).json(normalizeLog(log));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log crowd event.' });
  }
};
