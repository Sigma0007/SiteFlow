import OneSignal from 'react-onesignal';

class OneSignalService {
  constructor() {
    this.isInitialized = false;
    this.initPromise = null;
  }

  // Initialize OneSignal SDK
  async initialize(appId, userEmail) {
    if (!appId) {
      console.warn('OneSignal App ID is missing');
      return false;
    }

    if (this.isInitialized) {
      if (userEmail) await this.setUser(userEmail);
      return true;
    }

    if (this.initPromise) {
      await this.initPromise;
      if (userEmail) await this.setUser(userEmail);
      return true;
    }

    this.initPromise = (async () => {
      try {
        console.log('📱 Initializing OneSignal...');
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          notifyButton: { enable: false }
        });

        this.isInitialized = true;
        console.log('✅ OneSignal initialized successfully');

        if (userEmail) {
          await this.setUser(userEmail);
        }

        // Auto-request push notification permission if default
        await this.requestPermission();
        return true;
      } catch (error) {
        console.warn('⚠️ OneSignal initialization warning (check Web Push platform setup in OneSignal dashboard):', error.message || error);
        this.isInitialized = false;
        // Fallback: request standard browser Notification permission
        await this.requestPermission();
        return false;
      }
    })();

    return this.initPromise;
  }

  // Bind current device push subscription to user email
  async setUser(email) {
    if (!email || !this.isInitialized) return;
    try {
      // 1. OneSignal v16 login (sets external_id)
      if (typeof OneSignal.login === 'function') {
        await OneSignal.login(email);
        console.log('✅ Logged into OneSignal as:', email);
      }

      // 2. Set email tag for filter fallback
      if (OneSignal.User && typeof OneSignal.User.addTag === 'function') {
        await OneSignal.User.addTag('email', email);
      } else if (typeof OneSignal.sendTag === 'function') {
        await OneSignal.sendTag('email', email);
      }

      // 3. Add email
      if (OneSignal.User && typeof OneSignal.User.addEmail === 'function') {
        await OneSignal.User.addEmail(email);
      }
    } catch (err) {
      console.warn('OneSignal setUser notice:', err);
    }
  }

  // Request push notification permission
  async requestPermission() {
    try {
      let permissionStatus = 'default';
      if (this.isInitialized && OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
        permissionStatus = await OneSignal.Notifications.requestPermission();
      } else if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        permissionStatus = await Notification.requestPermission();
      }
      console.log('📱 Push Notification Permission Status:', permissionStatus);
      return permissionStatus === 'granted';
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }
}

export default new OneSignalService();
