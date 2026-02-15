const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ImapService = require('../services/imapService');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Login - authenticate with Mailcow credentials
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Verify credentials against Mailcow IMAP
        const imapService = new ImapService(email, password);
        try {
            await imapService.connect();
            await imapService.disconnect();
        } catch (imapError) {
            console.error('IMAP authentication failed:', imapError.message);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Find or create user in local database
        let user = await User.findOne({ where: { email } });

        if (!user) {
            user = await User.create({
                email,
                displayName: email.split('@')[0],
                imapPassword: Buffer.from(password).toString('base64') // Simple encoding, use proper encryption in production
            });
        } else {
            // Update password in case it changed
            await user.update({
                imapPassword: Buffer.from(password).toString('base64'),
                lastLogin: new Date()
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            sameSite: 'lax'
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatar: user.avatar,
                theme: user.theme,
                signature: user.signature
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            displayName: req.user.displayName,
            avatar: req.user.avatar,
            theme: req.user.theme,
            signature: req.user.signature
        }
    });
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { displayName, avatar, signature, theme } = req.body;
        const updates = {};

        if (displayName !== undefined) updates.displayName = displayName;
        if (avatar !== undefined) updates.avatar = avatar;
        if (signature !== undefined) updates.signature = signature;
        if (theme !== undefined) updates.theme = theme;

        await req.user.update(updates);

        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                displayName: req.user.displayName,
                avatar: req.user.avatar,
                theme: req.user.theme,
                signature: req.user.signature
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;
