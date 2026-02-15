const express = require('express');
const authMiddleware = require('../middleware/auth');
const Contact = require('../models/Contact');

const router = express.Router();

// Get all contacts
router.get('/', authMiddleware, async (req, res) => {
    try {
        const contacts = await Contact.findAll({
            where: { userId: req.user.id },
            order: [['name', 'ASC']]
        });
        res.json(contacts);
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
