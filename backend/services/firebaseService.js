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

    // 2. Tentukan channel_id & sound berdasarkan pengirim / subjek email
    const lowerFrom = (from || "").toLowerCase();
    const lowerSubject = (subject || "").toLowerCase();
    let channelId = "channel_email_umum_v3";
    let soundName = "sound_umum";
    if (
      lowerFrom.includes("attend") ||
      lowerFrom.includes("presensi") ||
      lowerSubject.includes("baknusattend") ||
      lowerSubject.includes("attend") ||
      lowerSubject.includes("presensi") ||
      lowerSubject.includes("kehadiran")
    ) {
      channelId = "channel_baknus_attend_v3";
      soundName = "sound_baknus_attend";
    } else if (
      lowerFrom.includes("drive") ||
      lowerSubject.includes("baknusdrive") ||
      lowerSubject.includes("drive") ||
      lowerSubject.includes("berkas") ||
      lowerSubject.includes("penyimpanan")
    ) {
      channelId = "channel_baknus_drive_v3";
      soundName = "sound_baknus_drive";
    } else if (
      lowerFrom.includes("talim") ||
      lowerFrom.includes("ta'lim") ||
      lowerSubject.includes("baknustalim") ||
      lowerSubject.includes("talim") ||
      lowerSubject.includes("ta'lim") ||
      lowerSubject.includes("kajian")
    ) {
      channelId = "channel_baknus_talim_v3";
      soundName = "sound_baknus_talim";
    }

    // 3. Buat & kirim payload FCM Push Notification (DATA ONLY)
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
        notif_title: "Email Baru",
        notif_body: "Anda mendapatkan pesan baru",
        channel_id: channelId,
        sound_name: soundName
      },
      token: fcmToken
    };

    console.log(`Sending FCM data-only notification to token: ${fcmToken} (channel: ${channelId}, sound: ${soundName})`);
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
