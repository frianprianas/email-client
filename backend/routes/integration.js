const express = require('express');
const User = require('../models/User');
const aiService = require('../services/aiService');

const router = express.Router();

// Middleware to validate API Key for 3rd Party System Integrations
const integrationApiKeyMiddleware = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key || req.body.api_key;
    const expectedKeys = [
        process.env.INTERNAL_SYSTEM_TOKEN || 'BAKNUS_SECRET_INTERNAL_KEY_999',
        process.env.DASHBOARD_API_KEY || 'baknus_secret_dashboard_key_2026',
        'RAHASIA_BAKNUSMAIL'
    ];

    if (!apiKey || !expectedKeys.includes(apiKey)) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Valid X-API-Key or api_key parameter required for 3rd party integration.'
        });
    }
    next();
};

const handleProfileUpdate = async (req, res) => {
    try {
        const {
            email,
            displayName,
            avatar,
            signature,
            theme,
            validateAvatarWithAI = true,
            aiMode = 'online'
        } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter is required.'
            });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: `User with email ${email} not found in BaknusMail.`
            });
        }

        let aiVerificationResult = null;

        // Run BaknusAI Validation if avatar is provided & validateAvatarWithAI is enabled
        if (avatar && validateAvatarWithAI) {
            try {
                if (aiMode === 'online') {
                    // Batasan harian BaknusAI Online: maksimal 5 kali per hari per user
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                    if (user.lastOnlineAiValidationDate === todayStr && user.onlineAiValidationsToday >= 5) {
                        return res.status(429).json({
                            success: false,
                            error: 'Batas harian BaknusAI Online tercapai. Pengguna hanya dapat memverifikasi foto maksimal 5 kali dalam sehari.',
                            daily_limit: 5,
                            used_today: user.onlineAiValidationsToday
                        });
                    }

                    console.log(`[integration] Memproses validasi foto BaknusAI (online) untuk email ${email}...`);
                    aiVerificationResult = await aiService.validatePhotoOnline(avatar);

                    // Update daily counter
                    const newCount = (user.lastOnlineAiValidationDate === todayStr) ? (user.onlineAiValidationsToday + 1) : 1;
                    await user.update({
                        onlineAiValidationsToday: newCount,
                        lastOnlineAiValidationDate: todayStr
                    });
                } else {
                    console.log(`[integration] Memproses validasi foto BaknusAI (local) untuk email ${email}...`);
                    aiVerificationResult = await aiService.submitValidation(avatar, user.id);
                }

                // Check if BaknusAI rejected the photo
                if (aiVerificationResult) {
                    const isValid = aiVerificationResult.isValid !== false && aiVerificationResult.success !== false;
                    if (!isValid || (aiVerificationResult.status && aiVerificationResult.status.toLowerCase() === 'rejected')) {
                        return res.status(400).json({
                            success: false,
                            error: 'Foto profil ditolak oleh BaknusAI.',
                            ai_verification: aiVerificationResult
                        });
                    }
                }
            } catch (aiErr) {
                console.error('[integration] Error saat validasi BaknusAI:', aiErr.message);
                return res.status(422).json({
                    success: false,
                    error: `Gagal memproses verifikasi BaknusAI: ${aiErr.message}`,
                    ai_verification: aiErr.response?.data || null
                });
            }
        }

        // Apply Updates
        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (avatar !== undefined) updates.avatar = avatar;
        if (signature !== undefined) updates.signature = signature;
        if (theme !== undefined) updates.theme = theme;

        await user.update(updates);

        res.json({
            success: true,
            message: 'Profil pengguna berhasil diperbarui melalui integrasi pihak ke-3 dengan verifikasi BaknusAI.',
            ai_verification: aiVerificationResult,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatar: user.avatar,
                theme: user.theme,
                signature: user.signature,
                phoneNumber: user.phoneNumber,
                isPhoneVerified: user.isPhoneVerified
            }
        });
    } catch (error) {
        console.error('[integration] Profile update error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal Server Error during 3rd party profile update.'
        });
    }
};

/**
 * @api {post} /api/integration/user-profile Update User Profile via 3rd Party with BaknusAI Verification
 */
router.post('/user-profile', integrationApiKeyMiddleware, handleProfileUpdate);

/**
 * @api {put} /api/integration/user-profile Update User Profile via 3rd Party with BaknusAI Verification
 */
router.put('/user-profile', integrationApiKeyMiddleware, handleProfileUpdate);

module.exports = router;
