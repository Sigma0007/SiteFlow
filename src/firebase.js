// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
// import { getAnalytics } from "firebase/analytics"; // Disabled for development
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, inMemoryPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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

// Initialize Firebase Firestore with modern persistent local cache
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
export const messaging = getMessaging(app);

// Get FCM token for push notifications
export const getFCMToken = async () => {
  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('Service Worker registered:', registration);

    // Get FCM token (without VAPID key for now - will work with default Firebase settings)
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration
    });
    
    if (token) {
      console.log('FCM Token obtained:', token);
      return token;
    } else {
      throw new Error('No registration token available');
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  return onMessage(messaging, callback);
};

// ─── Secondary Firebase App (for creating supervisor accounts) ────────────────
const secondaryApp = getApps().find(a => a.name === 'secondary')
  || initializeApp(firebaseConfig, 'secondary');
export const secondaryAuth = getAuth(secondaryApp);
// Ensure secondary auth doesn't overwrite primary auth session
setPersistence(secondaryAuth, inMemoryPersistence).catch(console.error);
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
