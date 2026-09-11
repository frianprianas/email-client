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
 * Helper to extract clean email address from string (e.g. "Name <email@domain.com>" -> "email@domain.com")
 */
function extractCleanEmail(emailStr) {
  if (!emailStr || typeof emailStr !== 'string') return '';
  const match = emailStr.match(/<([^>]+)>/) || emailStr.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match ? match[1].toLowerCase().trim() : emailStr.toLowerCase().trim();
}

/**
 * Sends a push notification using Firebase Cloud Messaging (FCM) when a new email is received.
 * Supports:
 *  - sendEmailNotification(userTokens, emailData)
 *  - sendEmailNotification(toEmail, emailData)
 *  - sendEmailNotification(toEmail, from, subject, fromName)
 * @param {string|string[]} toOrTokens - Recipient email address or array of FCM tokens.
 * @param {string|object} param2 - Sender email string or emailData object.
 * @param {string} [param3] - Email subject.
 * @param {string} [param4] - Sender display name.
 * @returns {Promise<object>} Result of the notification attempt.
 */
async function sendEmailNotification(toOrTokens, param2, param3, param4) {
  if (!initialized || !db || !messaging) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify credentials.');
  }

  let tokens = [];
  let userEmail = '';
  let docRef = null;
  let emailData = {};

  if (Array.isArray(toOrTokens)) {
    tokens = toOrTokens;
    emailData = (typeof param2 === 'object' && param2 !== null)
      ? param2
      : { from: param2, subject: param3, fromName: param4 };
    userEmail = extractCleanEmail(emailData.to || '');
    if (userEmail) {
      docRef = db.collection('user_tokens').doc(userEmail);
    }
  } else if (typeof toOrTokens === 'string') {
    if (toOrTokens.includes('@')) {
      userEmail = extractCleanEmail(toOrTokens);
      emailData = (typeof param2 === 'object' && param2 !== null)
        ? { to: userEmail, ...param2 }
        : { to: userEmail, from: param2, subject: param3, fromName: param4 };

      docRef = db.collection('user_tokens').doc(userEmail);
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log(`[firebaseService] Token tidak ditemukan untuk ${userEmail}`);
        return { success: false, reason: 'Token not found in Firestore for this recipient', successCount: 0 };
      }

      const userData = doc.data() || {};
      tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
      if (tokens.length === 0 && userData.fcm_token) {
        tokens = [userData.fcm_token];
      }
    } else {
      tokens = [toOrTokens];
      emailData = (typeof param2 === 'object' && param2 !== null)
        ? param2
        : { from: param2, subject: param3, fromName: param4 };
      userEmail = extractCleanEmail(emailData.to || '');
      if (userEmail) {
        docRef = db.collection('user_tokens').doc(userEmail);
      }
    }
  }

  // Filter token kosong & hapus duplikat
  tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

  if (tokens.length === 0) {
    console.log(`[firebaseService] Tidak ada token FCM valid untuk user: ${userEmail || 'unknown'}`);
    return { success: false, reason: 'No valid FCM tokens found for recipient', successCount: 0 };
  }

  const senderDisplay = emailData.fromName || emailData.from || 'Pengirim Tidak Dikenal';
  const notifTitle = `Email dari ${senderDisplay}`;
  const notifBody = emailData.subject || "Anda menerima pesan email baru";

  const message = {
    // ⚠️ 1. WAJIB: Blok notification root agar OS Android langsung menampilkan banner notifikasi
    notification: {
      title: notifTitle,
      body: notifBody,
    },
    // ⚠️ 2. WAJIB: Konfigurasi Android agar masuk ke channel v4 dan berbunyi
    android: {
      priority: "high",
      notification: {
        channelId: "channel_email_umum_v4", // WAJIB: channel_email_umum_v4
        sound: "sound_umum",                 // File sound_umum.mp3 di client
        priority: "max",
        defaultSound: false,
        defaultVibrateTimings: true,
      },
    },
    // 3. Blok data untuk routing saat notifikasi diklik
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      route: "/home",
      email_to: String(emailData.to || userEmail || ""),
      email_from: String(emailData.from || ""),
      subject: String(emailData.subject || ""),
      notif_title: notifTitle,
      notif_body: notifBody,
      channel_id: "channel_email_umum_v4",
      sound_name: "sound_umum",
    },
    tokens: tokens,
  };

  try {
    console.log(`[FCM] Mengirim multicast notification ke ${tokens.length} device untuk ${userEmail || emailData.to}`);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Kirim ke ${emailData.to || userEmail}: Berhasil=${response.successCount}, Gagal=${response.failureCount}`);

    // Auto Cleanup Token Invalid / Unregistered jika ada failure
    if (response.failureCount > 0 && response.responses) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM Error] Token [${tokens[idx]}]:`, resp.error);
          const errorCode = resp.error ? resp.error.code : null;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (docRef && invalidTokens.length > 0) {
        console.log(`[FCM] Cleaning up ${invalidTokens.length} invalid/expired FCM token(s) for ${userEmail}...`);
        await docRef.update({
          fcm_tokens: FieldValue.arrayRemove(...invalidTokens)
        }).catch(err => {
          console.error(`[FCM] Failed to cleanup invalid FCM tokens for ${userEmail}:`, err.message);
        });
      }
    }

    return { 
      success: response.successCount > 0, 
      successCount: response.successCount, 
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('[FCM Exception] Gagal mengirim notifikasi:', error);
    throw new Error(`Failed to send push notification: ${error.message}`);
  }
}

