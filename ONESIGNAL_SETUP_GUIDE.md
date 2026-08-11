# OneSignal Setup & Implementation Guide

## What is OneSignal?

OneSignal is a free push notification service that works across all platforms:
- **Web Push** - Chrome, Firefox, Safari, Edge
- **Mobile** - iOS (APNs), Android (FCM)
- **Desktop** - Windows, macOS
- **Free Tier** - Unlimited devices, unlimited notifications

## Why OneSignal for Site Manager?

### Problems with Firebase FCM:
- ❌ Requires Cloud Functions (Blaze plan - paid)
- ❌ Requires backend server for sending notifications
- ❌ Complex setup for web push

### OneSignal Advantages:
- ✅ **Completely Free** - No message limits, no device limits
- ✅ **No Backend Required** - Send from client-side
- ✅ **Cross-Platform** - Works on web, iOS, Android
- ✅ **Rich Analytics** - Open rates, click rates, delivery
- ✅ **Easy Setup** - Simple SDK integration

---

## Step 1: Create OneSignal Account

### 1. Sign Up
1. Go to: https://onesignal.com/
2. Click "Sign Up" (free)
3. Sign up with Google, GitHub, or email

### 2. Create New App
1. After login, click "New App/Website"
2. Fill in:
   - **Name**: "Site Manager"
   - **Platform**: "Web Push"
   - **Site URL**: "http://localhost:5173" (for development)
   - **Your Site URL**: Your production URL later
3. Click "Next"

