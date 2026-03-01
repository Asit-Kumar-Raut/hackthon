/**
 * Detection Logs Service – stores CCTV/restricted zone detection events in Firebase
 * Schema: Log ID, Camera ID, Person status, Timestamp, Image, Access status (Authorized/Unauthorized)
 */
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const DETECTION_LOGS_COLLECTION = 'detection_logs';

export const detectionLogsService = {
  /**
   * Log a detection event (person/animal in restricted zone)
   * @param {Object} data
   * @param {string} data.cameraId - Camera ID (e.g. 'live', 'video_upload', 'cctv_1')
   * @param {string} data.zoneId - Restricted zone ID
   * @param {string} data.personStatus - 'detected' | 'authorized' | 'unauthorized'
   * @param {string} data.accessStatus - 'Authorized' | 'Unauthorized'
   * @param {string|null} data.screenshotImage - Base64 or URL of snapshot
   * @param {string} [data.detectedClass] - person, dog, etc.
   * @param {number} [data.confidenceScore]
   */
  async addDetectionLog(data) {
    try {
      if (!db) return null;
      const ref = await addDoc(collection(db, DETECTION_LOGS_COLLECTION), {
        cameraId: data.cameraId || 'live',
        zoneId: data.zoneId || 'default_zone',
        personStatus: data.personStatus || 'detected',
        accessStatus: data.accessStatus || 'Unauthorized',
        screenshotImage: data.screenshotImage || null,
        detectedClass: data.detectedClass || 'person',
        confidenceScore: data.confidenceScore ?? 0.9,
        timestamp: serverTimestamp(),
      });
      return { id: ref.id, ...data };
    } catch (e) {
      console.error('detectionLogsService.addDetectionLog error:', e);
      return null;
    }
  },

  async getRecentLogs(limitCount = 50) {
    try {
      if (!db) return [];
      const q = query(
        collection(db, DETECTION_LOGS_COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()?.toISOString?.() || null,
      }));
    } catch (e) {
      console.error('getRecentLogs error:', e);
      return [];
    }
  },
};
