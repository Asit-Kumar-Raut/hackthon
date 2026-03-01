/**
 * Authorized Faces Service – Access Control / Face Recognition
 * Store: Person ID, Name, Face encoding, Department, Phone number
 * Used to match detected faces and grant/deny access (Authorized vs Unauthorized)
 */
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const AUTHORIZED_FACES_COLLECTION = 'authorized_faces';

export const authorizedFacesService = {
  /**
   * Register authorized personnel (Manager only)
   * @param {Object} data - name, employeeId, department, phoneNumber, faceEncoding (array of numbers)
   */
  async registerAuthorizedPerson(data) {
    try {
      if (!db) return null;
      const ref = await addDoc(collection(db, AUTHORIZED_FACES_COLLECTION), {
        name: data.name || '',
        employeeId: data.employeeId || '',
        department: data.department || '',
        phoneNumber: data.phoneNumber || '',
        faceEncoding: Array.isArray(data.faceEncoding) ? data.faceEncoding : [],
        createdAt: serverTimestamp(),
        createdBy: data.createdBy || null,
      });
      return { id: ref.id, ...data };
    } catch (e) {
      console.error('authorizedFacesService.registerAuthorizedPerson error:', e);
      return null;
    }
  },

  async getAllAuthorized() {
    try {
      if (!db) return [];
      const snapshot = await getDocs(collection(db, AUTHORIZED_FACES_COLLECTION));
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('getAllAuthorized error:', e);
      return [];
    }
  },

  async getByEmployeeId(employeeId) {
    try {
      if (!db) return null;
      const q = query(
        collection(db, AUTHORIZED_FACES_COLLECTION),
        where('employeeId', '==', employeeId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      console.error('getByEmployeeId error:', e);
      return null;
    }
  },

  async removeAuthorizedPerson(docId) {
    try {
      if (!db) return false;
      await deleteDoc(doc(db, AUTHORIZED_FACES_COLLECTION, docId));
      return true;
    } catch (e) {
      console.error('removeAuthorizedPerson error:', e);
      return false;
    }
  },
};
