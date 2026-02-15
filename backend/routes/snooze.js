const express = require('express');
const authMiddleware = require('../middleware/auth');
const SnoozedEmail = require('../models/SnoozedEmail');
const ImapService = require('../services/imapService');

const router = express.Router();

// Helper to get user's mail password
const getMailPassword = (user) => {
    return Buffer.from(user.imapPassword, 'base64').toString('utf-8');
};

// Snooze a message
router.post('/:folder/:uid', authMiddleware, async (req, res) => {
    try {
        const { folder, uid } = req.params;
        const { snoozeUntil } = req.body;

        if (!snoozeUntil) {
            return res.status(400).json({ error: 'snoozeUntil date is required' });
        }

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));

        // Ensure "Snoozed" folder exists or use Archive? Let's use "Snoozed"
        // Move message to Snoozed folder
        // Note: We need to handle folder creation if it doesn't exist, which might fail if IMAP server restricts it. 
        // Safer option: Move to "Drafts" or create a "Snoozed" folder if possible.
        // Let's assume we can move to 'Snoozed'. If it fails, maybe 'Archive'?

        // First try to move to 'Snoozed'. ImapService.moveMessage should ideally handle folder creation or we need to ensure it.
        // Let's trust moveMessage for now, but we might need to create it first.

        let newUid = null;

        try {
            newUid = await imapService.moveMessage(parseInt(uid), folder, 'Snoozed');
        } catch (e) {
            console.warn('Failed to move to Snoozed, trying Archive', e);
            // Fallback to Archive
            try {
                newUid = await imapService.moveMessage(parseInt(uid), folder, 'Archive');
            } catch (e2) {
                console.error('Failed to move to Archive too', e2);
                throw e2; // If move fails completely, we shouldn't create DB record
            }
        }

        if (!newUid) {
            throw new Error('Failed to get new UID for snoozed message');
        }

        // Save reference in DB with new UID (in Snoozed/Archive folder)
        await SnoozedEmail.create({
            userId: req.user.id,
            messageUid: newUid,
            originalFolder: folder,
            snoozeUntil: new Date(snoozeUntil),
            processed: false
        });

        res.json({ success: true, message: 'Email snoozed' });
    } catch (error) {
        console.error('Snooze error:', error);
        res.status(500).json({ error: 'Failed to snooze email' });
    }
});

module.exports = router;
