import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../firebase';

class PushNotificationService {
  constructor() {
    this.token = null;
    this.permission = 'default';
    this.listeners = [];
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }

    return false;
  }

  // Get FCM token
  async getToken() {
    try {
      if (this.permission !== 'granted') {
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
          throw new Error('Notification permission denied');
        }
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered:', registration);

      // Get FCM token (without VAPID key for now)
      const token = await getToken(messaging, {
        serviceWorkerRegistration: registration
      });

      if (token) {
        this.token = token;
        console.log('FCM Token obtained:', token);
        return token;
      } else {
        throw new Error('No registration token available');
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      throw error;
    }
  }

  // Listen for foreground messages
  onMessage(callback) {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      callback(payload);
    });
    return unsubscribe;
  }

  // Save FCM token to user document in Firestore
  async saveTokenToUser(userEmail, token) {
    try {
      // This will be implemented using your existing notification services
      // You'll need to add a field to store FCM tokens in user documents
      console.log('Saving token for user:', userEmail, token);
      // Implementation depends on your user document structure
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  }

  // Get current token
  getCurrentToken() {
    return this.token;
  }

  // Get current permission status
  getPermissionStatus() {
    return this.permission;
  }
}

export default new PushNotificationService();
