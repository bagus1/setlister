const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { Link, Song } = require('../models');
const { requireAuth } = require('../middleware/auth');

// POST /songs/:songId/links - Add a new link to a song
router.post('/:songId/links', requireAuth, [
    body('type')
        .isIn(['youtube', 'spotify', 'lyrics', 'tab', 'bass tab', 'chords', 'tutorial', 'other'])
        .withMessage('Please select a valid link type'),
    body('url')
        .isURL()
        .withMessage('Please enter a valid URL'),
    body('description')
        .optional()
        .isLength({ max: 255 })
        .withMessage('Description must be less than 255 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.array()[0].msg);
            return res.redirect(`/songs/${req.params.songId}`);
        }

        const song = await Song.findByPk(req.params.songId);
        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        const { type, url, description } = req.body;

        await Link.create({
            songId: song.id,
            type,
            url: url.trim(),
            description: description ? description.trim() : null
        });

        req.flash('success', 'Link added successfully');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Add link error:', error);
        req.flash('error', 'Error adding link');
        res.redirect(`/songs/${req.params.songId}`);
    }
});

// DELETE /songs/:songId/links/:linkId - Delete a link
router.delete('/:songId/links/:linkId', requireAuth, async (req, res) => {
    try {
        const link = await Link.findByPk(req.params.linkId);
        if (!link) {
            req.flash('error', 'Link not found');
            return res.redirect(`/songs/${req.params.songId}`);
        }

        // Verify the link belongs to the specified song
        if (link.songId != req.params.songId) {
            req.flash('error', 'Link not found');
            return res.redirect(`/songs/${req.params.songId}`);
        }

        await link.destroy();
        req.flash('success', 'Link deleted successfully');
        res.redirect(`/songs/${req.params.songId}`);
    } catch (error) {
        console.error('Delete link error:', error);
        req.flash('error', 'Error deleting link');
        res.redirect(`/songs/${req.params.songId}`);
    }
});

module.exports = router; 