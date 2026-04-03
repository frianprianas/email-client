const express = require('express');
const User = require('../models/User');

const router = express.Router();

/**
 * @api {get} /api/public/avatar/:email Get User Avatar Image
 * @apiDescription Returns the user's avatar image directly. Redirects to UI-Avatars if not found.
 */
router.get('/avatar/:email', async (req, res) => {
    try {
        const user = await User.findOne({ 
            where: { email: req.params.email },
            attributes: ['avatar']
        });

        if (!user || !user.avatar) {
            // If avatar not found, redirect to initial-based avatar
            return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.email)}&background=random&size=256`);
        }

        // Handle base64 data URI format
        const matches = user.avatar.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            // Fallback if it's not a data URI (maybe a URL?)
            if (user.avatar.startsWith('http')) {
                return res.redirect(user.avatar);
            }
            return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.params.email)}&background=random&size=256`);
        }

        const imageType = matches[1]; 
        const imageBuffer = Buffer.from(matches[2], 'base64');

        // Set HTTP headers for image rendering and caching
        res.set('Content-Type', imageType);
        res.set('Content-Length', imageBuffer.length);
        res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        res.set('Access-Control-Allow-Origin', '*'); // Ensure other apps can fetch it

        res.send(imageBuffer);
    } catch (error) {
        console.error('Error rendering public avatar:', error);
        res.status(500).send('Error loading avatar');
    }
});

/**
 * @api {get} /api/public/info/:email Get Basic User Info
 * @apiDescription Get public profile information including name, phone, and avatar URL.
 */
router.get('/info/:email', async (req, res) => {
    try {
        const user = await User.findOne({
            where: { email: req.params.email },
            attributes: ['email', 'displayName', 'phoneNumber', 'isPhoneVerified']
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        res.json({
            email: user.email,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            isPhoneVerified: user.isPhoneVerified,
            avatarUrl: `${baseUrl}/api/public/avatar/${user.email}`
        });
    } catch (error) {
        console.error('Error fetching public info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
