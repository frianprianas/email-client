const { getFirestore } = require('firebase-admin/firestore');
const User = require('../models/User');
const ImapService = require('./imapService');
const { sendEmailNotification } = require('./firebaseService');

/**
 * Periodically checks IMAP for unseen emails for all users who have registered an FCM token in Firestore.
 */
async function checkEmailsForAllUsers() {
  console.log('[EmailCheckWorker] Starting periodic IMAP check for unseen emails...');
  try {
    const db = getFirestore();
    
    // 1. Fetch all users from Firestore collection 'user_tokens'
    const snapshot = await db.collection('user_tokens').get();
    if (snapshot.empty) {
      console.log('[EmailCheckWorker] No active users found in Firestore user_tokens collection.');
      return;
    }

    console.log(`[EmailCheckWorker] Found ${snapshot.size} users to process.`);

    for (const doc of snapshot.docs) {
      const email = doc.id; // Document ID is the user's email
      const data = doc.data();
      const lastNotifiedUid = data.last_notified_uid || 0;

      console.log(`[EmailCheckWorker] Checking user: ${email} (lastNotifiedUid: ${lastNotifiedUid})`);

      try {
        // 2. Fetch user's IMAP credentials from PostgreSQL
        const user = await User.findOne({ where: { email } });
        if (!user) {
          console.warn(`[EmailCheckWorker] User ${email} exists in Firestore but not in PostgreSQL database. Skipping.`);
          continue;
        }

        // Decrypt password
        const password = Buffer.from(user.imapPassword, 'base64').toString('utf-8');

        // 3. Connect to IMAP and retrieve unseen messages
        const imapService = new ImapService(email, password);
        const unseenEmails = await imapService.getUnseenMessages();

        if (unseenEmails && unseenEmails.length > 0) {
          console.log(`[EmailCheckWorker] Found ${unseenEmails.length} unseen emails for ${email}.`);

          // Filter out messages that have already been notified
          const newEmails = unseenEmails.filter(msg => msg.uid > lastNotifiedUid);
          
          if (newEmails.length > 0) {
            // Sort UIDs ascending to process in order
            newEmails.sort((a, b) => a.uid - b.uid);
            let maxUid = lastNotifiedUid;

            if (lastNotifiedUid === 0) {
              // First-time initialization for this user:
              // Set the marker to the highest current UID to avoid spamming historical unreads
              maxUid = Math.max(...newEmails.map(msg => msg.uid));
              console.log(`[EmailCheckWorker] Initializing last_notified_uid for ${email} to ${maxUid} (historical unreads skipped)`);
            } else {
              // Notify user for each new unseen email
              for (const msg of newEmails) {
                try {
                  console.log(`[EmailCheckWorker] Sending notification to ${email} for email from: ${msg.from}`);
                  await sendEmailNotification(email, msg.from, msg.subject);
                  if (msg.uid > maxUid) {
                    maxUid = msg.uid;
                  }
                } catch (notiErr) {
                  console.error(`[EmailCheckWorker] Error sending notification for email UID ${msg.uid} to ${email}:`, notiErr.message);
                }
              }
            }

            // 4. Update the last_notified_uid marker in Firestore
            if (maxUid > lastNotifiedUid) {
              await db.collection('user_tokens').doc(email).update({
                last_notified_uid: maxUid
              });
              console.log(`[EmailCheckWorker] Updated last_notified_uid for ${email} in Firestore to: ${maxUid}`);
            }
          } else {
            console.log(`[EmailCheckWorker] No new emails (UID > ${lastNotifiedUid}) for ${email}.`);
          }
        } else {
          console.log(`[EmailCheckWorker] No unseen emails in INBOX for ${email}.`);
        }
      } catch (userErr) {
        console.error(`[EmailCheckWorker] Error processing email check for ${email}:`, userErr.message);
      }
    }
  } catch (error) {
    console.error('[EmailCheckWorker] Critical error in checkEmailsForAllUsers worker:', error.message);
  }
  console.log('[EmailCheckWorker] Finished periodic IMAP check.');
}

/**
 * Starts the email check background worker on a 1-minute interval.
 */
function startEmailCheckWorker() {
  // Run every 60 seconds
  setInterval(checkEmailsForAllUsers, 60000);
  console.log('[EmailCheckWorker] Email check background worker started (interval: 60s)');
}

module.exports = {
  checkEmailsForAllUsers,
  startEmailCheckWorker
};
