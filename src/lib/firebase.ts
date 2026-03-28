import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, collection, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  
};

// sanity check:
if (!firebaseConfig.projectId) {
  throw new Error('Missing env: VITE_FIREBASE_PROJECT_ID');
}
if (!firebaseConfig.apiKey) {
  throw new Error('Missing env: VITE_FIREBASE_API_KEY');
}

console.log('Firebase config', {
  apiKey: Boolean(firebaseConfig.apiKey),
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
  measurementId: firebaseConfig.measurementId,
});

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('Firebase Analytics enabled');
    }
  })
  .catch((reason) => {
    console.warn('analytics not supported', reason);
  });

export { analytics };

export async function testFirebaseHealth(): Promise<boolean> {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot && snapshot.size >= 0;
  } catch (err) {
    console.warn('Firebase health check failed:', err);
    return false;
  }
}

enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Firestore persistence not enabled:', err.code || err.message);
});