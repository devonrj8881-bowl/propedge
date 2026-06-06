/**
 * Firebase Initialization and Configuration
 * Imports Firebase libraries and initializes the app
 */

// Import Firebase modules from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-analytics.js';

// Firebase configuration
// NOTE: Replace these with your actual Firebase project credentials
// Get these from Firebase Console: Project Settings
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDemoKeyForDevelopmentOnly",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "propedge-demo.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "propedge-demo",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "propedge-demo.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

console.log('Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: '[redacted]'
});

// Initialize Firebase
let app, auth, db, analytics;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  analytics = getAnalytics(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

// Export for use in other modules
export { app, auth, db, analytics };

// Make available globally for inline scripts
window.firebase = {
  app,
  auth,
  db,
  analytics
};

// Log auth state changes
if (auth) {
  import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js')
    .then(module => {
      module.onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('✅ User authenticated:', user.email);
          window.currentUser = user;
        } else {
          console.log('⚠️  No user authenticated');
          window.currentUser = null;
        }
      });
    });
}
