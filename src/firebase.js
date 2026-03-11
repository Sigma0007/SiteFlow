// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Disabled for development
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzEeofBjsiV-EglmTQexG9VVZ5uR5Rzi4",
  authDomain: "siteflow-c93e8.firebaseapp.com",
  projectId: "siteflow-c93e8",
  storageBucket: "siteflow-c93e8.firebasestorage.app",
  messagingSenderId: "619615369937",
  appId: "1:619615369937:web:620f0bb66ad610955fe3f0",
  measurementId: "G-PQYNR1BNXL"
};

// Initialize Firebase (primary app)
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with error handling
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ─── Secondary Firebase App (for creating supervisor accounts) ────────────────
// Using a secondary app prevents creating a new user from signing out the admin.
const secondaryApp = getApps().find(a => a.name === 'secondary')
  || initializeApp(firebaseConfig, 'secondary');
export const secondaryAuth = getAuth(secondaryApp);
// ──────────────────────────────────────────────────────────────────────────────

// Suppress Firestore BloomFilter warnings (internal optimization warnings)
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('BloomFilterError')) {
      // Suppress BloomFilter warnings - these are internal Firestore optimization warnings
      return;
    }
    originalError.apply(console, args);
  };
}

// Enable authentication persistence
setPersistence(auth, browserLocalPersistence);

export default app;
