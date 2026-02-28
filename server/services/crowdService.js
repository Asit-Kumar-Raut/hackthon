/**
 * Crowd Service - Firebase Firestore operations for crowd logs
 * Handles crowd detection log creation and retrieval
 */

const { db, admin } = require('../firebase/config');

const COLLECTION_NAME = 'crowdLogs';

/**
 * Create a crowd log entry
 */
async function createCrowdLog(logData) {
  const { detectedCount, restrictedViolation, recordedBy } = logData;

  const logRef = db.collection(COLLECTION_NAME).doc();
  const log = {
    detectedCount: detectedCount ?? 0,
    restrictedViolation: !!restrictedViolation,
    alertTriggered: !!restrictedViolation, // Auto-trigger if restricted violation
    recordedBy: recordedBy || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };

  await logRef.set(log);

  return {
    id: logRef.id,
    ...log,
  };
}

/**
 * Get crowd logs (for head dashboard)
 */
async function getCrowdLogs(limit = 200) {
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
  createCrowdLog,
  getCrowdLogs,
};
