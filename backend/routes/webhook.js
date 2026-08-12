const express = require('express');
const router = express.Router();
const firebaseService = require('../services/firebaseService');

/**
 * @route   POST /api/webhook/incoming-email
 * @desc    Incoming email webhook to trigger FCM push notifications
 * @access  Public
 */
router.post('/incoming-email', async (req, res) => {
  const { to, from, subject } = req.body;

  // Validate incoming request fields
  if (!to || !from || !subject) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: to, from, and subject are required.'
    });
  }

  try {
    const result = await firebaseService.sendEmailNotification(to, from, subject);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Notification sent successfully',
        messageId: result.messageId
      });
    } else {
      return res.status(200).json({
        success: false,
        message: 'Notification not sent',
        reason: result.reason
      });
    }
  } catch (error) {
    console.error('Error handling incoming email webhook:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
