# Free Server Options for OneSignal Push Notifications

## Problem
OneSignal REST API cannot be called directly from browser due to CORS. Need a backend server to proxy requests.

## Free Server Options

### 1. **Render (Recommended)**
- **Free Tier**: 750 hours/month (enough for small apps)
- **Features**: 
  - Node.js, Python, Ruby support
  - Automatic HTTPS
  - Auto-deploy from GitHub
  - Persistent storage (limited)
- **Setup Time**: 10 minutes
- **Best For**: Simple Node.js proxy server
- **Limitations**: Spins down after 15 min inactivity (cold start ~30s)

**Example Code:**
```javascript
// server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/send-notification', async (req, res) => {
  const { recipientEmail, message, type } = req.body;
  
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      contents: { en: message },
      include_email_tokens: [recipientEmail]
    })
  });
  
  const result = await response.json();
  res.json(result);
});

app.listen(3000);
```

---

### 2. **Railway**
- **Free Tier**: $5 credit/month (renews monthly)
- **Features**:
  - Multiple languages (Node.js, Python, Go, etc.)
  - Built-in database (PostgreSQL, Redis)
  - Automatic HTTPS
  - Zero cold start
- **Setup Time**: 5 minutes
- **Best For**: Production-ready apps
- **Limitations**: Credit resets monthly, might need to pay after

---

### 3. **Vercel (Best for Serverless)**
- **Free Tier**: 100GB bandwidth/month, 100k invocations
- **Features**:
  - Serverless functions (no cold start issues)
  - Edge network (fast globally)
  - Automatic HTTPS
  - Git integration
- **Setup Time**: 5 minutes
- **Best For**: Serverless API endpoints
- **Limitations**: 10s execution limit (enough for API calls)

**Example Code:**
```javascript
// api/send-notification.js
export default async function handler(req, res) {
  const { recipientEmail, message } = req.body;
  
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      contents: { en: message },
      include_email_tokens: [recipientEmail]
    })
  });
  
  const result = await response.json();
  res.json(result);
}
```

---

### 4. **Cloudflare Workers**
- **Free Tier**: 100k requests/day
- **Features**:
  - Edge computing (fastest)
  - Zero cold start
  - Built-in D1 database
  - Automatic HTTPS
- **Setup Time**: 10 minutes
- **Best For**: High-performance API proxy
- **Limitations**: 10ms CPU time per request (very fast)

**Example Code:**
```javascript
// worker.js
export default {
  async fetch(request) {
    const { recipientEmail, message } = await request.json();
    
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        contents: { en: message },
        include_email_tokens: [recipientEmail]
      })
    });
    
    return response;
  }
}
```

---

### 5. **Supabase Edge Functions**
- **Free Tier**: 500k invocations/month
- **Features**:
  - TypeScript support
  - Built-in database
  - Real-time subscriptions
  - Automatic HTTPS
- **Setup Time**: 15 minutes
- **Best For**: If already using Supabase
- **Limitations**: Need to migrate to Supabase

---

### 6. **Netlify Functions**
- **Free Tier**: 125k invocations/month
- **Features**:
  - Serverless functions
  - Edge network
  - Automatic HTTPS
  - Git integration
- **Setup Time**: 5 minutes
- **Best For**: Static sites with API
- **Limitations**: 10s execution limit

---

## Comparison Table

| Service | Free Tier | Cold Start | Setup Time | Best For |
|---------|-----------|------------|------------|----------|
| **Render** | 750 hrs/month | Yes (~30s) | 10 min | Simple Node.js |
| **Railway** | $5 credit/month | No | 5 min | Production |
| **Vercel** | 100k invocations | No | 5 min | Serverless |
| **Cloudflare** | 100k requests/day | No | 10 min | Edge API |
| **Supabase** | 500k invocations | No | 15 min | If using Supabase |
| **Netlify** | 125k invocations | No | 5 min | Static sites |

---

## Recommendation for Site Manager

### **Option 1: Vercel (Easiest)**
- Zero cold start
- Serverless functions
- Easy deployment
- Free tier sufficient
- **Setup**: 5 minutes

### **Option 2: Render (Simple)**
- Traditional Node.js server
- Easy to understand
- Free tier sufficient
- **Setup**: 10 minutes

### **Option 3: Cloudflare Workers (Fastest)**
- Edge computing
- Zero cold start
- Best performance
- **Setup**: 10 minutes

---

## Implementation Steps (Vercel Example)

### 1. Create Vercel Account
- Go to https://vercel.com/
- Sign up with GitHub
- Import your project

### 2. Create API Function
Create `api/send-notification.js`:
```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipientEmail, message, type } = req.body;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        contents: { en: message },
        headings: { en: getNotificationTitle(type) },
        include_email_tokens: [recipientEmail]
      })
    });

    const result = await response.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function getNotificationTitle(type) {
  switch(type) {
    case 'po_generated': return 'PO Request Created';
    case 'po_approved': return 'PO Approved';
    case 'po_arrived': return 'Material Arrived';
    default: return 'Site Manager';
  }
}
```

### 3. Add Environment Variables
In Vercel dashboard:
- `ONESIGNAL_APP_ID`: Your OneSignal App ID
- `ONESIGNAL_REST_API_KEY`: Your OneSignal REST API Key

### 4. Deploy
- Push to GitHub
- Vercel auto-deploys
- Get your API URL: `https://your-project.vercel.app/api/send-notification`

### 5. Update Client Code
```javascript
// In firebaseServices.js
sendPushNotification: async (notificationData) => {
  try {
    const response = await fetch('https://your-project.vercel.app/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationData)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return null;
  }
}
```

---

## Alternative: Use OneSignal SDK Directly

Instead of REST API, use OneSignal SDK properly:

### Pros:
- No backend needed
- Works from client-side
- Handles CORS automatically
- Better for web push

### Cons:
- Need to configure OneSignal properly
- User must allow notifications
- Limited targeting compared to REST API

### Setup:
```javascript
// Already done in oneSignalService.js
// Just need to configure OneSignal dashboard properly
// Add your site URL to OneSignal
// Enable web push
```

---

## My Recommendation

**For Site Manager: Use OneSignal SDK Directly**

**Why:**
1. No backend needed
2. Free
3. Works from client-side
4. Already implemented in code
5. Just need to configure OneSignal dashboard

**Steps:**
1. Create OneSignal account
2. Add your site URL (http://localhost:5173 for dev)
3. Get App ID
4. Update .env file
5. Done!

**Backend server only needed if:**
- You want to send notifications without user interaction
- You need advanced targeting
- You want to send from server-side (e.g., scheduled notifications)

---

## Summary

**Free Server Options:**
1. **Vercel** - Best for serverless (recommended)
2. **Render** - Best for simple Node.js
3. **Cloudflare** - Best for performance
4. **Railway** - Best for production
5. **Supabase** - Best if using Supabase
6. **Netlify** - Best for static sites

**My Recommendation:**
- Use **OneSignal SDK directly** (no backend needed)
- If backend needed, use **Vercel** (easiest setup)
