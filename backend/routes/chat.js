const express = require('express');
const router = express.Router();
const { sendChatNotification } = require('../services/firebaseService');

/**
 * @api {post} /api/chat/notify Kirim Notifikasi Push Chat (Japri)
 * @apiDescription Mengirimkan Push Notification Firebase FCM ke perangkat penerima saat mendapat chat baru.
 * 
 * Body JSON:
 * - recipient_email (string, wajib)
 * - sender_name (string)
 * - sender_email (string)
 * - sender_tag (string, contoh: 'Guru', 'TU', 'Siswa')
 * - message / text (string, isi pesan)
 */
router.post('/notify', async (req, res) => {
  try {
    const {
      recipient_email,
      sender_name,
      sender_email,
      sender_tag,
      message,
      text
    } = req.body;

    if (!recipient_email || typeof recipient_email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'recipient_email is required and must be a string'
      });
    }

    const messageContent = message || text || '';

    const result = await sendChatNotification({
      recipient_email,
      sender_name,
      sender_email,
      sender_tag,
      message: messageContent
    });

    return res.json({
      success: result.success,
      successCount: result.successCount || 0,
      failureCount: result.failureCount || 0,
      reason: result.reason || null
    });
  } catch (error) {
    console.error('[routes/chat] Error in /notify endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;
