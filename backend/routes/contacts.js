const express = require('express');
const authMiddleware = require('../middleware/auth');
const Contact = require('../models/Contact');
const mailcowService = require('../services/mailcowService');

const router = express.Router();

// Get all contacts (merges personal contacts with Mailcow internal contacts & TAGs)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const localContacts = await Contact.findAll({
            where: { userId: req.user.id },
            order: [['name', 'ASC']]
        });

        let internalContacts = [];
        let groupContacts = [];
        try {
            const data = await mailcowService.getInternalContactsWithTags();
            internalContacts = data.contacts || [];
            groupContacts = data.groups || [];
        } catch (err) {
            console.warn('Mailcow contact fetch warning:', err.message);
        }

        const seenEmails = new Set();
        const results = [];

        // 1. Group suggestions first (e.g. [Grup] Semua Guru, Semua Siswa, dll)
        groupContacts.forEach(g => results.push(g));

        // 2. Internal Mailcow contacts (with TAGs)
        internalContacts.forEach(c => {
            seenEmails.add(c.email.toLowerCase());
            results.push(c);
        });

        // 3. User's personal contacts
        localContacts.forEach(c => {
            if (!seenEmails.has(c.email.toLowerCase())) {
                seenEmails.add(c.email.toLowerCase());
                results.push({
                    id: c.id,
                    name: c.name,
                    email: c.email,
                    avatar: c.avatar,
                    tags: [],
                    isInternal: false
                });
            }
        });

        res.json(results);
    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Create contact
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, email, avatar } = req.body;
        const contact = await Contact.create({
            userId: req.user.id,
            name,
            email,
            avatar
        });
        res.status(201).json(contact);
    } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
    }
});

// Delete contact
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await Contact.destroy({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

module.exports = router;
