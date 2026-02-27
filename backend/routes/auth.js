const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ImapService = require('../services/imapService');
const authMiddleware = require('../middleware/auth');
const VerificationOTP = require('../models/VerificationOTP');
const fonnteService = require('../services/fonnteService');
const mailcowService = require('../services/mailcowService');
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

        // Calculate expiration based on user preference
        const durationDays = user.sessionDuration || 7;
        const expiresMs = durationDays * 24 * 60 * 60 * 1000;

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: `${durationDays}d` }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            maxAge: expiresMs,
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
                isPhoneVerified: user.isPhoneVerified,
                sessionDuration: user.sessionDuration
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
            isPhoneVerified: req.user.isPhoneVerified,
            sessionDuration: req.user.sessionDuration
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
        if (req.body.sessionDuration !== undefined) updates.sessionDuration = req.body.sessionDuration;

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
                isPhoneVerified: req.user.isPhoneVerified,
                sessionDuration: req.user.sessionDuration
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Request OTP for phone verification or password change
router.post('/request-otp', authMiddleware, async (req, res) => {
    try {
        const { phoneNumber, type = 'verification' } = req.body;
        const targetNumber = phoneNumber || req.user.phoneNumber;

        if (!targetNumber) {
            return res.status(400).json({ error: 'Nomor telepon diperlukan' });
        }

        // If password change, ensure phone is verified first
        if (type === 'password_change' && !req.user.isPhoneVerified) {
            return res.status(400).json({ error: 'Harap verifikasi nomor WhatsApp terlebih dahulu' });
        }

        // Check daily limit for password change
        if (type === 'password_change' && req.user.lastPasswordChange) {
            const lastChange = new Date(req.user.lastPasswordChange);
            const now = new Date();
            const hoursDiff = (now - lastChange) / (1000 * 60 * 60);
            if (hoursDiff < 24) {
                return res.status(400).json({ error: 'Penggantian password hanya diperbolehkan satu kali dalam 24 jam' });
            }
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save OTP
        await VerificationOTP.create({
            phoneNumber: targetNumber,
            otp,
            expiresAt
        });

        // Send via Fonnte with personalized message
        await fonnteService.sendOTP(targetNumber, otp, req.user.email, type);

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
                isPhoneVerified: req.user.isPhoneVerified,
                sessionDuration: req.user.sessionDuration
            }
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'Gagal memverifikasi OTP' });
    }
});

// Change Password
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { newPassword, confirmPassword, otp } = req.body;

        if (!newPassword || !confirmPassword || !otp) {
            return res.status(400).json({ error: 'Semua field harus diisi' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Konfirmasi password tidak cocok' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password minimal 8 karakter' });
        }

        if (!req.user.isPhoneVerified || !req.user.phoneNumber) {
            return res.status(400).json({ error: 'Harap verifikasi nomor WhatsApp terlebih dahulu' });
        }

        // Check daily limit again
        if (req.user.lastPasswordChange) {
            const lastChange = new Date(req.user.lastPasswordChange);
            const now = new Date();
            const hoursDiff = (now - lastChange) / (1000 * 60 * 60);
            if (hoursDiff < 24) {
                return res.status(400).json({ error: 'Penggantian password hanya diperbolehkan satu kali dalam 24 jam' });
            }
        }

        // Verify OTP
        const record = await VerificationOTP.findOne({
            where: {
                phoneNumber: req.user.phoneNumber,
                otp,
                expiresAt: { [Op.gt]: new Date() }
            },
            order: [['createdAt', 'DESC']]
        });

        if (!record) {
            return res.status(400).json({ error: 'OTP tidak valid atau sudah kadaluarsa' });
        }

        // 1. Change password in Mailcow
        await mailcowService.changePassword(req.user.email, newPassword);

        // 2. Update local database
        await req.user.update({
            imapPassword: Buffer.from(newPassword).toString('base64'),
            lastPasswordChange: new Date()
        });

        // 3. Delete OTP records
        await VerificationOTP.destroy({ where: { phoneNumber: req.user.phoneNumber } });

        res.json({ message: 'Password berhasil diubah' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message || 'Gagal mengubah password' });
    }
});

// Render avatar directly as image
router.get('/avatar/:email', async (req, res) => {
    try {
        const user = await User.findOne({ where: { email: req.params.email } });

        if (!user || !user.avatar) {
            // Jika avatar tidak ditemukan, tampilkan inisial email
            return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.email)}&background=random`);
        }

        // Memecah format data URI base64 (misal: "data:image/png;base64,iVBOR...")
        const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            return res.status(400).send('Format gambar tidak valid');
        }

        const imageType = matches[1]; // misal: image/png
        const imageBuffer = Buffer.from(matches[2], 'base64');

        // Set header HTTP
        res.set('Content-Type', imageType);
        res.set('Content-Length', imageBuffer.length);
        res.set('Cache-Control', 'public, max-age=86400'); // Cache di memori browser selama 1 hari

        // Kirim gambar
        res.send(imageBuffer);
    } catch (error) {
        console.error('Error rendering avatar:', error);
        res.status(500).send('Gagal menampilkan avatar');
    }
});

// Get basic profile info publicly (for other apps)
router.get('/info/:email', async (req, res) => {
    try {
        const user = await User.findOne({
            where: { email: req.params.email },
            attributes: ['email', 'displayName', 'phoneNumber', 'isPhoneVerified']
        });

        if (!user) {
            return res.status(404).json({ error: 'User tidak ditemukan' });
        }

        res.json({
            email: user.email,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            isPhoneVerified: user.isPhoneVerified,
            avatarUrl: `https://baknusmail.smkbn666.sch.id/api/auth/avatar/${user.email}`
        });
    } catch (error) {
        console.error('Error fetching public info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
