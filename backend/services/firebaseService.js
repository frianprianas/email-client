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
    // 1. Ambil dokumen dari Firestore 'user_tokens'
    const docRef = db.collection('user_tokens').doc(userEmail); 
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log(`Token tidak ditemukan untuk ${userEmail}`);
      return { success: false, reason: 'Token not found in Firestore for this recipient' };
    }
    
    const fcmToken = doc.data().fcm_token;
    if (!fcmToken) {
      console.log(`fcm_token field is empty for user: ${userEmail}`);
      return { success: false, reason: 'fcm_token field is missing or empty' };
    }

    // 2. Buat & kirim payload FCM Push Notification (DATA ONLY - Notifikasi Universal)
    const message = {
      android: {
        priority: "high",
        collapseKey: "baknus_email_latest"
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        route: "/home",
        email_to: to,
        email_from: from,
        subject: subject,
        notif_title: "Pesan Masuk",
        notif_body: "Anda mendapat pesan masuk",
        channel_id: "channel_email_umum_v3",
        sound_name: "sound_umum"
      },
      token: fcmToken
    };

    console.log(`Sending universal FCM data-only notification to token: ${fcmToken} (channel: channel_email_umum_v3, sound: sound_umum)`);
    const response = await messaging.send(message);
    console.log('Successfully sent FCM data-only message:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

module.exports = {
  sendEmailNotification
};
