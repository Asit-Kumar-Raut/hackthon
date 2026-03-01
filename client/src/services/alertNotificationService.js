/**
 * Alert Notification Service
 * Stores alerts in Firebase and sends to registered email addresses.
 * Alerts: restricted zone created, unauthorized person detected, emergency access granted.
 */
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const MOBILE_ALERTS_COLLECTION = 'mobile_alerts';
const USERS_COLLECTION = 'users';

export const alertNotificationService = {
  /**
   * Store alert in Firebase and associate with email address(es) for delivery
   */
  async createAlert({ message, type = 'general', emailAddresses = [], zoneId = null, cameraId = null }) {
    try {
      if (!db) return null;
      const emails = Array.isArray(emailAddresses) ? emailAddresses : [emailAddresses];
      const validEmails = [...new Set(emails.filter((e) => e && typeof e === 'string' && e.trim()))];

      const ref = await addDoc(collection(db, MOBILE_ALERTS_COLLECTION), {
        message,
        type,
        emailAddresses: validEmails,
        zoneId: zoneId || null,
        cameraId: cameraId || null,
        createdAt: serverTimestamp(),
        delivered: false,
      });
      return { id: ref.id, message, type, emailAddresses: validEmails };
    } catch (e) {
      console.error('alertNotificationService.createAlert error:', e);
      return null;
    }
  },

  /**
   * Case 1: Restricted area created – notify all registered employee emails
   */
  async sendRestrictedZoneCreatedAlert(zoneId, createdByManagerId) {
    const message = '⚠️ Restricted Area Alert: A new restricted zone has been marked in the industry. Unauthorized access is prohibited.';
    const emails = await this.getRegisteredEmails();
    return this.createAlert({
      message,
      type: 'restricted_zone_created',
      emailAddresses: emails,
      zoneId,
    });
  },

  /**
   * Case 2: Unauthorized person detected in restricted zone
   */
  async sendUnauthorizedDetectedAlert(zoneId, cameraId = 'live') {
    const t = new Date();
    const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
    const message = `🚨 Unauthorized access detected in Restricted Zone ${zoneId || '1'} at ${timeStr}.`;
    const emails = await this.getRegisteredEmails();
    return this.createAlert({
      message,
      type: 'unauthorized_detected',
      emailAddresses: emails,
      zoneId,
      cameraId,
    });
  },

  /**
   * Case 3: Emergency access granted (authorized face recognized)
   */
  async sendEmergencyAccessGrantedAlert(zoneId, personName) {
    const message = `✅ Emergency access granted for ${personName || 'Authorized personnel'} in Zone ${zoneId || '1'}.`;
    const emails = await this.getRegisteredEmails();
    return this.createAlert({
      message,
      type: 'access_granted',
      emailAddresses: emails,
      zoneId,
    });
  },

  /**
   * Get all registered user email addresses from Firestore (for broadcast alerts)
   */
  async getRegisteredEmails() {
    try {
      if (!db) return [];
      const snap = await getDocs(collection(db, USERS_COLLECTION));
      const emails = [];
      snap.docs.forEach((d) => {
        const e = d.data().email;
        if (e && typeof e === 'string' && e.trim()) emails.push(e.trim().toLowerCase());
      });
      return [...new Set(emails)];
    } catch (e) {
      console.warn('getRegisteredEmails error:', e);
      return [];
    }
  },

  /**
   * Fetch recent alerts (for admin/Manager view)
   */
  async getRecentAlerts(limitCount = 50) {
    try {
      if (!db) return [];
      const q = query(
        collection(db, MOBILE_ALERTS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null,
      }));
    } catch (e) {
      console.error('getRecentAlerts error:', e);
      return [];
    }
  },
};
