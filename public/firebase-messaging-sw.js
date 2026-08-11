// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyAzEeofBjsiV-EglmTQexG9VVZ5uR5Rzi4",
  authDomain: "siteflow-c93e8.firebaseapp.com",
  projectId: "siteflow-c93e8",
  storageBucket: "siteflow-c93e8.firebasestorage.app",
  messagingSenderId: "619615369937",
  appId: "1:619615369937:web:620f0bb66ad610955fe3f0"
});

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Site Manager Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/favicon-96x96.png',
    data: payload.data,
    tag: payload.data?.type || 'general-notification',
    requireInteraction: true,
    click_action: payload.fcmOptions?.link || '/'
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Get notification data
  const data = event.notification.data || {};
  const url = data.click_action || data.url || '/';

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === new URL(url, self.location.origin).href && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
