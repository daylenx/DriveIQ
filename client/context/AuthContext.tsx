/**
 * AuthContext.tsx - Firebase Authentication Layer
 * 
 * This context manages user authentication state using Firebase Auth.
 * It provides sign-in, sign-up, sign-out, and account deletion functionality.
 * 
 * User profile data is stored in Firestore 'users' collection,
 * separate from Firebase Auth's internal user record.
 * 
 * FIRESTORE COLLECTION: users
 * - Document ID: Firebase Auth UID
 * - Contains: displayName, email, preferences (showTips, themeMode)
 * 
 * // TODO: Future feature - Add social auth providers (Google, Apple Sign-In)
 * // TODO: Future feature - Add email verification flow
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser as firebaseDeleteUser,
  updateProfile,
  sendPasswordResetEmail,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, PlanId, AccountType } from '@/types';
import { PLANS } from '@/constants/plans';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserSettings: (settings: Partial<Pick<User, 'showTips' | 'themeMode' | 'displayName' | 'disableOdometerReminders'>>) => Promise<void>;
  setAccountType: (accountType: AccountType) => Promise<void>;
  updatePlan: (planId: PlanId) => Promise<void>;
  resetToFree: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider wraps the app and manages authentication state.
 * 
 * On mount, subscribes to Firebase Auth state changes.
 * When a user signs in, fetches their profile from Firestore.
 * If profile doesn't exist (first-time user), creates one with defaults.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const needsOnboarding = user !== null && !user.accountType;

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }
      
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          let initialUser: User;
          if (!userDoc.exists()) {
            initialUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              showTips: true,
              themeMode: 'light',
              createdAt: Date.now(),
            };
            await setDoc(userDocRef, initialUser);
          } else {
            initialUser = userDoc.data() as User;
          }
          
          setUser(initialUser);
          
          unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              setUser(snapshot.data() as User);
            } else {
              setUser(null);
            }
          }, (error) => {
            console.error('Error listening to user profile:', error);
            setUser(null);
          });
          
        } catch (error) {
          console.error('Error loading user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, []);

  /**
   * Signs in an existing user with email and password.
   * Firebase Auth handles the actual authentication.
   * Profile loading happens in the onAuthStateChanged listener.
   */
  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * Creates a new user account with email and password.
   * Also creates the Firestore user profile document.
   */
  async function signUp(email: string, password: string, displayName: string) {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });
    
    const newUser: User = {
      id: credential.user.uid,
      email: credential.user.email || email,
      displayName,
      showTips: true,
      themeMode: 'light',
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), newUser);
    setUser(newUser);
  }

  /**
   * Signs in with Apple using expo-apple-authentication.
   * Creates a Firestore profile if this is a new user.
   */
  async function signInWithApple() {
    const AppleAuthentication = await import('expo-apple-authentication');
    
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken, fullName } = credential;
    if (!identityToken) {
      throw new Error('No identity token received from Apple');
    }

    const provider = new OAuthProvider('apple.com');
    const oauthCredential = provider.credential({
      idToken: identityToken,
    });

    const userCredential = await signInWithCredential(auth, oauthCredential);
    const firebaseUser = userCredential.user;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const displayName = fullName?.givenName 
        ? `${fullName.givenName}${fullName.familyName ? ' ' + fullName.familyName : ''}`
        : firebaseUser.email?.split('@')[0] || 'User';

      const newUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName,
        showTips: true,
        themeMode: 'light',
        createdAt: Date.now(),
      };
      await setDoc(userDocRef, newUser);
      setUser(newUser);
    }
  }

  /**
   * Sends a password reset email to the specified address.
   */
  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  /**
   * Signs out the current user.
   * Clears local user state immediately.
   */
  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
  }

  /**
   * Permanently deletes the user's account.
   * 
   * IMPORTANT: This only deletes the users collection document
   * and the Firebase Auth record. Vehicle, task, and log data
   * cleanup happens in DataContext when the user is null.
   * 
   * Note: Firebase has a quirk where deleteUser may fail if the
   * user hasn't signed in recently. In production, you'd want to
   * re-authenticate before deletion.
   */
  async function deleteAccount() {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      await deleteDoc(doc(db, 'users', firebaseUser.uid));
    } catch (error: any) {
      console.error('Error deleting user document:', error);
      throw new Error('Failed to delete account data. Please try again.');
    }
    
    try {
      await firebaseDeleteUser(firebaseUser);
    } catch (error: any) {
      console.error('Error deleting Firebase user:', error);
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('For security, please sign out and sign back in before deleting your account.');
      }
      throw new Error('Failed to delete account. Please try again.');
    }
    
    setUser(null);
  }

  /**
   * Updates user preferences (showTips, themeMode, displayName).
   * Uses Firestore merge to update only specified fields.
   */
  async function updateUserSettings(settings: Partial<Pick<User, 'showTips' | 'themeMode' | 'displayName' | 'disableOdometerReminders'>>) {
    if (!user) return;
    
    const updatedUser = { ...user, ...settings };
    await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    setUser(updatedUser);
  }

  /**
   * Sets the account type during onboarding (personal or fleet).
   * Also initializes the default plan based on account type.
   */
  async function setAccountType(accountType: AccountType) {
    if (!user) return;
    
    const defaultPlan: PlanId = accountType === 'fleet' ? 'fleet_starter' : 'free';
    const plan = PLANS[defaultPlan];
    
    const updatedUser: User = {
      ...user,
      accountType,
      plan: defaultPlan,
      vehicleLimit: plan.vehicleLimit,
      isLifetime: plan.isLifetime,
      updatedAt: Date.now(),
    };
    
    await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    setUser(updatedUser);
  }

  /**
   * Updates the user's plan (for simulated upgrades in dev mode).
   */
  async function updatePlan(planId: PlanId) {
    if (!user) return;
    
    const plan = PLANS[planId];
    
    const updatedUser: User = {
      ...user,
      plan: planId,
      vehicleLimit: plan.vehicleLimit,
      userLimit: plan.userLimit,
      isLifetime: plan.isLifetime,
      accountType: plan.accountType,
      role: 'primary',
      updatedAt: Date.now(),
    };
    
    await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    setUser(updatedUser);
  }

  /**
   * Resets the user to the free plan (dev utility).
   */
  async function resetToFree() {
    if (!user) return;
    
    const freePlan = PLANS.free;
    
    const updatedUser: User = {
      ...user,
      plan: 'free',
      vehicleLimit: freePlan.vehicleLimit,
      isLifetime: false,
      updatedAt: Date.now(),
    };
    
    await setDoc(doc(db, 'users', user.id), updatedUser, { merge: true });
    setUser(updatedUser);
  }

  /**
   * Refreshes the user profile from Firestore.
   * Call this after external updates (e.g., accepting fleet invite).
   */
  async function refreshUserProfile() {
    if (!auth.currentUser) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data() as User);
      }
    } catch (error) {
      console.error('Error refreshing user profile:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        needsOnboarding,
        signIn,
        signUp,
        signInWithApple,
        signOut,
        deleteAccount,
        resetPassword,
        updateUserSettings,
        setAccountType,
        updatePlan,
        resetToFree,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
