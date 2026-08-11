/**
 * Cloudflare Worker for OneSignal Push Notifications
 * 
 * This worker acts as a proxy to send push notifications via OneSignal REST API.
 * It solves the CORS issue by making the request from Cloudflare's edge network.
 * 
 * Free Tier: 100,000 requests per day
 * Benefits: 
 * - Zero cold start
 * - Edge computing (fastest globally)
 * - Automatic HTTPS
 * - No server to manage
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Handle GET requests (health checks & browser navigation)
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'Site Flow Notification Worker',
        app_id_set: !!env.ONESIGNAL_APP_ID,
        app_id_preview: env.ONESIGNAL_APP_ID ? env.ONESIGNAL_APP_ID.substring(0, 8) + '...' : 'NOT_CONFIGURED',
        api_key_set: !!env.ONESIGNAL_REST_API_KEY
      }), {
        status: 200,
        headers: corsHeaders()
      });
    }

    // Only allow POST requests for sending notifications
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Send a POST request to deliver notifications.' }), {
        status: 405,
        headers: corsHeaders()
      });
    }

    try {
      // Parse request body
      const body = await request.json();
      const { recipientEmail, message, type, poId, materialName, quantity, siteId, requestedBy } = body;

      // Log incoming request for debugging
      console.log('Received notification request:', { recipientEmail, message, type, poId });

      // Validate required fields
      if (!recipientEmail || !message) {
        console.error('Validation error: missing required fields', { recipientEmail, message });
        return new Response(JSON.stringify({ error: 'recipientEmail and message are required' }), {
          status: 400,
          headers: corsHeaders()
        });
      }

      // Prepare OneSignal Web Push notification payload
      const payload = {
        app_id: env.ONESIGNAL_APP_ID,
        contents: {
          en: message
        },
        headings: {
          en: getNotificationTitle(type)
        },
        include_aliases: {
          external_id: [recipientEmail]
        },
        target_channel: 'push',
        include_external_user_ids: [recipientEmail],
        data: {
          type: type || 'notification',
          poId: poId || '',
          materialName: materialName || '',
          quantity: quantity || '',
          siteId: siteId || '',
          requestedBy: requestedBy || ''
        },
        web_url: request.headers.get('Origin') || 'https://siteflow-c93e8.web.app'
      };

      console.log('ONESIGNAL_APP_ID from env:', env.ONESIGNAL_APP_ID);
      console.log('ONESIGNAL_REST_API_KEY from env:', env.ONESIGNAL_REST_API_KEY ? env.ONESIGNAL_REST_API_KEY.substring(0, 20) + '...' : 'UNDEFINED');
      console.log('Payload app_id:', payload.app_id);
      console.log('Sending to OneSignal:', payload);

      // Send request to OneSignal API
      const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${env.ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const result = await oneSignalResponse.json();
      console.log('OneSignal response:', result);

      // Return OneSignal response
      return new Response(JSON.stringify(result), {
        status: oneSignalResponse.status,
        headers: corsHeaders()
      });

    } catch (error) {
      // Handle errors
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders()
      });
    }
  }
};

/**
 * Handle CORS preflight requests
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

/**
 * CORS headers for all responses
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

/**
 * Get notification title based on type
 */
function getNotificationTitle(type) {
  switch (type) {
    case 'po_generated':
      return 'PO Request Created';
    case 'po_approved':
      return 'PO Approved';
    case 'po_arrived':
      return 'Material Arrived';
    case 'po_rejected':
      return 'PO Rejected';
    case 'material_low':
      return 'Low Stock Alert';
    case 'attendance_alert':
      return 'Attendance Alert';
    default:
      return 'Site Manager';
  }
}
