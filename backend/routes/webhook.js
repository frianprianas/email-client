const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebaseService');

/**
 * @route   POST /api/webhook/incoming-email (or /email-incoming)
 * @desc    Incoming email webhook to trigger FCM push notifications
 * @access  Public
 */
const handleIncomingEmail = async (req, res) => {
  const to = req.body.to || req.body.recipient || req.body.rcpt || req.body.email_to;
  const from = req.body.from || req.body.sender || req.body.email_from || 'Pengirim';
  const subject = req.body.subject || req.body.email_subject || '(Tanpa Subjek)';

  // Validate required recipient
  if (!to) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: "to" or "recipient" is required.'
    });
  }

  try {
    const result = await firebaseService.sendEmailNotification(to, from, subject);
    
    return res.status(200).json({
      success: result.success,
      message: result.success ? 'Notification sent successfully' : 'Notification skipped / not sent',
      successCount: result.successCount || 0,
      failureCount: result.failureCount || 0,
      reason: result.reason || null
    });
  } catch (error) {
    console.error('Error handling incoming email webhook:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

router.post('/incoming-email', handleIncomingEmail);
router.post('/email-incoming', handleIncomingEmail);

module.exports = router;
