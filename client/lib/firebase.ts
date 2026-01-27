import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, initializeAuth, Auth } from "firebase/auth";
// @ts-ignore: getReactNativePersistence exists in RN bundle but missing from TS definitions
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Firebase config - only include measurementId on web to prevent Analytics crash on iOS
const firebaseConfig: Record<string, string | undefined> = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "driveiq-3ade4.firebaseapp.com",
  projectId: "driveiq-3ade4",
  storageBucket: "driveiq-3ade4.firebasestorage.app",
  messagingSenderId: "932909380820",
  appId: "1:932909380820:web:e9853263f13be1af4ef741",
  ...(Platform.OS === "web" ? { measurementId: "G-E2T4Z2GTMM" } : {}),
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  // Initialize Firebase app
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  // Initialize Auth with platform-specific persistence
  if (Platform.OS === "web") {
    auth = getAuth(app);
  } else {
    // Check if auth is already initialized to prevent duplicate initialization error
    try {
      auth = getAuth(app);
    } catch {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  }

  // Initialize Firestore
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  throw error;
}

export { app, auth, db };
