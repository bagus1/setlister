const express = require('express');
const { body, validationResult } = require('express-validator');
const { Song, Artist, Vocalist, sequelize } = require('../models');
const { requireAuth } = require('./auth');
const { Op } = require('sequelize');

const router = express.Router();

// GET /songs - Show all songs
router.get('/', async (req, res) => {
    try {
        const songs = await Song.findAll({
            include: ['Artists', 'Vocalist'],
            order: [['title', 'ASC']]
        });

        const artists = await Artist.findAll({
            order: [['name', 'ASC']]
        });

        const vocalists = await Vocalist.findAll({
            order: [['name', 'ASC']]
        });

        res.render('songs/index', {
            title: 'Songs',
            songs,
            artists,
            vocalists,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Songs index error:', error);
        req.flash('error', 'Error loading songs');
        res.redirect('/');
    }
});

// GET /songs/new - Show new song form
router.get('/new', requireAuth, async (req, res) => {
    try {
        const artists = await Artist.findAll({
            order: [['name', 'ASC']]
        });

        const vocalists = await Vocalist.findAll({
            order: [['name', 'ASC']]
        });

        res.render('songs/new', {
            title: 'Add New Song',
            artists,
            vocalists
        });
    } catch (error) {
        console.error('New song form error:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/songs');
    }
});

// POST /songs - Create new song
router.post('/', requireAuth, [
    body('title').notEmpty().withMessage('Song title is required'),
    body('artistInput').optional(),
    body('vocalistInput').optional(),
    body('key').optional(),
    body('minutes').optional().isInt({ min: 0 }).withMessage('Minutes must be a positive number'),
    body('seconds').optional().isInt({ min: 0, max: 59 }).withMessage('Seconds must be between 0 and 59')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        const { title, artistInput, vocalistInput, key, minutes = 0, seconds = 0 } = req.body;

        // Check for duplicate song
        const existingSong = await Song.findOne({
            where: { title },
            include: ['Artists']
        });

        const duplicateWarning = existingSong ?
            `A song with the title "${title}" already exists${existingSong.Artists && existingSong.Artists.length > 0 ? ` by ${existingSong.Artists[0].name}` : ''}.` :
            null;

        if (!errors.isEmpty() || duplicateWarning) {
            const artists = await Artist.findAll({
                order: [['name', 'ASC']]
            });

            const vocalists = await Vocalist.findAll({
                order: [['name', 'ASC']]
            });

            return res.render('songs/new', {
                title: 'Add New Song',
                errors: errors.array(),
                duplicateWarning,
                artists,
                vocalists,
                formData: req.body
            });
        }

        // Calculate total time in seconds
        const totalTime = (parseInt(minutes) * 60) + parseInt(seconds);

        // Handle vocalist
        let vocalistId = null;
        if (vocalistInput && vocalistInput.trim()) {
            const [vocalist] = await Vocalist.findOrCreate({
                where: { name: vocalistInput.trim() },
                defaults: { name: vocalistInput.trim() }
            });
            vocalistId = vocalist.id;
        }

        // Create song
        const song = await Song.create({
            title: title.trim(),
            key: key || null,
            time: totalTime || null,
            vocalistId
        });

        // Handle artist
        if (artistInput && artistInput.trim()) {
            const [artist] = await Artist.findOrCreate({
                where: { name: artistInput.trim() },
                defaults: { name: artistInput.trim() }
            });
            await song.addArtist(artist);
        }

        req.flash('success', 'Song added successfully');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Create song error:', error);
        req.flash('error', 'Error creating song');
        res.redirect('/songs/new');
    }
});

// GET /songs/:id - Show specific song
router.get('/:id', async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Artists', 'Vocalist']
        });

        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        res.render('songs/show', {
            title: song.title,
            song,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Song show error:', error);
        req.flash('error', 'Error loading song');
        res.redirect('/songs');
    }
});

