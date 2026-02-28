/**
 * Firebase Admin SDK Configuration
 * Initialize Firebase Admin with service account credentials
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Option 1: Use service account key file (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 2: Use service account file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 3: Use default credentials (for Firebase emulator or GCP)
    else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
}

const db = admin.firestore();

module.exports = { admin, db };
