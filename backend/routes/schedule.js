const express = require('express');
const authMiddleware = require('../middleware/auth');
const ScheduledEmail = require('../models/ScheduledEmail');
const SmtpService = require('../services/smtpService');
const ImapService = require('../services/imapService');

const router = express.Router();

// Helper to check if date is valid
const isValidDate = (d) => {
    return d instanceof Date && !isNaN(d);
};

// Schedule an email
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { to, cc, bcc, subject, html, text, attachments, inReplyTo, references, scheduledTime } = req.body;

        if (!scheduledTime) {
            return res.status(400).json({ error: 'scheduledTime is required' });
        }

        const scheduleDate = new Date(scheduledTime);
        if (!isValidDate(scheduleDate)) {
            return res.status(400).json({ error: 'Invalid scheduledTime' });
        }

        if (scheduleDate <= new Date()) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }

        const scheduledEmail = await ScheduledEmail.create({
            userId: req.user.id,
            to,
            cc,
            bcc,
            subject,
            html,
            text,
            attachments, // Make sure Frontend sends attachments in a compatible format (base64)
            inReplyTo,
            references,
            scheduledTime: scheduleDate,
            status: 'pending'
        });

        res.json({ success: true, message: 'Email scheduled', id: scheduledEmail.id });
    } catch (error) {
        console.error('Schedule email error:', error);
        res.status(500).json({ error: 'Failed to schedule email' });
    }
});

// List scheduled emails
router.get('/', authMiddleware, async (req, res) => {
    try {
        const scheduled = await ScheduledEmail.findAll({
            where: {
                userId: req.user.id,
                status: 'pending'
            },
            order: [['scheduledTime', 'ASC']]
        });
        res.json(scheduled);
    } catch (error) {
        console.error('List scheduled emails error:', error);
        res.status(500).json({ error: 'Failed to list scheduled emails' });
    }
});

// Cancel scheduled email
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await ScheduledEmail.destroy({
            where: {
                id,
                userId: req.user.id,
                status: 'pending'
            }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Scheduled email not found or already sent' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel scheduled email error:', error);
        res.status(500).json({ error: 'Failed to cancel scheduled email' });
    }
});

module.exports = router;
