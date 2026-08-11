# Cloudflare Workers Deployment Guide

## What is Cloudflare Workers?

**Cloudflare Workers** is a serverless platform that runs your code at the edge (closest to users worldwide).

### Key Benefits:
- **Free Tier**: 100,000 requests per day
- **Zero Cold Start**: Instant response time
- **Edge Computing**: Runs in 300+ locations globally
- **Automatic HTTPS**: SSL certificates included
- **No Server Management**: Focus on code only

### How It Works:
```
Your App → Cloudflare Worker → OneSignal API
         (solves CORS)       (sends notification)
```

---

## Step 1: Install Wrangler CLI

**Wrangler** is Cloudflare's command-line tool for deploying workers.

### For Windows (PowerShell):
```powershell
npm install -g wrangler
```

### Verify Installation:
```powershell
wrangler --version
```

Should show version like: `wrangler 3.x.x`

---

## Step 2: Login to Cloudflare

```powershell
wrangler login
```

This will:
1. Open your browser
2. Ask you to login to Cloudflare
3. Authorize Wrangler CLI
4. Save authentication token locally

**Note:** You need a free Cloudflare account (create at https://dash.cloudflare.com/sign-up)

---

## Step 3: Navigate to Worker Directory

```powershell
cd "c:\Users\Asus\Site Manager\cloudflare-worker"
```

---

## Step 4: Set Environment Variables (Secrets)

These are your OneSignal API keys. They are stored securely in Cloudflare.

### Set OneSignal App ID:
```powershell
wrangler secret put ONESIGNAL_APP_ID
```

You'll be prompted to enter the value. Paste your OneSignal App ID.

### Set OneSignal REST API Key:
```powershell
wrangler secret put ONESIGNAL_REST_API_KEY
```

You'll be prompted to enter the value. Paste your OneSignal REST API Key.

**Where to get these keys:**
1. Go to https://onesignal.com/
2. Login → Your App → Settings → Keys & IDs
3. Copy App ID and REST API Key

---

## Step 5: Test Worker Locally (Optional)

Before deploying, you can test locally:

```powershell
wrangler dev
```

This will:
- Start a local development server
- Show a URL like: `http://localhost:8787`
- You can test with curl or Postman

**Test with curl:**
```powershell
curl -X POST http://localhost:8787 `
  -H "Content-Type: application/json" `
  -d '{"recipientEmail":"test@example.com","message":"Test notification","type":"po_generated"}'
```

---

## Step 6: Deploy to Cloudflare

```powershell
wrangler deploy
```

This will:
- Upload your worker code
- Deploy to Cloudflare's edge network
- Show your worker URL like: `https://site-manager-notifications.YOUR_SUBDOMAIN.workers.dev`

**Save this URL!** You'll need it for the next step.

---

## Step 7: Update .env File

Open `c:\Users\Asus\Site Manager\.env` and update:

```env
# Cloudflare Worker URL (after deployment)
VITE_CLOUDFLARE_WORKER_URL=https://site-manager-notifications.YOUR_SUBDOMAIN.workers.dev
```

Replace `YOUR_SUBDOMAIN` with your actual subdomain from deployment.

---

## Step 8: Restart Your App

```powershell
# Stop your current dev server (Ctrl+C)
# Then restart:
npm run dev
```

---

## Step 9: Test Push Notifications

1. Login as **Supervisor**
2. Create a **PO Request**
3. Check console for: `✅ Push notification sent via Cloudflare Worker`
4. Login as **Admin**
5. Check if notification appears in **Bell Icon** (top right)
6. Check if **browser notification** appears (if allowed)

---

## Understanding the Code

### Worker Code (`cloudflare-worker/src/index.js`):

```javascript
export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // 2. Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders()
      });
    }

    // 3. Parse request body
    const body = await request.json();
    const { recipientEmail, message, type } = body;

    // 4. Prepare OneSignal payload
    const payload = {
      app_id: env.ONESIGNAL_APP_ID,  // From secrets
      contents: { en: message },
      include_email_tokens: [recipientEmail]
    };

    // 5. Call OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${env.ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    // 6. Return response
    return new Response(JSON.stringify(await response.json()), {
      headers: corsHeaders()
    });
  }
};
```

### Configuration (`wrangler.toml`):

```toml
name = "site-manager-notifications"  # Worker name
main = "src/index.js"                 # Entry file
compatibility_date = "2024-01-01"    # Runtime version
```

### Client Code (`firebaseServices.js`):

```javascript
sendPushNotification: async (notificationData) => {
  const workerUrl = import.meta.env.VITE_CLOUDFLARE_WORKER_URL;
  
  const response = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientEmail: notificationData.recipientEmail,
      message: notificationData.message,
      type: notificationData.type
    })
  });
  
  return await response.json();
}
```

---

## Common Commands

### Deploy:
```powershell
wrangler deploy
```

### View logs:
```powershell
wrangler tail
```

### Delete worker:
```powershell
wrangler delete
```

### List all workers:
```powershell
wrangler deployments list
```

---

## Troubleshooting

### Error: "Not authenticated"
```powershell
wrangler login
```

### Error: "Secret not found"
```powershell
wrangler secret put ONESIGNAL_APP_ID
wrangler secret put ONESIGNAL_REST_API_KEY
```

### Error: "CORS error"
- Check that `corsHeaders()` function is included
- Check that OPTIONS method is handled

### Error: "Invalid credentials"
- Verify OneSignal App ID and REST API Key
- Check that secrets are set correctly

### Worker not responding:
```powershell
wrangler tail
```
Check logs for errors.

---

## Monitoring

### View Worker Dashboard:
1. Go to https://dash.cloudflare.com/
2. Select your account
3. Click "Workers & Pages"
4. Click your worker
5. View metrics, logs, and analytics

### Free Tier Limits:
- 100,000 requests per day
- 10ms CPU time per request
- 128MB memory

### Upgrade to Paid (if needed):
- $5/month for 10 million requests
- $0.50 per million additional requests

---

## Advanced Features

### Scheduled Tasks (Cron):
Add to `wrangler.toml`:
```toml
[triggers]
crons = ["0 * * * *"]  # Run every hour
```

### KV Storage (Caching):
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
```

### D1 Database:
```toml
[[d1_databases]]
binding = "DB"
database_name = "site-manager-db"
```

---

## Summary

**What You Learned:**
1. ✅ Cloudflare Workers - Edge computing platform
2. ✅ Wrangler CLI - Deployment tool
3. ✅ Secrets management - Secure API keys
4. ✅ CORS handling - Cross-origin requests
5. ✅ Environment variables - Configuration

**Deployment Steps:**
1. Install Wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Set secrets: `wrangler secret put ONESIGNAL_APP_ID`
4. Deploy: `wrangler deploy`
5. Update .env with worker URL
6. Restart app and test

**Benefits:**
- Free (100k requests/day)
- Fast (zero cold start)
- Global (300+ locations)
- Secure (automatic HTTPS)
- Easy (no server management)

---

## Next Steps

1. **Deploy your worker** following the steps above
2. **Test notifications** in your app
3. **Monitor usage** in Cloudflare dashboard
4. **Scale up** if needed (paid plans available)

**Need help?**
- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
