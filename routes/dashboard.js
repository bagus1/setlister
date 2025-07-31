const express = require('express');
const { User, Band, Song, Artist, Medley, BandMember } = require('../models');
const { requireAuth } = require('./auth');

const router = express.Router();

// GET / - Dashboard (different for logged in vs logged out)
router.get('/', async (req, res) => {
    try {
        if (req.session.user) {
            // Logged in dashboard
            const userId = req.session.user.id;

            // Get user's bands
            const userBands = await Band.findAll({
                include: [{
                    model: User,
                    where: { id: userId },
                    through: { attributes: [] }
                }],
                limit: 5,
                order: [['updatedAt', 'DESC']]
            });

            // Get recent songs
            const recentSongs = await Song.findAll({
                include: ['Vocalist', 'Artists'],
                limit: 5,
                order: [['updatedAt', 'DESC']]
            });

            // Get recent medleys
            const recentMedleys = await Medley.findAll({
                include: ['Vocalist'],
                limit: 5,
                order: [['updatedAt', 'DESC']]
            });

            // Get artists
            const artists = await Artist.findAll({
                limit: 5,
                order: [['name', 'ASC']]
            });

            res.render('dashboard/index', {
                title: 'Dashboard',
                loggedIn: true,
                userBands,
                recentSongs,
                recentMedleys,
                artists
            });
        } else {
            // Logged out dashboard
            const bands = await Band.findAll({
                limit: 10,
                order: [['name', 'ASC']]
            });

            const songs = await Song.findAll({
                include: ['Vocalist', 'Artists'],
                limit: 10,
                order: [['title', 'ASC']]
            });

            const artists = await Artist.findAll({
                limit: 10,
                order: [['name', 'ASC']]
            });

            res.render('dashboard/index', {
                title: 'Setlist Manager',
                loggedIn: false,
                bands,
                songs,
                artists
            });
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'An error occurred loading the dashboard');
        res.render('dashboard/index', {
            title: 'Dashboard',
            loggedIn: !!req.session.user,
            userBands: [],
            recentSongs: [],
            recentMedleys: [],
            artists: [],
            bands: [],
            songs: []
        });
    }
});

module.exports = router; 