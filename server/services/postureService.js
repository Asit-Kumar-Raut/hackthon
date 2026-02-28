/**
 * Posture Service - Firebase Firestore operations for posture logs
 * Handles posture log creation and retrieval
 */

const { db, admin } = require('../firebase/config');

const COLLECTION_NAME = 'postureLogs';

/**
 * Create a posture log entry
 */
async function createPostureLog(logData) {
  const { employeeId, postureStatus, duration, scoreAfterUpdate, eventType } = logData;

  const logRef = db.collection(COLLECTION_NAME).doc();
  const log = {
    employeeId,
    postureStatus: postureStatus || 'good',
    duration: duration || 0,
    scoreAfterUpdate: scoreAfterUpdate ?? 0,
    eventType: eventType || 'status_update',
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  await logRef.set(log);

  return {
    id: logRef.id,
    ...log,
  };
}

/**
 * Get posture logs for an employee (today's logs)
 */
async function getPostureLogsByEmployeeId(employeeId, limit = 500) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where('employeeId', '==', employeeId)
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(today))
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Get all posture logs for analytics (optional)
 */
async function getAllPostureLogs(limit = 200) {
  const snapshot = await db
    .collection(COLLECTION_NAME)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

module.exports = {
  createPostureLog,
  getPostureLogsByEmployeeId,
  getAllPostureLogs,
};
