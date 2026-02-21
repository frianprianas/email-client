const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ImapService = require('../services/imapService');
const authMiddleware = require('../middleware/auth');
const VerificationOTP = require('../models/VerificationOTP');
const fonnteService = require('../services/fonnteService');
const { Op } = require('sequelize');

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
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
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
                signature: user.signature,
                phoneNumber: user.phoneNumber,
                isPhoneVerified: user.isPhoneVerified
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
            signature: req.user.signature,
            phoneNumber: req.user.phoneNumber,
            isPhoneVerified: req.user.isPhoneVerified
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
                signature: req.user.signature,
                phoneNumber: req.user.phoneNumber,
                isPhoneVerified: req.user.isPhoneVerified
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Request OTP for phone verification
router.post('/request-otp', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Nomor telepon diperlukan' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save OTP
        await VerificationOTP.create({
            phoneNumber,
            otp,
            expiresAt
        });

        // Send via Fonnte
        await fonnteService.sendOTP(phoneNumber, otp);

        res.json({ message: 'OTP telah dikirim ke WhatsApp Anda' });
    } catch (error) {
        console.error('Request OTP error:', error);
        res.status(500).json({ error: error.message || 'Gagal mengirim OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) {
            return res.status(400).json({ error: 'Nomor telepon dan OTP diperlukan' });
        }

        const record = await VerificationOTP.findOne({
            where: {
                phoneNumber,
                otp,
                expiresAt: { [Op.gt]: new Date() }
            },
            order: [['createdAt', 'DESC']]
        });

        if (!record) {
            return res.status(400).json({ error: 'OTP tidak valid atau sudah kadaluarsa' });
        }

        // Update user
        await req.user.update({
            phoneNumber,
            isPhoneVerified: true
        });

        // Delete OTP records for this number
        await VerificationOTP.destroy({ where: { phoneNumber } });

        res.json({
            message: 'Nomor telepon berhasil diverifikasi',
            user: {
                id: req.user.id,
                email: req.user.email,
                displayName: req.user.displayName,
                avatar: req.user.avatar,
                theme: req.user.theme,
                signature: req.user.signature,
                phoneNumber: req.user.phoneNumber,
                isPhoneVerified: req.user.isPhoneVerified
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Gagal memverifikasi OTP' });
    }
});

module.exports = router;
