/**
 * AuthContext - Firebase Authentication & Firestore user management
 * Login: employeeId → lookup email → Firebase signIn → Firestore profile
 * Register: create Firebase auth + Firestore user doc
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

/**
 * Derive email from employeeId for Firebase Auth
 * (Firebase Auth requires an email; we synthesize one)
 */
function toEmail(employeeId) {
  return `${employeeId.toLowerCase()}@ai-monitoring.com`;
}

/**
 * Compute badge level from score
 */
function computeBadge(score) {
  return Math.min(5, Math.floor((score || 0) / 20) + 1);
}

/**
 * Build a normalized user object from Firestore data
 */
function buildUserObj(firebaseUid, fsData) {
  return {
    id: firebaseUid,
    employeeId: fsData.employeeId,
    name: fsData.name,
    email: fsData.email,
    role: fsData.role,
    score: fsData.score ?? 0,
    badgeLevel: fsData.badgeLevel ?? computeBadge(fsData.score),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (snap.exists()) {
            setUser(buildUserObj(firebaseUser.uid, snap.data()));
          } else {
            // User exists in Auth but not Firestore — sign out
            await signOut(auth);
            setUser(null);
          }
        } catch (err) {
          console.error('Failed to load user profile:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Login with employeeId + password
   * Flow: employeeId → convert to email → Firebase signIn
   * (All users are stored with email = `<employeeId>@ai-monitoring.com`)
   */
  const login = async (employeeId, password) => {
    try {
      const email = toEmail(employeeId);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;

      const snap = await getDoc(doc(db, 'users', uid));
      let userData;

      if (!snap.exists()) {
        // Auto-recover missing Firestore profile (Caused if they registered BEFORE the DB rules were fixed)
        const roleHint = new URLSearchParams(window.location.search).get('role') === 'head' ? 'head' : 'employee';

        const recoveredData = {
          employeeId,
          name: employeeId, // Fallback name
          email,
          role: roleHint,
          score: 0,
          badgeLevel: 1,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        // Save the missing profile
        await setDoc(doc(db, 'users', uid), recoveredData);
        userData = buildUserObj(uid, recoveredData);
      } else {
        userData = buildUserObj(uid, snap.data());
      }

      setUser(userData);
      return userData;
    } catch (err) {
      console.error('Login error:', err);
      // Map Firebase error codes to friendly messages
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-email'
      ) {
        throw new Error('Invalid Employee ID or password.');
      }
      if (err.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please wait and try again.');
      }
      throw err;
    }
  };

  /**
   * Register new user
   * Creates Firebase Auth account + Firestore user document
   */
  const register = async (employeeId, name, password, role = 'employee') => {
    try {
      const email = toEmail(employeeId);

      // Note: We skip the Firestore check here because Firebase Auth 
      // will automatically throw 'auth/email-already-in-use' if the employeeId 
      // (which we converted to an email) has already been registered!
      // This solves the 'Missing or insufficient permissions' error on strict DB rules.

      // Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // Set display name in Auth
      await updateProfile(firebaseUser, { displayName: name });

      // Create Firestore user document (keyed by Firebase UID)
      const userData = {
        employeeId,
        name,
        email,
        role,
        score: 0,
        badgeLevel: 1,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), userData);

      const userObj = buildUserObj(firebaseUser.uid, { ...userData, score: 0, badgeLevel: 1 });
      setUser(userObj);
      return userObj;
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('Employee ID is already registered.');
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters.');
      }
      throw err;
    }
  };

  /**
   * Sign out the current user
   */
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  /**
   * Re-fetch user data from Firestore (call after score updates)
   */
  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return null;
    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const updated = buildUserObj(firebaseUser.uid, snap.data());
        setUser(updated);
        return updated;
      }
      return null;
    } catch (err) {
      console.error('Failed to refresh user:', err);
      return null;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    isEmployee: user?.role === 'employee',
    isHead: user?.role === 'head',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
