importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
const config = JSON.parse(params.get('firebaseConfig') || '{}');
firebase.initializeApp(config);

const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ notification }) => {
  if (!notification) return;
  self.registration.showNotification(notification.title || 'DukaPOS sale', {
    body: notification.body || 'A sale was completed.',
  });
});