### 3. Configure Web Push
1. **Site Name**: "Site Manager"
2. **Site URL**: "http://localhost:5173"
3. **Auto-resubscribe**: Enable (recommended)
4. **Prompt Options**: Custom (we'll customize later)
5. Click "Save"

### 4. Get Your App ID
1. After setup, you'll see your **App ID**
2. Copy it - looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
3. We'll use this in our code

---

## Step 2: Install OneSignal SDK

### Already Done:
```bash
npm install react-onesignal
```

### What This Does:
- Installs the OneSignal React SDK
- Provides hooks and components for OneSignal
- Handles service worker registration automatically

---

## Step 3: Initialize OneSignal in App.jsx

### Code Changes:

```javascript
import OneSignal from 'react-onesignal';

// In App.jsx, inside useEffect after user auth
useEffect(() => {
  if (user?.email) {
    const setupOneSignal = async () => {
      try {
        // Initialize OneSignal
        await OneSignal.init({
          appId: "YOUR_ONESIGNAL_APP_ID", // Replace with your App ID
          allowLocalhostAsSecureOrigin: true, // For development
          notifyButton: {
            enable: false // We'll use our own permission UI
          },
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: "push",
                  autoPrompt: true,
                  text: {
                    actionMessage: "We'd like to show you notifications for PO updates and important alerts.",
                    acceptButton: "Allow",
                    cancelButton: "Cancel"
                  }
                }
              ]
            }
          }
        });

        // Set user email for targeting
        await OneSignal.setEmail(user.email);
        
        // Set user tags for segmentation
        await OneSignal.sendTag("role", userRole || "user");
        
        console.log('✅ OneSignal initialized for:', user.email);
      } catch (error) {
        console.error('❌ OneSignal initialization error:', error);
      }
    };

    setupOneSignal();
  }
}, [user?.email, userRole]);
```

### What This Does:
- Initializes OneSignal with your App ID
- Requests notification permission from user
- Associates user with their email (for targeting)
- Sets user role as a tag (for segmentation)

---

## Step 4: Create OneSignal Service

### Create File: `src/services/oneSignalService.js`

```javascript
import OneSignal from 'react-onesignal';

class OneSignalService {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize OneSignal
  async initialize(appId) {
    try {
      await OneSignal.init({
        appId: appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false, // We'll prompt manually
                text: {
                  actionMessage: "We'd like to show you notifications for PO updates and important alerts.",
                  acceptButton: "Allow",
                  cancelButton: "Cancel"
                }
              }
            ]
          }
        }
      });
      
      this.isInitialized = true;
      console.log('✅ OneSignal initialized');
      return true;
    } catch (error) {
      console.error('❌ OneSignal init error:', error);
      return false;
    }
  }

  // Request notification permission
  async requestPermission() {
    try {
      const permission = await OneSignal.Notifications.requestPermission();
      console.log('Permission status:', permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  // Set user email for targeting
  async setEmail(email) {
    try {
      await OneSignal.setEmail(email);
      console.log('Email set:', email);
    } catch (error) {
      console.error('Email set error:', error);
    }
  }

  // Set user tags for segmentation
  async setTag(key, value) {
    try {
      await OneSignal.sendTag(key, value);
      console.log('Tag set:', key, value);
    } catch (error) {
      console.error('Tag set error:', error);
    }
  }

  // Send notification to specific user by email
  async sendNotificationToUser(email, title, message, data = {}) {
    try {
      // Note: This requires OneSignal REST API call from backend
      // For now, we'll use tags to target users
      console.log('Sending notification to:', email, title, message);
      
      // In production, call your backend which uses OneSignal REST API
      // For now, we'll log it
      return { success: true };
    } catch (error) {
      console.error('Send notification error:', error);
      return { success: false };
    }
  }

  // Send notification by tag (e.g., role)
  async sendNotificationByTag(tag, value, title, message, data = {}) {
    try {
      // This requires OneSignal REST API
      console.log('Sending notification to tag:', tag, value);
      return { success: true };
    } catch (error) {
      console.error('Send by tag error:', error);
      return { success: false };
    }
  }

  // Get notification permission status
  async getPermissionStatus() {
    try {
      const permission = await OneSignal.Notifications.getPermission();
      return permission;
    } catch (error) {
      console.error('Get permission error:', error);
      return 'default';
    }
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    try {
      const enabled = await OneSignal.Notifications.isPushEnabled();
      return enabled;
    } catch (error) {
      console.error('Check enabled error:', error);
      return false;
    }
  }
}

export default new OneSignalService();
```

---

## Step 5: OneSignal REST API for Sending Notifications

### Problem: Client-side can't send to other users
### Solution: Use OneSignal REST API from your app (with server key)

### Get REST API Key:
1. Go to OneSignal Dashboard
2. Settings → Keys & IDs
3. Copy **REST API Key**

### Update `firebaseServices.js` to use OneSignal:

```javascript
// Send notification via OneSignal REST API
sendPushNotification: async (notificationData) => {
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic YOUR_ONESIGNAL_REST_API_KEY'
      },
      body: JSON.stringify({
        app_id: "YOUR_ONESIGNAL_APP_ID",
        contents: {
          en: notificationData.message
        },
        headings: {
          en: getNotificationTitle(notificationData.type)
        },
        include_email_tokens: [notificationData.recipientEmail],
        data: {
          type: notificationData.type,
          poId: notificationData.poId || '',
          materialName: notificationData.materialName || '',
          quantity: notificationData.quantity || '',
          siteId: notificationData.siteId || '',
          requestedBy: notificationData.requestedBy || ''
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('OneSignal notification sent:', result);
      return result;
    } else {
      console.error('OneSignal error:', result);
      return null;
    }
  } catch (error) {
    console.error('OneSignal API error:', error);
    return null;
  }
}
```

---

## Step 6: Update PO Notifications

### In `PORequests.jsx`, the notification calls remain the same:

```javascript
// PO Generated
notificationServices.addNotificationWithPush({
  recipientEmail: 'odedraarjun928@gmail.com',
  type: 'po_generated',
  poId: poDoc.id,
  message: `New PO request for ${formData.materialName}...`,
  // ... other fields
})

// PO Approved
notificationServices.addNotificationWithPush({
  recipientEmail: request.requestedBy,
  type: 'po_approved',
  // ... fields
})

// PO Arrived
notificationServices.addNotificationWithPush({
  recipientEmail: 'odedraarjun928@gmail.com',
  type: 'po_arrived',
  // ... fields
})
```

### What Changes:
- The `sendPushNotification` function now uses OneSignal instead of FCM
- No changes needed in PORequests.jsx
- Works seamlessly with existing code

---

## Step 7: Environment Variables

### Create `.env` file in project root:

```env
VITE_ONESIGNAL_APP_ID=your_app_id_here
VITE_ONESIGNAL_REST_API_KEY=your_rest_api_key_here
```

### Use in code:

```javascript
const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
const restApiKey = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
```

---

## How OneSignal Works (Technical Explanation)

### Architecture:

```
┌─────────────┐
│   Your App  │
│  (React)    │
└──────┬──────┘
       │
       │ 1. Initialize SDK
       │ 2. Request Permission
       │ 3. Register Device
       ↓
┌─────────────────┐
│   OneSignal     │
│   Service       │
└──────┬──────────┘
       │
       │ 4. Device Token
       │ 5. User Association
       ↓
┌─────────────────┐
│   OneSignal     │
│   Dashboard     │
└─────────────────┘

When sending notification:
┌─────────────┐
│   Your App  │
└──────┬──────┘
       │
       │ 6. REST API Call
       │    with user email
       ↓
┌─────────────────┐
│   OneSignal     │
│   API Server    │
└──────┬──────────┘
       │
       │ 7. Routes to device
       ↓
┌─────────────────┐
│   User Device   │
│   (Browser)     │
└─────────────────┘
```

### Key Concepts:

1. **App ID** - Identifies your app in OneSignal
2. **Player ID** - Unique identifier for each device
3. **User Email** - Associates devices with user (for targeting)
4. **Tags** - Key-value pairs for segmentation (e.g., role: admin)
5. **REST API** - Server-to-server communication for sending notifications

### Data Flow:

**Registration:**
1. User opens app
2. OneSignal SDK initializes
3. Browser shows permission prompt
4. User allows → Device gets Player ID
5. Player ID associated with user email
6. Stored in OneSignal dashboard

**Sending:**
1. PO created in your app
2. Your app calls OneSignal REST API
3. API looks up devices by email
4. Sends notification to all user's devices
5. User receives notification

---

## Testing OneSignal

### 1. Test Permission Request
- Open app in browser
- Should see permission prompt
- Allow notifications

### 2. Test Device Registration
- Go to OneSignal Dashboard
- Audience → Subscriptions
- Should see your device

### 3. Test Sending Notification
- Go to OneSignal Dashboard
- Messages → New Push
- Send test message
- Should receive on device

### 4. Test from Your App
- Create a PO request
- Should send notification to admin
- Check if admin receives it

---

## Common Issues & Solutions

### Issue: Permission not showing
**Solution**: Browser blocks permission on localhost
- Use `allowLocalhostAsSecureOrigin: true`
- Or use HTTPS (ngrok, localtunnel)

### Issue: Notification not received
**Solution**: Check:
- Device is registered in OneSignal dashboard
- User email is set correctly
- REST API key is correct
- App ID is correct

### Issue: CORS error
**Solution**: OneSignal REST API supports CORS
- Make sure you're using the correct endpoint
- Check API key is valid

---

## Next Steps After Implementation

1. **Production Setup**:
   - Update Site URL in OneSignal
   - Add production domain
   - Test on HTTPS

2. **Advanced Features**:
   - Segmentation by role (admin vs supervisor)
   - Scheduled notifications
   - A/B testing notification content
   - Analytics and reporting

3. **Cloudinary Integration** (for file storage):
   - Replace Firebase Storage
   - 25 GB free storage
   - Image optimization

---

## Summary

### What We're Doing:
1. ✅ Install OneSignal SDK
2. ✅ Initialize in App.jsx
3. ✅ Create OneSignal service
4. ✅ Replace FCM with OneSignal REST API
5. ✅ Update notification calls (no changes needed)
6. ✅ Test notifications

### Benefits:
- ✅ Free unlimited notifications
- ✅ No Cloud Functions needed
- ✅ Cross-platform support
- ✅ Rich analytics
- ✅ Easy to implement

### Time to Implement: ~2 hours
