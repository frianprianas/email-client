const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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

    // 4. Auto Cleanup Token Invalid / Unregistered jika ada failure
    if (response.failureCount > 0 && response.responses) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.log(`Cleaning up ${invalidTokens.length} invalid/expired FCM token(s) for ${userEmail}...`);
        await docRef.update({
          fcm_tokens: FieldValue.arrayRemove(...invalidTokens)
        }).catch(err => {
          console.error(`Failed to cleanup invalid FCM tokens for ${userEmail}:`, err.message);
        });
      }
    }

    return { 
      success: true, 
      successCount: response.successCount, 
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Sends a push notification to ALL user devices registered in Firestore 'user_tokens' for attendance reminders.
 * @param {string} title - The notification title (e.g. "⏰ Pengingat Presensi Masuk")
 * @param {string} body - The notification body message.
 * @returns {Promise<object>} Result of the multicast notification attempt.
 */
async function sendAttendReminderToAll(title, body) {
  if (!initialized || !db || !messaging) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify credentials.');
  }

  console.log('[firebaseService] Mengumpulkan seluruh token FCM untuk pengingat presensi...');

  try {
    const snapshot = await db.collection('user_tokens').get();
    if (snapshot.empty) {
      console.log('[firebaseService] Koleksi user_tokens kosong. Tidak ada notifikasi yang dikirim.');
      return { success: false, reason: 'No user tokens found in Firestore' };
    }

    let allTokens = [];
    snapshot.forEach(doc => {
      const userData = doc.data() || {};
      let tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
      if (tokens.length === 0 && userData.fcm_token) {
        tokens = [userData.fcm_token];
      }
      allTokens.push(...tokens);
    });

    // Deduplicate and filter non-empty string tokens
    allTokens = Array.from(new Set(allTokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    if (allTokens.length === 0) {
      console.log('[firebaseService] Tidak ada token FCM valid yang ditemukan.');
      return { success: false, reason: 'No valid FCM tokens found' };
    }

    console.log(`[firebaseService] Mengirim pengingat presensi ke ${allTokens.length} perangkat...`);

    const chunkSize = 500; // FCM multicast max limit per batch
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < allTokens.length; i += chunkSize) {
      const batchTokens = allTokens.slice(i, i + chunkSize);

      const message = {
        android: {
          priority: 'high',
          collapseKey: 'baknus_attend_reminder'
        },
        data: {
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          route: '/attend',
          target: 'attend',
          notif_title: title,
          notif_body: body,
          channel_id: 'channel_baknus_attend_v3',
          sound_name: 'sound_baknus_attend'
        },
        tokens: batchTokens
      };

      const response = await messaging.sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    console.log(`[firebaseService] Finished sending attendance reminder. Success: ${totalSuccess}, Failure: ${totalFailure}`);
    return {
      success: true,
      totalTokens: allTokens.length,
      successCount: totalSuccess,
      failureCount: totalFailure
    };
  } catch (error) {
    console.error('[firebaseService] Failed to send attendance reminder:', error);
    throw new Error(`Failed to send attendance reminder: ${error.message}`);
  }
}

module.exports = {
  sendEmailNotification,
  sendAttendReminderToAll
};
