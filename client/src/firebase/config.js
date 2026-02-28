/**
 * Firebase Client SDK Configuration
 * Initialize Firebase for frontend authentication and Firestore access
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiZsrnHcOpObMfCQ-RWvk5bY_d_OvqotM",
  authDomain: "ai-monitoring-77fc2.firebaseapp.com",
  projectId: "ai-monitoring-77fc2",
  storageBucket: "ai-monitoring-77fc2.firebasestorage.app",
  messagingSenderId: "120143898118",
  appId: "1:120143898118:web:054d85a0d4a017d1fa0587",
  measurementId: "G-79T8NJ82N2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics (only in browser, not SSR)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { analytics };
export default app;
