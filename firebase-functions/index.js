const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Cloud Function to send push notification when a new notification is created
exports.sendPushNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notificationData = snap.data();
    const recipientEmail = notificationData.recipientEmail;

    // Get FCM token for the recipient
    const userDoc = await admin.firestore().collection('users').doc(recipientEmail).get();
    
    if (!userDoc.exists) {
      console.log('User not found:', recipientEmail);
      return null;
    }

    const fcmToken = userDoc.data().fcmToken;
    
    if (!fcmToken) {
      console.log('No FCM token for user:', recipientEmail);
      return null;
    }

    // Prepare notification payload
    const message = {
      token: fcmToken,
      notification: {
        title: getNotificationTitle(notificationData.type),
        body: notificationData.message,
        icon: '/icon-192x192.png',
        click_action: '/'
      },
      data: {
        type: notificationData.type,
        poId: notificationData.poId || '',
        materialName: notificationData.materialName || '',
        quantity: notificationData.quantity || '',
        siteId: notificationData.siteId || '',
        requestedBy: notificationData.requestedBy || ''
      }
    };

    // Send push notification
    try {
      const response = await admin.messaging().send(message);
      console.log('Push notification sent successfully:', response);
      return response;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  });

// Helper function to get notification title based on type
function getNotificationTitle(type) {
  switch (type) {
    case 'po_generated':
      return 'New PO Request';
    case 'po_approved':
      return 'PO Approved';
    case 'po_arrived':
      return 'PO Arrived';
    default:
      return 'Site Manager Notification';
  }
}

// HTTP callable function to send push notification manually
exports.sendPushNotificationHTTP = functions.https.onCall(async (data, context) => {
  const { recipientEmail, type, message, poId, materialName, quantity, siteId, requestedBy } = data;

  // Get FCM token for the recipient
  const userDoc = await admin.firestore().collection('users').doc(recipientEmail).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const fcmToken = userDoc.data().fcmToken;
  
  if (!fcmToken) {
    throw new functions.https.HttpsError('not-found', 'No FCM token for user');
  }

  // Prepare notification payload
  const messagePayload = {
    token: fcmToken,
    notification: {
      title: getNotificationTitle(type),
      body: message,
      icon: '/icon-192x192.png',
      click_action: '/'
    },
    data: {
      type,
      poId: poId || '',
      materialName: materialName || '',
      quantity: quantity || '',
      siteId: siteId || '',
      requestedBy: requestedBy || ''
    }
  };

  // Send push notification
  try {
    const response = await admin.messaging().send(messagePayload);
    console.log('Push notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
