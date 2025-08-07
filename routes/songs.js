const express = require('express');
const { body, validationResult } = require('express-validator');
const { Song, Artist, Vocalist, sequelize } = require('../models');
const { requireAuth } = require('./auth');
const { Op } = require('sequelize');

const router = express.Router();

// API Routes (must come before /:id routes)

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

// GET /songs/api/song/:id - Get song details
router.get('/api/song/:id', async (req, res) => {
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
    body('artist').optional().trim(),
    body('vocalist').optional().trim(),
    body('key').optional(),
    body('minutes').optional().isInt({ min: 0 }).withMessage('Minutes must be a positive number'),
    body('seconds').optional().isInt({ min: 0, max: 59 }).withMessage('Seconds must be between 0 and 59'),
    body('bpm').optional().custom((value) => {
        // Allow completely empty values
        if (!value || value === '' || value === null || value === undefined) {
            return true;
        }
        // If a value is provided, validate it
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 40 || numValue > 300) {
            throw new Error('BPM must be between 40 and 300');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        const { title, artist, vocalist, key, minutes = 0, seconds = 0, bpm } = req.body;

        console.log('=== SONG CREATION DEBUG ===');
        console.log('Form data received:', { title, artist, vocalist, key, minutes, seconds, bpm });
        console.log('BPM value type:', typeof bpm, 'BPM value:', bpm);
        console.log('Artist value:', artist, 'length:', artist ? artist.length : 'undefined');

        // Check for duplicate song
        const existingSong = await Song.findOne({
            where: { title },
            include: ['Artists']
        });

        const duplicateWarning = existingSong ?
            `A song with the title "${title}" already exists${existingSong.Artists && existingSong.Artists.length > 0 ? ` by ${existingSong.Artists[0].name}` : ''}.` :
            null;

        if (!errors.isEmpty() || duplicateWarning) {
            console.log('Validation errors:', errors.array());
            console.log('Duplicate warning:', duplicateWarning);

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
        if (vocalist && vocalist.trim()) {
            console.log('Creating/finding vocalist:', vocalist);
            const [vocalistRecord] = await Vocalist.findOrCreate({
                where: { name: vocalist.trim() },
                defaults: { name: vocalist.trim() }
            });
            vocalistId = vocalistRecord.id;
            console.log('Vocalist ID:', vocalistId);
        }

        // Convert BPM to proper value
        let bpmValue = null;
        if (bpm && typeof bpm === 'string' && bpm.trim() !== '') {
            bpmValue = parseInt(bpm.trim());
        } else if (bpm && typeof bpm === 'number') {
            bpmValue = bpm;
        }
        console.log('Processed BPM value:', bpmValue);

        // Create song
        const song = await Song.create({
            title: title.trim(),
            key: key || null,
            time: totalTime || null,
            bpm: bpmValue,
            vocalistId
        });

        console.log('Song created:', song.id);

        // Handle artist
        if (artist && artist.trim()) {
            console.log('Creating/finding artist:', artist);
            const [artistRecord] = await Artist.findOrCreate({
                where: { name: artist.trim() },
                defaults: { name: artist.trim() }
            });
            console.log('Artist record:', artistRecord.id, artistRecord.name);
            await song.addArtist(artistRecord);
            console.log('Artist added to song');
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
            include: ['Artists', 'Vocalist', 'Links']
        });

        if (!song) {
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        // Helper functions for link display
        const getLinkIcon = (type) => {
            const icons = {
                'youtube': 'youtube',
                'spotify': 'spotify',
                'apple-music': 'music-note',
                'soundcloud': 'cloud',
                'bandcamp': 'music-note-beamed',
                'lyrics': 'file-text',
                'tab': 'music-note',
                'bass tab': 'music-note-beamed',
                'chords': 'music-note-list',
                'tutorial': 'play-circle',
                'audio': 'headphones',
                'sheet-music': 'file-earmark-music',
                'backing-track': 'music-player',
                'karaoke': 'mic',
                'other': 'link-45deg'
            };
            return icons[type] || 'link-45deg';
        };

        const getLinkDisplayText = (link) => {
            const typeLabels = {
                'youtube': 'YouTube',
                'spotify': 'Spotify',
                'apple-music': 'Apple Music',
                'soundcloud': 'SoundCloud',
                'bandcamp': 'Bandcamp',
                'lyrics': 'Lyrics',
                'tab': 'Tab',
                'bass tab': 'Bass Tab',
                'chords': 'Chords',
                'tutorial': 'Tutorial',
                'audio': 'Audio File',
                'sheet-music': 'Sheet Music',
                'backing-track': 'Backing Track',
                'karaoke': 'Karaoke',
                'other': 'Other'
            };

            const typeLabel = typeLabels[link.type] || 'Link';
            return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
        };

        res.render('songs/show', {
            title: song.title,
            song,
            loggedIn: !!req.session.user,
            getLinkIcon,
            getLinkDisplayText
        });
    } catch (error) {
        console.error('Song show error:', error);
        req.flash('error', 'Error loading song');
        res.redirect('/songs');
    }
});

// GET /songs/:id/edit - Show edit song form
router.get('/:id/edit', requireAuth, async (req, res) => {
    console.log('=== GET EDIT FORM ROUTE HIT ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Params:', req.params);
    console.log('User:', req.session.user);
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

        console.log('=== RENDERING EDIT FORM ===');
        console.log('Song found:', song.title, 'ID:', song.id);
        console.log('Artists count:', artists.length);
        console.log('Vocalists count:', vocalists.length);
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

// POST /songs/:id/update - Update song (alternative to PUT)
router.post('/:id/update', requireAuth, (req, res, next) => {
    console.log('=== POST UPDATE ROUTE HIT ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Params:', req.params);
    console.log('User:', req.session.user);
    next();
}, [
    body('title').notEmpty().withMessage('Song title is required'),
    body('artist').optional().trim(),
    body('vocalist').optional().trim(),
    body('key').optional(),
    body('time').optional().custom((value) => {
        // Allow completely empty values
        if (!value || value === '' || value === null || value === undefined) {
            return true;
        }
        // If a value is provided, validate it
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) {
            throw new Error('Time must be a positive number');
        }
        return true;
    }),
    body('bpm').optional().custom((value) => {
        // Allow completely empty values
        if (!value || value === '' || value === null || value === undefined) {
            return true;
        }
        // If a value is provided, validate it
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 40 || numValue > 300) {
            throw new Error('BPM must be between 40 and 300');
        }
        return true;
    })
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

        const { title, artist, vocalist, key, time, bpm } = req.body;

        console.log('=== SONG EDIT DEBUG ===');
        console.log('Form data received:', { title, artist, vocalist, key, time, bpm });
        console.log('Artist value:', artist, 'length:', artist ? artist.length : 'undefined');
        console.log('Artist trimmed:', artist ? artist.trim() : 'undefined');

        // Calculate total time in seconds
        const totalTime = time ? parseInt(time) : null;

        // Convert BPM to proper value
        let bpmValue = null;
        if (bpm && typeof bpm === 'string' && bpm.trim() !== '') {
            bpmValue = parseInt(bpm.trim());
        } else if (bpm && typeof bpm === 'number') {
            bpmValue = bpm;
        }

        // Handle vocalist
        let vocalistId = null;
        if (vocalist && vocalist.trim()) {
            console.log('Creating/finding vocalist for edit:', vocalist);
            const [vocalistRecord] = await Vocalist.findOrCreate({
                where: { name: vocalist.trim() },
                defaults: { name: vocalist.trim() }
            });
            vocalistId = vocalistRecord.id;
            console.log('Vocalist ID for edit:', vocalistId);
        }

        // Update song (excluding title and artist which are now read-only)
        await song.update({
            key: key || null,
            time: totalTime || null,
            bpm: bpmValue,
            vocalistId
        });

        // Note: Title and artist are now read-only and cannot be changed
        // The form sends these values but we ignore them for security

        req.flash('success', 'Song updated successfully');
        res.redirect(`/songs/${song.id}`);
    } catch (error) {
        console.error('Update song error:', error);
        req.flash('error', 'Error updating song');
        res.redirect(`/songs/${req.params.id}/edit`);
    }
});

// PUT /songs/:id - Update song

// DELETE /songs/:id - Delete song
router.delete('/:id', requireAuth, async (req, res) => {
    console.log(`[${new Date().toISOString()}] DELETE song route hit:`, req.params);
    try {
        const song = await Song.findByPk(req.params.id);
        if (!song) {
            console.log(`[${new Date().toISOString()}] Song ${req.params.id} not found`);
            req.flash('error', 'Song not found');
            return res.redirect('/songs');
        }

        console.log(`[${new Date().toISOString()}] Deleting song:`, song.title);
        await song.destroy();
        console.log(`[${new Date().toISOString()}] Successfully deleted song ${req.params.id}`);
        req.flash('success', 'Song deleted successfully');
        res.redirect('/songs');
    } catch (error) {
        console.error('Delete song error:', error);
        req.flash('error', 'Error deleting song');
        res.redirect('/songs');
    }
});



// Debug route to catch all unmatched requests
router.use('*', (req, res, next) => {
    console.log('=== UNMATCHED ROUTE IN SONGS ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Original Method:', req.originalMethod);
    console.log('Body:', req.body);
    next();
});

module.exports = router; 