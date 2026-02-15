const express = require('express');
const authMiddleware = require('../middleware/auth');
const Label = require('../models/Label');

const router = express.Router();

// Get all labels
router.get('/', authMiddleware, async (req, res) => {
    try {
        const labels = await Label.findAll({
            where: { userId: req.user.id },
            order: [['name', 'ASC']]
        });
        res.json(labels);
    } catch (error) {
        console.error('Get labels error:', error);
        res.status(500).json({ error: 'Failed to fetch labels' });
    }
});

// Create label
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, color } = req.body;
        const label = await Label.create({
            userId: req.user.id,
            name,
            color
        });
        res.status(201).json(label);
    } catch (error) {
        console.error('Create label error:', error);
        res.status(500).json({ error: 'Failed to create label' });
    }
});

// Delete label
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        await Label.destroy({
            where: { id: req.params.id, userId: req.user.id }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete label error:', error);
        res.status(500).json({ error: 'Failed to delete label' });
    }
});

module.exports = router;
