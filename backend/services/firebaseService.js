const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

// Determine the credentials path
const credentialsFile = 'baknusmail-firebase-adminsdk-fbsvc-6aef8137e1.json';
const credentialsPath = path.join(__dirname, '..', 'config', credentialsFile);

let db = null;
let messaging = null;
let initialized = false;

try {
  if (fs.existsSync(credentialsPath)) {
    const serviceAccount = require(credentialsPath);
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    messaging = getMessaging();
    initialized = true;
    console.log('Firebase Admin SDK initialized successfully in firebaseService.');
  } else {
    console.warn(`Firebase credentials file not found at: ${credentialsPath}`);
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK in firebaseService:', error.message);
}

/**
 * Sends a push notification using Firebase Cloud Messaging (FCM) when a new email is received.
 * @param {string} to - The recipient's email address.
 * @param {string} from - The sender's email address.
 * @param {string} subject - The subject of the email.
 * @returns {Promise<object>} Result of the notification attempt.
 */
async function sendEmailNotification(to, from, subject) {
  if (!initialized || !db || !messaging) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify credentials.');
  }

  const userEmail = to.toLowerCase().trim();
  console.log(`Searching FCM token for recipient: ${userEmail}`);

  try {
    // 1. Fetch the document from firestore collection 'user_tokens' with ID = userEmail
    const docRef = db.collection('user_tokens').doc(userEmail);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`No FCM token document found in 'user_tokens' for email: ${userEmail}`);
      return { success: false, reason: 'Token not found in Firestore for this recipient' };
    }

    const data = doc.data();
    const fcmToken = data.fcm_token;

    if (!fcmToken) {
      console.log(`fcm_token field is empty for user: ${userEmail}`);
      return { success: false, reason: 'fcm_token field is missing or empty' };
    }

    // 2. Prepare the notification payload
    const message = {
      notification: {
        title: `Email Baru dari ${from}`,
        body: subject
      },
      data: {
        email_to: to,
        email_from: from,
        subject: subject
      },
      token: fcmToken
    };

    // 3. Send message using FCM
    console.log(`Sending FCM notification to token: ${fcmToken}`);
    const response = await messaging.send(message);
    console.log('Successfully sent message:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

module.exports = {
  sendEmailNotification
};
