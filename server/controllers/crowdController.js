/**
 * Crowd controller: get crowd logs, log crowd/restricted area events
 */

const { getCrowdLogs, createCrowdLog } = require('../services/crowdService');
const { emitCrowdAlert } = require('../middleware/socketHandlers');
// avoid potential redeclaration by renaming the imported function
const { normalizeLog: formatLog, normalizeLogs } = require('../utils/normalizeLogs');
const { sendSMSAlert } = require('../services/twilioService');
// new email utility
const { sendEmailAlert } = require('../services/emailService');
const { admin } = require('../firebase/config');

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

      try {
        const usersSnapshot = await admin.firestore().collection('users').get();
        const notificationPromises = [];

        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const message = "Unauthorized access detected in Restricted Zone by manager " + req.user.employeeId + " at " + new Date().toLocaleTimeString() + ".";

          if (userData.phoneNumber) {
            notificationPromises.push(sendSMSAlert(userData.phoneNumber, message));
          }
          if (userData.email) {
            // send email using configured Gmail account
            const subject = 'Restricted Zone Alert';
            notificationPromises.push(sendEmailAlert(userData.email, subject, message));
          }
        });

        await Promise.allSettled(notificationPromises);
      } catch (err) {
        console.error('Failed to send SMS notifications', err);
      }
    }

    res.status(201).json(formatLog(log));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log crowd event.' });
  }
};

/**
 * POST /api/crowd/restricted-area
 * Trigger SMS alerts when a restricted area is created.
 */
exports.createRestrictedArea = async (req, res) => {
  try {
    if (req.user.role !== 'head') {
      return res.status(403).json({ message: 'Only head employees can create restricted areas.' });
    }

    const usersSnapshot = await admin.firestore().collection('users').get();
    const notificationPromises = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const message = "Restricted Area Alert: A new restricted zone has been marked in the industry. Unauthorized access is prohibited.";
      if (userData.phoneNumber) {
        notificationPromises.push(sendSMSAlert(userData.phoneNumber, message));
      }
      if (userData.email) {
        const subject = 'New Restricted Area';
        notificationPromises.push(sendEmailAlert(userData.email, subject, message));
      }
    });

    await Promise.allSettled(notificationPromises);
    res.status(200).json({ message: 'Restricted area created and alerts sent' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create restricted area.' });
  }
};
