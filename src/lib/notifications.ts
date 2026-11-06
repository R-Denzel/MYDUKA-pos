import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, auth, db, firebaseConfig } from '@/lib/firebase';
import { toast } from 'sonner';

let foregroundListenerAttached = false;

export async function enableSaleNotifications(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before enabling sale notifications.');

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('Push notifications need VITE_FIREBASE_VAPID_KEY configured.');
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support push notifications.');
  }
  if (!(await isSupported())) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registrationUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
  registrationUrl.searchParams.set('firebaseConfig', JSON.stringify(firebaseConfig));
  const registration = await navigator.serviceWorker.register(registrationUrl.toString());
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

  if (!token) throw new Error('Firebase did not provide a notification token.');
  await setDoc(doc(db, 'users', user.uid, 'devices', token), {
    updatedAt: new Date().toISOString(),
  });

  if (!foregroundListenerAttached) {
    foregroundListenerAttached = true;
    onMessage(messaging, (payload) => {
      if (payload.notification?.body) toast.info(payload.notification.body);
    });
  }
}
