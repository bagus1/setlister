const express = require('express');
const { body, validationResult } = require('express-validator');
const { Song, Artist, Vocalist } = require('../models');
const { requireAuth } = require('./auth');

const router = express.Router();

// GET /songs - List all songs
router.get('/', async (req, res) => {
    try {
        const songs = await Song.findAll({
            include: ['Vocalist', 'Artists'],
            order: [['title', 'ASC']]
        });

        res.render('songs/index', {
            title: 'Songs',
            songs,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Songs index error:', error);
        req.flash('error', 'An error occurred loading songs');
        res.redirect('/');
    }
});

// GET /songs/new - Show create song form (requires auth)
router.get('/new', requireAuth, async (req, res) => {
    try {
        const artists = await Artist.findAll({ order: [['name', 'ASC']] });
        const vocalists = await Vocalist.findAll({ order: [['name', 'ASC']] });

        res.render('songs/new', {
            title: 'Add Song',
            artists,
            vocalists
        });
    } catch (error) {
        console.error('New song error:', error);
        req.flash('error', 'An error occurred loading the form');
        res.redirect('/songs');
    }
});

// POST /songs - Create a new song (requires auth)
router.post('/', requireAuth, [
    body('title').trim().isLength({ min: 1 }).withMessage('Song title is required'),
    body('key').optional().isIn([
        'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
        'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
    ]).withMessage('Invalid key'),
    body('time').optional().isInt({ min: 0 }).withMessage('Time must be a positive number'),
    body('artist').trim().isLength({ min: 1 }).withMessage('Artist is required'),
    body('vocalist').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const artists = await Artist.findAll({ order: [['name', 'ASC']] });
            const vocalists = await Vocalist.findAll({ order: [['name', 'ASC']] });

            return res.render('songs/new', {
                title: 'Add Song',
                errors: errors.array(),
                artists,
                vocalists,
                formData: req.body
            });
        }

        const { title, key, time, artist: artistName, vocalist: vocalistName } = req.body;

        // Check if song already exists with same title and artist
        let artist = await Artist.findOne({ where: { name: artistName } });
        if (!artist) {
            artist = await Artist.create({ name: artistName });
        }

        // Handle vocalist
        let vocalist = null;
        if (vocalistName) {
            vocalist = await Vocalist.findOne({ where: { name: vocalistName } });
            if (!vocalist) {
                vocalist = await Vocalist.create({ name: vocalistName });
            }
        }

        // Check if song already exists
        const existingSong = await Song.findOne({
            where: { title },
            include: [{
                model: Artist,
                where: { id: artist.id }
            }]
        });

        if (existingSong) {
            const artists = await Artist.findAll({ order: [['name', 'ASC']] });
            const vocalists = await Vocalist.findAll({ order: [['name', 'ASC']] });

            return res.render('songs/new', {
                title: 'Add Song',
                errors: [{ msg: 'A song with this title and artist already exists. Would you like to edit it?' }],
                artists,
                vocalists,
                formData: req.body,
                existingSong
            });
        }

        // Create song
        const song = await Song.create({
            title,
            key: key || null,
            time: time ? parseInt(time) : null,
            vocalistId: vocalist ? vocalist.id : null
        });

        // Associate with artist
        await song.addArtist(artist);

        req.flash('success', 'Song created successfully!');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Create song error:', error);
        req.flash('error', 'An error occurred creating the song');
        res.redirect('/songs/new');
    }
});

// GET /songs/:id - Show song details
router.get('/:id', async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Vocalist', 'Artists']
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
        console.error('Show song error:', error);
        req.flash('error', 'An error occurred loading the song');
        res.redirect('/songs');
    }
});

// GET /songs/:id/edit - Show edit song form (requires auth)
router.get('/:id/edit', requireAuth, async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Vocalist', 'Artists']
        });

        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        const artists = await Artist.findAll({ order: [['name', 'ASC']] });
        const vocalists = await Vocalist.findAll({ order: [['name', 'ASC']] });

        res.render('songs/edit', {
            title: `Edit ${song.title}`,
            song,
            artists,
            vocalists
        });
    } catch (error) {
        console.error('Edit song error:', error);
        req.flash('error', 'An error occurred loading the edit form');
        res.redirect('/songs');
    }
});

// PUT /songs/:id - Update song (requires auth)
router.put('/:id', requireAuth, [
    body('title').trim().isLength({ min: 1 }).withMessage('Song title is required'),
    body('key').optional().isIn([
        'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
        'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
    ]).withMessage('Invalid key'),
    body('time').optional().isInt({ min: 0 }).withMessage('Time must be a positive number'),
    body('artist').trim().isLength({ min: 1 }).withMessage('Artist is required'),
    body('vocalist').optional().trim()
], async (req, res) => {
    try {
        const song = await Song.findByPk(req.params.id, {
            include: ['Artists']
        });

        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const artists = await Artist.findAll({ order: [['name', 'ASC']] });
            const vocalists = await Vocalist.findAll({ order: [['name', 'ASC']] });

            return res.render('songs/edit', {
                title: `Edit ${song.title}`,
                song,
                errors: errors.array(),
                artists,
                vocalists,
                formData: req.body
            });
        }

        const { title, key, time, artist: artistName, vocalist: vocalistName } = req.body;

        // Handle artist
        let artist = await Artist.findOne({ where: { name: artistName } });
        if (!artist) {
            artist = await Artist.create({ name: artistName });
        }

        // Handle vocalist
        let vocalist = null;
        if (vocalistName) {
            vocalist = await Vocalist.findOne({ where: { name: vocalistName } });
            if (!vocalist) {
                vocalist = await Vocalist.create({ name: vocalistName });
            }
        }

        // Update song
        await song.update({
            title,
            key: key || null,
            time: time ? parseInt(time) : null,
            vocalistId: vocalist ? vocalist.id : null
        });

        // Update artist association
        await song.setArtists([artist]);

        req.flash('success', 'Song updated successfully!');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Update song error:', error);
        req.flash('error', 'An error occurred updating the song');
        res.redirect(`/songs/${req.params.id}/edit`);
    }
});

// API endpoints for auto-complete
router.get('/api/artists/search', async (req, res) => {
    try {
        const { q } = req.query;
        const artists = await Artist.findAll({
            where: {
                name: {
                    [require('sequelize').Op.iLike]: `%${q}%`
                }
            },
            limit: 10,
            order: [['name', 'ASC']]
        });

        res.json(artists.map(artist => ({ id: artist.id, name: artist.name })));
    } catch (error) {
        console.error('Artist search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/api/vocalists/search', async (req, res) => {
    try {
        const { q } = req.query;
        const vocalists = await Vocalist.findAll({
            where: {
                name: {
                    [require('sequelize').Op.iLike]: `%${q}%`
                }
            },
            limit: 10,
            order: [['name', 'ASC']]
        });

        res.json(vocalists.map(vocalist => ({ id: vocalist.id, name: vocalist.name })));
    } catch (error) {
        console.error('Vocalist search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /songs/api/:id - Get single song details (for restoring to band songs)
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