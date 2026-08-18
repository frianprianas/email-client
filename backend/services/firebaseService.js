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
    
    const userData = doc.data() || {};
    
    // 2. Ambil daftar array fcm_tokens (atau fallback ke fcm_token tunggal jika lama)
    let tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
    if (tokens.length === 0 && userData.fcm_token) {
      tokens = [userData.fcm_token];
    }

    // Filter token kosong & hapus duplikat
    tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    if (tokens.length === 0) {
      console.log(`Tidak ada token FCM valid untuk user: ${userEmail}`);
      return { success: false, reason: 'No valid FCM tokens found for recipient' };
    }

    // 3. Buat & kirim payload FCM Multicast Push Notification (DATA ONLY)
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
      tokens: tokens
    };

    console.log(`Sending multicast FCM data-only notification to ${tokens.length} device(s) for ${userEmail}`);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Successfully processed multicast FCM message: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    return { 
      success: true, 
      successCount: response.successCount, 
      failureCount: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

module.exports = {
  sendEmailNotification
};
