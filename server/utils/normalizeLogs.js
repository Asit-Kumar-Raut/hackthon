/**
 * Normalize Firestore document for API response (frontend expects createdAt and _id)
 */

function toISO(t) {
  if (!t) return null;
  if (typeof t === 'string') return t;
  if (t.toDate && typeof t.toDate === 'function') return t.toDate().toISOString();
  if (t._seconds != null) return new Date(t._seconds * 1000).toISOString();
  return null;
}

function normalizeLog(log) {
  if (!log) return log;
  const createdAt = toISO(log.timestamp) || toISO(log.createdAt);
  return {
    ...log,
    _id: log.id || log._id,
    createdAt: createdAt || log.createdAt,
  };
}

function normalizeLogs(logs) {
  return Array.isArray(logs) ? logs.map(normalizeLog) : [];
}

module.exports = { normalizeLog, normalizeLogs, toISO };
