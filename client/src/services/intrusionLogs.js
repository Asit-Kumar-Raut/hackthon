import {
    collection,
    addDoc,
    doc,
    updateDoc,
    increment,
    serverTimestamp,
    getDoc,
    setDoc,
    getDocs,
    query,
    orderBy,
    limit
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const intrusionLogsService = {
    /**
     * Save a virtual boundary to Firestore
     */
    async saveBoundary(zoneId, coordinates, managerId) {
        try {
            const boundaryRef = doc(db, 'restricted_zones', zoneId);
            await setDoc(boundaryRef, {
                zoneId,
                coordinates,
                createdBy: managerId,
                createdAt: serverTimestamp(),
            });
            return true;
        } catch (error) {
            console.error('Error saving boundary:', error);
            throw error;
        }
    },

    /**
     * Get an existing virtual boundary
     */
    async getBoundary(zoneId) {
        try {
            const boundaryRef = doc(db, 'restricted_zones', zoneId);
            const docSnap = await getDoc(boundaryRef);
            if (docSnap.exists()) {
                return docSnap.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting boundary:', error);
            return null;
        }
    },

    /**
     * Log an intrusion in restricted area and update analytics
     */
    async logIntrusion(logData) {
        try {
            const {
                zoneId,
                detectedPerson,
                confidenceScore,
                snapshotImage,
            } = logData;

            // Log intrusion Event
            const logRef = await addDoc(collection(db, 'intrusion_logs'), {
                zoneId,
                detectedPerson: detectedPerson || 'unknown',
                confidenceScore,
                snapshotImage: snapshotImage || null,
                alertStatus: 'triggered',
                timestamp: serverTimestamp(),
            });

            // Update generic analytics
            const analyticsRef = doc(db, 'analytics', 'violations');
            const snap = await getDoc(analyticsRef);
            if (!snap.exists()) {
                await setDoc(analyticsRef, {
                    totalIntrusions: 1,
                    todayIntrusions: 1,
                    lastIntrusionTime: serverTimestamp()
                });
            } else {
                await updateDoc(analyticsRef, {
                    totalIntrusions: increment(1),
                    todayIntrusions: increment(1), // In a real app we'd reset this daily
                    lastIntrusionTime: serverTimestamp()
                });
            }

            return {
                id: logRef.id,
                ...logData,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error creating intrusion log:', error);
            throw error;
        }
    },

    /**
     * Fetch recent intrusions
     */
    async getRecentIntrusions(limitCount = 20) {
        try {
            const q = query(
                collection(db, 'intrusion_logs'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
            }));
        } catch (error) {
            console.error('Error fetching intrusion logs:', error);
            return [];
        }
    }
};