// GET /songs/:id/edit - Show edit song form
router.get('/:id/edit', requireAuth, async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Artists', 'Vocalist']
        });

        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        const artists = await Artist.findAll({
            order: [['name', 'ASC']]
        });

        const vocalists = await Vocalist.findAll({
            order: [['name', 'ASC']]
        });

        res.render('songs/edit', {
            title: `Edit ${song.title}`,
            song,
            artists,
            vocalists
        });
    } catch (error) {
        console.error('Edit song form error:', error);
        req.flash('error', 'Error loading song');
        res.redirect('/songs');
    }
});

// PUT /songs/:id - Update song
router.put('/:id', requireAuth, [
    body('title').notEmpty().withMessage('Song title is required'),
    body('artistInput').optional(),
    body('vocalistInput').optional(),
    body('key').optional(),
    body('minutes').optional().isInt({ min: 0 }).withMessage('Minutes must be a positive number'),
    body('seconds').optional().isInt({ min: 0, max: 59 }).withMessage('Seconds must be between 0 and 59')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const song = await Song.findByPk(req.params.id, {
                include: ['Artists', 'Vocalist']
            });

            const artists = await Artist.findAll({
                order: [['name', 'ASC']]
            });

            const vocalists = await Vocalist.findAll({
                order: [['name', 'ASC']]
            });

            return res.render('songs/edit', {
                title: `Edit ${song.title}`,
                song,
                artists,
                vocalists,
                errors: errors.array(),
                formData: req.body
            });
        }

        const song = await Song.findByPk(req.params.id);
        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        const { title, artistInput, vocalistInput, key, minutes = 0, seconds = 0 } = req.body;

        // Calculate total time in seconds
        const totalTime = (parseInt(minutes) * 60) + parseInt(seconds);

        // Handle vocalist
        let vocalistId = null;
        if (vocalistInput && vocalistInput.trim()) {
            const [vocalist] = await Vocalist.findOrCreate({
                where: { name: vocalistInput.trim() },
                defaults: { name: vocalistInput.trim() }
            });
            vocalistId = vocalist.id;
        }

        // Update song
        await song.update({
            title: title.trim(),
            key: key || null,
            time: totalTime || null,
            vocalistId
        });

        // Handle artist
        await song.setArtists([]); // Clear existing associations
        if (artistInput && artistInput.trim()) {
            const [artist] = await Artist.findOrCreate({
                where: { name: artistInput.trim() },
                defaults: { name: artistInput.trim() }
            });
            await song.addArtist(artist);
        }

        req.flash('success', 'Song updated successfully');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Update song error:', error);
        req.flash('error', 'Error updating song');
        res.redirect(`/songs/${req.params.id}/edit`);
    }
});

// DELETE /songs/:id - Delete song
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id);
        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        await song.destroy();
        req.flash('success', 'Song deleted successfully');
        res.redirect('/songs');
    } catch (error) {
        console.error('Delete song error:', error);
        req.flash('error', 'Error deleting song');
        res.redirect('/songs');
    }
});

// API Routes

// GET /songs/api/artists/search - Search artists for autofill
router.get('/api/artists/search', async (req, res) => {
    try {
        const { q } = req.query;
        const artists = await Artist.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${q}%`
                }
            },
            limit: 10,
            order: [['name', 'ASC']]
        });

        res.json(artists.map(artist => ({
            id: artist.id,
            name: artist.name
        })));
    } catch (error) {
        console.error('Artist search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /songs/api/vocalists/search - Search vocalists for autofill
router.get('/api/vocalists/search', async (req, res) => {
    try {
        const { q } = req.query;
        const vocalists = await Vocalist.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${q}%`
                }
            },
            limit: 10,
            order: [['name', 'ASC']]
        });

        res.json(vocalists.map(vocalist => ({
            id: vocalist.id,
            name: vocalist.name
        })));
    } catch (error) {
        console.error('Vocalist search error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /songs/api/:id - Get song details
router.get('/api/:id', async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Artists', 'Vocalist']
        });

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        res.json(song);
    } catch (error) {
        console.error('Get song error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 