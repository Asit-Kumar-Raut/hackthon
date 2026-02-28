import {
    collection,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    getDoc,
    increment
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const safetyGearService = {
    /**
     * Create a safety gear log entry
     */
    async createSafetyLog(logData) {
        try {
            const {
                employeeId,
                helmet,
                mask,
                vest,
                safetyScore,
                incidentType,
            } = logData;

            const logRef = await addDoc(collection(db, 'employee_safety_logs'), {
                employeeId,
                helmet,
                mask,
                vest,
                safetyScore,
                incidentType,
                timestamp: serverTimestamp(),
            });

            return {
                id: logRef.id,
                ...logData,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Error creating safety log:', error);
            throw error;
        }
    },

    /**
     * Update employee safety stats in the users collection
     */
    async updateEmployeeSafetyStats(firebaseUid, safetyScore, incidentType) {
        try {
            const updateData = {
                currentSafetyScore: safetyScore,
                lastUpdated: serverTimestamp(),
            };

            if (incidentType) {
                updateData.lastIncident = incidentType;
                updateData.totalViolations = increment(1);
            }

            await updateDoc(doc(db, 'users', firebaseUid), updateData);
            return true;
        } catch (error) {
            console.error('Error updating employee safety stats:', error);
            throw error;
        }
    },

    /**
     * Increase safety score slightly if wearing all gear correctly over time
     */
    async increaseSafetyScore(firebaseUid, currentScore) {
        try {
            const newScore = Math.min(100, currentScore + 1); // Max score is 100
            await updateDoc(doc(db, 'users', firebaseUid), {
                currentSafetyScore: newScore,
                lastUpdated: serverTimestamp(),
            });
            return newScore;
        } catch (error) {
            console.error('Error increasing safety score:', error);
            throw error;
        }
    }
};
