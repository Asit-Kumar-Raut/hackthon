/**
 * User Service - Firebase Firestore operations for users
 * Handles user CRUD operations with score updates
 */

const { db, admin } = require('../firebase/config');
const bcrypt = require('bcryptjs');

const COLLECTION_NAME = 'users';

/**
 * Create a new user
 */
async function createUser(userData) {
  const { employeeId, name, password, role } = userData;
  
  // Check if user already exists
  const existing = await getUserByEmployeeId(employeeId);
  if (existing) {
    throw new Error('Employee ID already registered.');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user document
  const userRef = db.collection(COLLECTION_NAME).doc();
  const user = {
    employeeId,
    name,
    passwordHash,
    role: role || 'employee',
    score: 0,
    badgeLevel: 1,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userRef.set(user);

  return {
    id: userRef.id,
    employeeId: user.employeeId,
    name: user.name,
    role: user.role,
    score: user.score,
    badgeLevel: user.badgeLevel,
  };
}

/**
 * Get user by employee ID
 */
async function getUserByEmployeeId(employeeId) {
  const snapshot = await db
    .collection(COLLECTION_NAME)
    .where('employeeId', '==', employeeId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  };
}

/**
 * Get user by document ID
 */
async function getUserById(userId) {
  const doc = await db.collection(COLLECTION_NAME).doc(userId).get();
  
  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  };
}

/**
 * Update user score (CRITICAL: Updates same document, doesn't create new)
 */
async function updateUserScore(employeeId, newScore) {
  const user = await getUserByEmployeeId(employeeId);
  if (!user) {
    throw new Error('User not found');
  }

  const badgeLevel = Math.min(5, Math.floor(newScore / 20) + 1);
  
  await db.collection(COLLECTION_NAME).doc(user.id).update({
    score: newScore,
    badgeLevel,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ...user,
    score: newScore,
    badgeLevel,
  };
}

/**
 * Verify password
 */
async function verifyPassword(user, candidatePassword) {
  return bcrypt.compare(candidatePassword, user.passwordHash);
}

module.exports = {
  createUser,
  getUserByEmployeeId,
  getUserById,
  updateUserScore,
  verifyPassword,
};
