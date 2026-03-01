/**
 * Extended Restricted Zones – industrial map-based restriction control
 * Area ID, Coordinates, Created by, Timestamp, Restriction Status (Active/Inactive)
 * On create: trigger alert to all registered employee phone numbers.
 */
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import { alertNotificationService } from './alertNotificationService';

const RESTRICTED_AREAS_COLLECTION = 'restricted_areas_ext';

export const restrictedZonesExtendedService = {
  /**
   * Create restricted area and send alert to all employees (including 9861216929)
   */
  async createRestrictedArea({ areaId, coordinates, createdByManagerId, meta = {} }) {
    try {
      if (!db) return null;
      const ref = await addDoc(collection(db, RESTRICTED_AREAS_COLLECTION), {
        areaId: areaId || 'default_zone',
        coordinates: Array.isArray(coordinates) ? coordinates : [],
        createdBy: createdByManagerId || 'admin',
        createdAt: serverTimestamp(),
        restrictionStatus: 'Active',
        ...meta,
      });
      await alertNotificationService.sendRestrictedZoneCreatedAlert(areaId || ref.id, createdByManagerId);
      return { id: ref.id, areaId, restrictionStatus: 'Active' };
    } catch (e) {
      console.error('restrictedZonesExtendedService.createRestrictedArea error:', e);
      return null;
    }
  },

  async setStatus(areaDocId, status) {
    try {
      if (!db) return false;
      await updateDoc(doc(db, RESTRICTED_AREAS_COLLECTION, areaDocId), {
        restrictionStatus: status,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (e) {
      console.error('setStatus error:', e);
      return false;
    }
  },

  async getRecentAreas(limitCount = 20) {
    try {
      if (!db) return [];
      const q = query(
        collection(db, RESTRICTED_AREAS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.()?.toISOString?.() || null,
      }));
    } catch (e) {
      console.error('getRecentAreas error:', e);
      return [];
    }
  },
};
