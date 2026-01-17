import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
// @ts-ignore: getReactNativePersistence exists in RN bundle but missing from TS definitions
import { getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "driveiq-3ade4.firebaseapp.com",
  projectId: "driveiq-3ade4",
  storageBucket: "driveiq-3ade4.firebasestorage.app",
  messagingSenderId: "932909380820",
  appId: "1:932909380820:web:e9853263f13be1af4ef741",
  measurementId: "G-E2T4Z2GTMM",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: ReturnType<typeof getAuth>;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db = getFirestore(app);

export { app, auth, db };
