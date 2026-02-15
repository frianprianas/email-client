const express = require('express');
const axios = require('axios');
const https = require('https');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const MAILCOW_API_URL = process.env.MAILCOW_API_URL || 'http://mail.example.com';
const MAILCOW_API_KEY = process.env.MAILCOW_API_KEY || '';

// Clean up URL: remove trailing slash
const baseUrl = MAILCOW_API_URL.endsWith('/') ? MAILCOW_API_URL.slice(0, -1) : MAILCOW_API_URL;

// Axios instance for Mailcow API (skip SSL verification for self-signed certs)
const mailcowClient = axios.create({
    baseURL: `${baseUrl}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MAILCOW_API_KEY,
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

// Helper: call Mailcow API
const mailcowAPI = async (method, endpoint, body = null) => {
    try {
        const response = await mailcowClient({
            method: method.toLowerCase(),
            url: endpoint,
            data: body,
        });
        return { status: response.status, data: response.data };
    } catch (error) {
        if (error.response) {
            return { status: error.response.status, data: error.response.data };
        }
        throw error;
    }
};

// Mailcow returns {} when no data, convert to array
const toArray = (data) => Array.isArray(data) ? data : [];

// GET /api/alias - Get current user's aliases
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userEmail = req.user.email;

        // Get all aliases from Mailcow
        const result = await mailcowAPI('GET', '/get/alias/all');

        if (result.status !== 200) {
            return res.status(500).json({ error: 'Failed to fetch aliases from Mailcow' });
        }

        // Filter aliases that belong to this user (goto matches user email)
        const userAliases = toArray(result.data).filter(alias => {
            const gotos = alias.goto ? alias.goto.split(',').map(g => g.trim()) : [];
            return gotos.includes(userEmail);
        }).map(alias => ({
            id: alias.id,
            address: alias.address,
            goto: alias.goto,
            active: alias.active === 1,
            created: alias.created,
            modified: alias.modified,
        }));

        res.json({ aliases: userAliases });
    } catch (error) {
        console.error('Get aliases error:', error);
        res.status(500).json({ error: 'Failed to fetch aliases' });
    }
});

// POST /api/alias - Add alias for current user (max 1)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { alias } = req.body;

        if (!alias || !alias.trim()) {
            return res.status(400).json({ error: 'Alias address is required' });
        }

        // Extract domain from user email
        const domain = userEmail.split('@')[1];
        const aliasAddress = alias.includes('@') ? alias : `${alias}@${domain}`;

        // Validate alias is on the same domain
        if (!aliasAddress.endsWith(`@${domain}`)) {
            return res.status(400).json({ error: `Alias must be on @${domain}` });
        }

        // Validate alias is not the same as user email
        if (aliasAddress.toLowerCase() === userEmail.toLowerCase()) {
            return res.status(400).json({ error: 'Alias cannot be the same as your email' });
        }

        // Check existing aliases for this user (limit to 1)
        const existing = await mailcowAPI('GET', '/get/alias/all');
        if (existing.status === 200) {
            const userAliases = toArray(existing.data).filter(a => {
                const gotos = a.goto ? a.goto.split(',').map(g => g.trim()) : [];
                return gotos.includes(userEmail);
            });

            if (userAliases.length >= 1) {
                return res.status(400).json({ error: 'You can only have 1 alias. Please delete the existing alias first.' });
            }
        }

        // Create alias in Mailcow
        const result = await mailcowAPI('POST', '/add/alias', {
            address: aliasAddress,
            goto: userEmail,
            active: '1',
        });

        if (result.status !== 200 || (Array.isArray(result.data) && result.data[0]?.type === 'danger')) {
            const errorMsg = Array.isArray(result.data) ? result.data[0]?.msg : 'Failed to create alias';
            return res.status(400).json({ error: errorMsg || 'Failed to create alias in Mailcow' });
        }

        res.json({ message: 'Alias created successfully', alias: aliasAddress });
    } catch (error) {
        console.error('Create alias error:', error);
        res.status(500).json({ error: 'Failed to create alias' });
    }
});

// DELETE /api/alias/:id - Delete user's alias
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const aliasId = req.params.id;

        // Verify the alias belongs to this user
        const existing = await mailcowAPI('GET', '/get/alias/all');
        if (existing.status === 200) {
            const alias = toArray(existing.data).find(a => String(a.id) === String(aliasId));
            if (!alias) {
                return res.status(404).json({ error: 'Alias not found' });
            }

            const gotos = alias.goto ? alias.goto.split(',').map(g => g.trim()) : [];
            if (!gotos.includes(userEmail)) {
                return res.status(403).json({ error: 'You can only delete your own aliases' });
            }
        }

        // Delete alias in Mailcow
        const result = await mailcowAPI('POST', '/delete/alias', {
            items: [aliasId],
        });

        if (result.status !== 200 || (Array.isArray(result.data) && result.data[0]?.type === 'danger')) {
            const errorMsg = Array.isArray(result.data) ? result.data[0]?.msg : 'Failed to delete alias';
            return res.status(400).json({ error: errorMsg || 'Failed to delete alias' });
        }

        res.json({ message: 'Alias deleted successfully' });
    } catch (error) {
        console.error('Delete alias error:', error);
        res.status(500).json({ error: 'Failed to delete alias' });
    }
});

module.exports = router;
