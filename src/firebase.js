// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable authentication persistence
setPersistence(auth, browserLocalPersistence);

export default app;