/**
 * Sends a push notification to users who HAVE NOT DONE presence today.
 * Queries BaknusAttend API for unattended emails, then fetches FCM tokens from Firestore.
 * @param {string} title - The notification title
 * @param {string} body - The notification body message.
 * @param {string} type - 'masuk' or 'pulang'
 * @returns {Promise<object>} Result of the multicast notification attempt.
 */
async function sendAttendReminderToAll(title, body, type = 'masuk') {
  if (!initialized || !db || !messaging) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify credentials.');
  }

  const axios = require('axios');
  let targetEmails = null;

  // 1. Coba ambil daftar email user yang BELUM presensi dari BaknusAttend API
  try {
    const attendApiUrl = process.env.BAKNUSATTEND_API_URL || 'https://baknusattend.smkbn666.sch.id';
    console.log(`[firebaseService] Mengontak BaknusAttend API (${attendApiUrl}/api/presence/unattended-emails?type=${type})...`);
    
    const res = await axios.get(`${attendApiUrl}/api/presence/unattended-emails?type=${type}`, { timeout: 5000 });
    if (res.data && res.data.status === 'SUCCESS' && Array.isArray(res.data.emails)) {
      targetEmails = res.data.emails.map(e => e.toLowerCase().trim());
      console.log(`[firebaseService] Sinkronisasi BaknusAttend Berhasil: Ditemukan ${targetEmails.length} user BELUM presensi ${type}.`);
    }
  } catch (err) {
    console.warn(`[firebaseService] Gagal sinkronisasi dengan BaknusAttend API (${err.message}). Menggunakan fallback ke seluruh user.`);
  }

  try {
    let allTokens = [];

    if (targetEmails && targetEmails.length > 0) {
      // Ambil token Firestore HANYA untuk user yang BELUM presensi
      for (const email of targetEmails) {
        const doc = await db.collection('user_tokens').doc(email).get();
        if (doc.exists) {
          const userData = doc.data() || {};
          let tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
          if (tokens.length === 0 && userData.fcm_token) {
            tokens = [userData.fcm_token];
          }
          allTokens.push(...tokens);
        }
      }
    } else if (targetEmails && targetEmails.length === 0) {
      console.log(`[firebaseService] HEBAT! Seluruh user SUDAH melakukan presensi ${type} hari ini. Pengingat tidak perlu dikirim.`);
      return { success: true, reason: 'All users have already done attendance', successCount: 0 };
    } else {
      // Fallback jika API BaknusAttend tidak dapat dijangkau
      const snapshot = await db.collection('user_tokens').get();
      if (!snapshot.empty) {
        snapshot.forEach(doc => {
          const userData = doc.data() || {};
          let tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
          if (tokens.length === 0 && userData.fcm_token) {
            tokens = [userData.fcm_token];
          }
          allTokens.push(...tokens);
        });
      }
    }

    // Deduplicate and filter non-empty string tokens
    allTokens = Array.from(new Set(allTokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    if (allTokens.length === 0) {
      console.log('[firebaseService] Tidak ada token FCM valid yang perlu dikirimkan notifikasi.');
      return { success: false, reason: 'No valid FCM tokens found' };
    }

    console.log(`[firebaseService] Mengirim pengingat presensi ${type} ke ${allTokens.length} perangkat...`);

    const chunkSize = 500;
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

    console.log(`[firebaseService] Selesai mengirim pengingat presensi ${type}. Sukses: ${totalSuccess}, Gagal: ${totalFailure}`);
    return {
      success: true,
      totalTokens: allTokens.length,
      successCount: totalSuccess,
      failureCount: totalFailure
    };
  } catch (error) {
    console.error('[firebaseService] Gagal mengirim pengingat presensi:', error);
    throw new Error(`Failed to send attendance reminder: ${error.message}`);
  }
}

/**
 * Sends a push notification for BaknusChat (Japri) using Firebase Cloud Messaging (FCM).
 * @param {object} params
 * @param {string} params.recipient_email - The recipient's email address.
 * @param {string} [params.sender_name] - The sender's name.
 * @param {string} [params.sender_email] - The sender's email address.
 * @param {string} [params.sender_tag] - The sender's tag/role ('Guru', 'TU', 'Siswa').
 * @param {string} [params.message] - The message text.
 * @returns {Promise<object>} Result of the notification attempt.
 */
async function sendChatNotification({ recipient_email, sender_name, sender_email, sender_tag, message }) {
  if (!initialized || !db || !messaging) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify credentials.');
  }

  if (!recipient_email || typeof recipient_email !== 'string') {
    throw new Error('recipient_email is required');
  }

  const userEmail = recipient_email.toLowerCase().trim();
  const sName = sender_name ? sender_name.trim() : 'Teman';
  const sEmail = sender_email ? sender_email.trim() : '';
  const sTag = sender_tag ? sender_tag.trim() : '';
  const rawMessage = (message || '').trim();

  // Snippet maksimal 100 karakter
  const messageSnippet = rawMessage.length > 100 
    ? rawMessage.substring(0, 97) + '...' 
    : (rawMessage || 'Mengirim pesan baru');

  const notifTitle = sTag ? `💬 ${sName} [${sTag}]` : `💬 ${sName}`;

  console.log(`[firebaseService] Searching FCM token for chat recipient: ${userEmail}`);

  try {
    const docRef = db.collection('user_tokens').doc(userEmail);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`[firebaseService] Token tidak ditemukan untuk chat recipient: ${userEmail}`);
      return { success: false, reason: 'Token not found in Firestore for this recipient', successCount: 0 };
    }

    const userData = doc.data() || {};
    let tokens = Array.isArray(userData.fcm_tokens) ? userData.fcm_tokens : [];
    if (tokens.length === 0 && userData.fcm_token) {
      tokens = [userData.fcm_token];
    }

    // Filter token kosong & hapus duplikat
    tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    if (tokens.length === 0) {
      console.log(`[firebaseService] Tidak ada token FCM valid untuk user: ${userEmail}`);
      return { success: false, reason: 'No valid FCM tokens found for recipient', successCount: 0 };
    }

    // Buat payload multicast FCM
    const fcmMessage = {
      notification: {
        title: notifTitle,
        body: messageSnippet
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'channel_email_umum_v4',
          sound: 'sound_umum',
          priority: 'max',
          defaultSound: false,
          defaultVibrateTimings: true
        }
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        route: '/chat',
        notif_title: notifTitle,
        notif_body: messageSnippet,
        channel_id: 'channel_email_umum_v4',
        sound_name: 'sound_umum',
        sender_email: sEmail,
        sender_name: sName,
        sender_tag: sTag,
        peer_email: sEmail,
        peer_name: sName,
        peer_tag: sTag
      },
      tokens: tokens
    };

    console.log(`[firebaseService] Sending multicast FCM chat notification to ${tokens.length} device(s) for ${userEmail}`);
    const response = await messaging.sendEachForMulticast(fcmMessage);
    console.log(`[firebaseService] Chat notification sent: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // Auto Cleanup Token Invalid / Unregistered jika ada failure
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
        console.log(`[firebaseService] Cleaning up ${invalidTokens.length} invalid/expired FCM token(s) for ${userEmail}...`);
        await docRef.update({
          fcm_tokens: FieldValue.arrayRemove(...invalidTokens)
        }).catch(err => {
          console.error(`[firebaseService] Failed to cleanup invalid FCM tokens for ${userEmail}:`, err.message);
        });
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('[firebaseService] Error sending chat push notification:', error);
    throw new Error(`Failed to send chat push notification: ${error.message}`);
  }
}

module.exports = {
  sendEmailNotification,
  sendAttendReminderToAll,
  sendChatNotification
};
