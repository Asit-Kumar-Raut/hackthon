/**
 * Firestore Service - Direct Firebase Firestore operations
 * Replaces backend API calls - works without server
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Posture Logs Service
 */
export const postureService = {
  /**
   * Get posture logs for an employee (today's logs)
   */
  async getPostureLogs(employeeId, limitCount = 500) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      const q = query(
        collection(db, 'postureLogs'),
        where('employeeId', '==', employeeId)
      );

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data(),
        createdAt: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().createdAt,
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
      }));

      // Filter for today's logs and sort in memory to avoid Firebase Composite Index requirement
      const filteredLogs = logs
        .filter(log => new Date(log.timestamp) >= today)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limitCount);

      return filteredLogs;
    } catch (error) {
      console.error('Error fetching posture logs:', error);
      return [];
    }
  },

  /**
   * Create a posture log entry
   */
  async createPostureLog(logData) {
    try {
      const { employeeId, postureStatus, duration, score, eventType } = logData;

      const logRef = await addDoc(collection(db, 'postureLogs'), {
        employeeId,
        postureStatus: postureStatus || 'good',
        duration: duration || 0,
        scoreAfterUpdate: score ?? 0,
        eventType: eventType || 'status_update',
        timestamp: serverTimestamp(),
      });

      return {
        id: logRef.id,
        _id: logRef.id,
        ...logData,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating posture log:', error);
      throw error;
    }
  },

  /**
   * Update user score in Firestore
   * Uses Firebase Auth UID to update the correct user document
   */
  async updateUserScore(firebaseUid, newScore) {
    try {
      const badgeLevel = Math.min(5, Math.floor(newScore / 20) + 1);

      await updateDoc(doc(db, 'users', firebaseUid), {
        score: newScore,
        badgeLevel,
        lastUpdated: serverTimestamp(),
      });

      return {
        score: newScore,
        badgeLevel,
      };
    } catch (error) {
      console.error('Error updating user score:', error);
      throw error;
    }
  },
};

/**
 * Crowd Logs Service
 */
export const crowdService = {
  /**
   * Get crowd logs (for head dashboard)
   */
  async getCrowdLogs(limitCount = 200) {
    try {
      const q = query(
        collection(db, 'crowdLogs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data(),
        createdAt: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().createdAt,
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
      }));

      return logs;
    } catch (error) {
      console.error('Error fetching crowd logs:', error);
      return [];
    }
  },

  /**
   * Create a crowd log entry
   */
  async createCrowdLog(logData) {
    try {
      const { detectedCount, restrictedViolation, recordedBy } = logData;

      const logRef = await addDoc(collection(db, 'crowdLogs'), {
        detectedCount: detectedCount ?? 0,
        restrictedViolation: !!restrictedViolation,
        alertTriggered: !!restrictedViolation,
        recordedBy: recordedBy || null,
        timestamp: serverTimestamp(),
      });

      return {
        id: logRef.id,
        _id: logRef.id,
        ...logData,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating crowd log:', error);
      throw error;
    }
  },
};

/**
 * User Service
 */
export const userService = {
  /**
   * Get user data by Firebase UID
   */
  async getUserById(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return {
          id: userDoc.id,
          ...userDoc.data(),
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  /**
   * Get user by employeeId
   */
  async getUserByEmployeeId(employeeId) {
    try {
      const q = query(collection(db, 'users'), where('employeeId', '==', employeeId), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const userDoc = snapshot.docs[0];
      return {
        id: userDoc.id,
        ...userDoc.data(),
      };
    } catch (error) {
      console.error('Error fetching user by employeeId:', error);
      return null;
    }
  },
};
