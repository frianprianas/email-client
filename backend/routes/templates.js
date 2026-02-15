const express = require('express');
const authMiddleware = require('../middleware/auth');
const Template = require('../models/Template');

const router = express.Router();

// Get all templates for user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const templates = await Template.findAll({
            where: { userId: req.user.id }
        });
        res.json(templates);
    } catch (error) {
        console.error('List templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

// Create new template
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, subject, body, isHtml } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Template name is required' });
        }

        const template = await Template.create({
            userId: req.user.id,
            name,
            subject,
            body,
            isHtml: isHtml !== false
        });

        res.json(template);
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

// Delete template
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Template.destroy({
            where: { id, userId: req.user.id }
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

module.exports = router;
