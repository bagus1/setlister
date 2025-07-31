const express = require('express');
const { body, validationResult } = require('express-validator');
const { Medley, Song, MedleySong, Vocalist, Artist } = require('../models');
const { requireAuth } = require('./auth');

const router = express.Router();

// GET /medleys - List all medleys
router.get('/', async (req, res) => {
    try {
        const medleys = await Medley.findAll({
            include: ['Vocalist'],
            order: [['name', 'ASC']]
        });

        res.render('medleys/index', {
            title: 'Medleys',
            medleys,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Medleys index error:', error);
        req.flash('error', 'An error occurred loading medleys');
        res.redirect('/');
    }
});

// GET /medleys/new - Show create medley form (requires auth)
router.get('/new', requireAuth, async (req, res) => {
    try {
        const songs = await Song.findAll({
            include: ['Vocalist', 'Artists'],
            order: [['title', 'ASC']]
        });

        const vocalists = await Vocalist.findAll({
            order: [['name', 'ASC']]
        });

        res.render('medleys/new', {
            title: 'Create Medley',
            songs,
            vocalists
        });
    } catch (error) {
        console.error('New medley error:', error);
        req.flash('error', 'An error occurred loading the form');
        res.redirect('/medleys');
    }
});

// POST /medleys - Create a new medley (requires auth)
router.post('/', requireAuth, [
    body('name').optional().trim(),
    body('key').optional().isIn([
        'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
        'Cm', 'C#m', 'Dbm', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gbm', 'Gm', 'G#m', 'Abm', 'Am', 'A#m', 'Bbm', 'Bm'
    ]).withMessage('Invalid key'),
    body('vocalistId').optional().isInt().withMessage('Invalid vocalist'),
    body('songIds').isArray({ min: 2 }).withMessage('At least 2 songs are required for a medley')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const songs = await Song.findAll({
                include: ['Vocalist', 'Artists'],
                order: [['title', 'ASC']]
            });

            const vocalists = await Vocalist.findAll({
                order: [['name', 'ASC']]
            });

            return res.render('medleys/new', {
                title: 'Create Medley',
                errors: errors.array(),
                songs,
                vocalists,
                formData: req.body
            });
        }

        const { name, key, vocalistId, songIds } = req.body;

        // Generate name if not provided (first two words of first two songs + "Medley")
        let medleyName = name;
        if (!medleyName) {
            const firstTwoSongs = await Song.findAll({
                where: { id: songIds.slice(0, 2) },
                order: [['title', 'ASC']]
            });

            const words = [];
            firstTwoSongs.forEach(song => {
                const songWords = song.title.split(' ').slice(0, 2);
                words.push(...songWords);
            });

            medleyName = words.slice(0, 4).join(' ') + ' Medley';
        }

        // Create medley
        const medley = await Medley.create({
            name: medleyName,
            key: key || null,
            vocalistId: vocalistId || null
        });

        // Add songs to medley
        for (let i = 0; i < songIds.length; i++) {
            await MedleySong.create({
                medleyId: medley.id,
                songId: songIds[i],
                order: i + 1
            });
        }

        req.flash('success', 'Medley created successfully!');
        res.redirect(`/medleys/${medley.id}`);
    } catch (error) {
        console.error('Create medley error:', error);
        req.flash('error', 'An error occurred creating the medley');
        res.redirect('/medleys/new');
    }
});

// GET /medleys/:id - Show medley details
router.get('/:id', async (req, res) => {
    try {
        const medley = await Medley.findByPk(req.params.id, {
            include: [
                'Vocalist',
                {
                    model: Song,
                    through: { attributes: ['order'] },
                    include: ['Vocalist', 'Artists']
                }
            ]
        });

        if (!medley) {
            req.flash('error', 'Medley not found');
            return res.redirect('/medleys');
        }

        // Sort songs by order
        medley.Songs.sort((a, b) => a.MedleySong.order - b.MedleySong.order);

        res.render('medleys/show', {
            title: medley.name,
            medley,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Show medley error:', error);
        req.flash('error', 'An error occurred loading the medley');
        res.redirect('/medleys');
    }
});

// GET /medleys/:id/edit - Show edit medley form (requires auth)
router.get('/:id/edit', requireAuth, async (req, res) => {
    try {
        const medley = await Medley.findByPk(req.params.id, {
            include: [
                'Vocalist',
                {
                    model: Song,
                    through: { attributes: ['order'] }
                }
            ]
        });

        if (!medley) {
            req.flash('error', 'Medley not found');
            return res.redirect('/medleys');
        }

        const allSongs = await Song.findAll({
            include: ['Vocalist', 'Artists'],
            order: [['title', 'ASC']]
        });

        const vocalists = await Vocalist.findAll({
            order: [['name', 'ASC']]
        });

        // Sort medley songs by order
        medley.Songs.sort((a, b) => a.MedleySong.order - b.MedleySong.order);

        res.render('medleys/edit', {
            title: `Edit ${medley.name}`,
            medley,
            allSongs,
            vocalists
        });
    } catch (error) {
        console.error('Edit medley error:', error);
        req.flash('error', 'An error occurred loading the edit form');
        res.redirect('/medleys');
    }
});

module.exports = router; 