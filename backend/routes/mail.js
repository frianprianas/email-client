const express = require('express');
const authMiddleware = require('../middleware/auth');
const ImapService = require('../services/imapService');
const SmtpService = require('../services/smtpService');

const router = express.Router();

// Helper to get user's mail password
const getMailPassword = (user) => {
    return Buffer.from(user.imapPassword, 'base64').toString('utf-8');
};

// List messages in a folder
router.get('/messages/:folder', authMiddleware, async (req, res) => {
    try {
        const folder = req.params.folder || 'INBOX';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const result = await imapService.getMessages(folder, page, limit);

        res.json(result);
    } catch (error) {
        console.error('List messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// List messages default (INBOX)
router.get('/messages', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const result = await imapService.getMessages('INBOX', page, limit);

        res.json(result);
    } catch (error) {
        console.error('List messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get single message
router.get('/message/:folder/:uid', authMiddleware, async (req, res) => {
    try {
        const { folder, uid } = req.params;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const message = await imapService.getMessage(folder, parseInt(uid));

        res.json(message);
    } catch (error) {
        console.error('Get message error:', error);
        res.status(500).json({ error: 'Failed to fetch message' });
    }
});

// Search messages
router.get('/search/:folder', authMiddleware, async (req, res) => {
    try {
        const folder = req.params.folder || 'INBOX';
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const result = await imapService.searchMessages(folder, query);

        res.json(result);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search messages' });
    }
});

// Search messages default (INBOX)
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const query = req.query.q;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const result = await imapService.searchMessages('INBOX', query);

        res.json(result);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search messages' });
    }
});

// Send email
router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { to, cc, bcc, subject, text, html, attachments, inReplyTo, references } = req.body;

        if (!to || to.length === 0) {
            return res.status(400).json({ error: 'At least one recipient is required' });
        }

        const password = getMailPassword(req.user);
        const smtpService = new SmtpService(req.user.email, password);
        const info = await smtpService.sendMail({
            to, cc, bcc, subject, text, html, attachments, inReplyTo, references
        });

        // Build raw message and save to Sent folder via IMAP
        try {
            const nodemailer = require('nodemailer');
            const mailComposer = new (require('nodemailer/lib/mail-composer'))({
                from: req.user.email,
                to: Array.isArray(to) ? to.join(', ') : to,
                cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
                bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
                subject,
                text,
                html,
                inReplyTo,
                references,
                attachments: attachments ? attachments.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    encoding: 'base64',
                    contentType: att.contentType
                })) : undefined,
            });

            const rawMessage = await mailComposer.compile().build();
            const imapService = new ImapService(req.user.email, password);
            await imapService.appendToSent(rawMessage);
        } catch (appendError) {
            console.error('Failed to save to Sent folder:', appendError.message);
            // Don't fail the request - email was already sent successfully
        }

        // AUTO-SAVE RECIPIENTS TO CONTACTS
        try {
            const Contact = require('../models/Contact');
            const recipients = new Set();

            const addRecipients = (list) => {
                if (!list) return;
                if (Array.isArray(list)) {
                    list.forEach(email => recipients.add(email));
                } else {
                    recipients.add(list);
                }
            };

            addRecipients(to);
            addRecipients(cc);
            addRecipients(bcc);

            // Process each unique recipient
            for (const recipientStr of recipients) {
                // Extract clean email if in format "Name <email>"
                const emailMatch = recipientStr.match(/<([^>]+)>/);
                const email = emailMatch ? emailMatch[1].trim() : recipientStr.trim();

                if (!email) continue;

                // Check if contact exists
                const existing = await Contact.findOne({
                    where: { userId: req.user.id, email }
                });

                if (!existing) {
                    // Create new contact
                    // If recipientStr has a name component (Name <email>), use that as name
                    // Otherwise derive from email
                    let name = '';
                    if (emailMatch) {
                        name = recipientStr.split('<')[0].trim().replace(/^['"]|['"]$/g, '');
                    }

                    if (!name) {
                        const namePart = email.split('@')[0];
                        name = namePart
                            .split(/[._-]/)
                            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(' ');
                    }

                    await Contact.create({
                        userId: req.user.id,
                        email,
                        name,
                        isFavorite: false
                    });
                }
            }
        } catch (contactError) {
            console.error('Failed to auto-save contacts:', contactError);
            // Don't fail request
        }

        res.json({ message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Save draft
router.post('/draft', authMiddleware, async (req, res) => {
    try {
        const { to, cc, bcc, subject, text, html, attachments, draftUid, inReplyTo, references } = req.body;

        const password = getMailPassword(req.user);

        // Build raw message
        const mailComposer = new (require('nodemailer/lib/mail-composer'))({
            from: req.user.email,
            to: to && to.length ? (Array.isArray(to) ? to.join(', ') : to) : undefined,
            cc: cc && cc.length ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
            bcc: bcc && bcc.length ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
            subject: subject || '',
            text: text || '',
            html: html || '',
            inReplyTo: inReplyTo || undefined,
            references: references || undefined,
            attachments: attachments ? attachments.map(att => ({
                filename: att.filename,
                content: att.content,
                encoding: 'base64',
                contentType: att.contentType
            })) : undefined,
        });

        const rawMessage = await mailComposer.compile().build();
        const imapService = new ImapService(req.user.email, password);

        // Delete old draft if updating
        if (draftUid) {
            try {
                await imapService.deleteDraft(parseInt(draftUid));
            } catch (e) {
                console.error('Failed to delete old draft:', e.message);
            }
            // Need a new connection after deleteDraft disconnected
            const imapService2 = new ImapService(req.user.email, password);
            await imapService2.saveDraft(rawMessage);
        } else {
            await imapService.saveDraft(rawMessage);
        }

        res.json({ message: 'Draft saved successfully' });
    } catch (error) {
        console.error('Save draft error:', error);
        res.status(500).json({ error: 'Failed to save draft' });
    }
});

// Send draft (send + delete from drafts)
router.post('/draft/send', authMiddleware, async (req, res) => {
    try {
        const { to, cc, bcc, subject, text, html, attachments, inReplyTo, references, draftUid } = req.body;

        if (!to || to.length === 0) {
            return res.status(400).json({ error: 'At least one recipient is required' });
        }

        const password = getMailPassword(req.user);
        const smtpService = new SmtpService(req.user.email, password);
        const info = await smtpService.sendMail({
            to, cc, bcc, subject, text, html, attachments, inReplyTo, references
        });

        // Save to Sent folder
        try {
            const mailComposer = new (require('nodemailer/lib/mail-composer'))({
                from: req.user.email,
                to: Array.isArray(to) ? to.join(', ') : to,
                cc: cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
                bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
                subject,
                text,
                html,
                inReplyTo,
                references,
                attachments: attachments ? attachments.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    encoding: 'base64',
                    contentType: att.contentType
                })) : undefined,
            });

            const rawMessage = await mailComposer.compile().build();
            const imapService = new ImapService(req.user.email, password);
            await imapService.appendToSent(rawMessage);
        } catch (appendError) {
            console.error('Failed to save to Sent folder:', appendError.message);
        }

        // Delete draft from Drafts folder
        if (draftUid) {
            try {
                const imapService = new ImapService(req.user.email, password);
                await imapService.deleteDraft(parseInt(draftUid));
            } catch (e) {
                console.error('Failed to delete draft after send:', e.message);
            }
        }

        res.json({ message: 'Draft sent successfully', messageId: info.messageId });
    } catch (error) {
        console.error('Send draft error:', error);
        res.status(500).json({ error: 'Failed to send draft' });
    }
});

// Toggle read/unread
router.put('/message/:folder/:uid/read', authMiddleware, async (req, res) => {
    try {
        const { folder, uid } = req.params;
        const { read } = req.body;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        await imapService.toggleFlag(folder, parseInt(uid), '\\Seen', read);

        res.json({ success: true });
    } catch (error) {
        console.error('Toggle read error:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

// Toggle star/flagged
router.put('/message/:folder/:uid/star', authMiddleware, async (req, res) => {
    try {
        const { folder, uid } = req.params;
        const { starred } = req.body;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        await imapService.toggleFlag(folder, parseInt(uid), '\\Flagged', starred);

        res.json({ success: true });
    } catch (error) {
        console.error('Toggle star error:', error);
        res.status(500).json({ error: 'Failed to update message' });
    }
});

// Move message
router.put('/message/:uid/move', authMiddleware, async (req, res) => {
    try {
        const { uid } = req.params;
        const { from, to } = req.body;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        await imapService.moveMessage(parseInt(uid), from, to);

        res.json({ success: true });
    } catch (error) {
        console.error('Move message error:', error);
        res.status(500).json({ error: 'Failed to move message' });
    }
});

// Delete message
router.delete('/message/:folder/:uid', authMiddleware, async (req, res) => {
    try {
        const { folder, uid } = req.params;

        const imapService = new ImapService(req.user.email, getMailPassword(req.user));

        if (folder === 'Trash') {
            // Permanently delete from trash
            await imapService.deleteMessage(folder, parseInt(uid));
        } else {
            // Move to trash
            await imapService.moveMessage(parseInt(uid), folder, 'Trash');
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// List mailbox folders
router.get('/folders', authMiddleware, async (req, res) => {
    try {
        const imapService = new ImapService(req.user.email, getMailPassword(req.user));
        const mailboxes = await imapService.listMailboxes();

        res.json(mailboxes);
    } catch (error) {
        console.error('List folders error:', error);
        res.status(500).json({ error: 'Failed to list folders' });
    }
});

module.exports = router;
