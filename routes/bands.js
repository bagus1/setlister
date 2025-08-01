const express = require('express');
const { body, validationResult } = require('express-validator');
const { User, Band, BandMember, Song, BandSong, Setlist, SetlistSet, BandInvitation } = require('../models');
const { sendBandInvitation } = require('../utils/emailService');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('./auth');

const router = express.Router();

// All band routes require authentication
router.use(requireAuth);

// GET /bands - List all bands for the user
router.get('/', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const bands = await Band.findAll({
            include: [{
                model: User,
                where: { id: userId },
                through: { attributes: ['role'] }
            }],
            order: [['name', 'ASC']]
        });

        res.render('bands/index', {
            title: 'My Bands',
            bands
        });
    } catch (error) {
        console.error('Bands index error:', error);
        req.flash('error', 'An error occurred loading bands');
        res.redirect('/');
    }
});

// GET /bands/new - Show create band form
router.get('/new', (req, res) => {
    res.render('bands/new', { title: 'Create Band' });
});

// POST /bands - Create a new band
router.post('/', [
    body('name').trim().isLength({ min: 1 }).withMessage('Band name is required'),
    body('description').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('bands/new', {
                title: 'Create Band',
                errors: errors.array(),
                name: req.body.name,
                description: req.body.description
            });
        }

        const { name, description } = req.body;
        const userId = req.session.user.id;

        // Create band
        const band = await Band.create({
            name,
            description,
            createdById: userId
        });

        // Add creator as owner
        await BandMember.create({
            bandId: band.id,
            userId,
            role: 'owner'
        });

        req.flash('success', 'Band created successfully!');
        res.redirect(`/bands/${band.id}`);
    } catch (error) {
        console.error('Create band error:', error);
        req.flash('error', 'An error occurred creating the band');
        res.redirect('/bands/new');
    }
});

// GET /bands/:id - Show band details
router.get('/:id', async (req, res) => {
    try {
        const bandId = req.params.id;
        const userId = req.session.user.id;

        const band = await Band.findByPk(bandId, {
            include: [
                {
                    model: User,
                    through: { attributes: ['role'] }
                }
            ]
        });

        if (!band) {
            req.flash('error', 'Band not found');
            return res.redirect('/bands');
        }

        // Check if user is a member
        const isMember = band.Users.some(user => user.id === userId);
        if (!isMember) {
            req.flash('error', 'You are not a member of this band');
            return res.redirect('/bands');
        }

        // Get setlists
        const setlists = await Setlist.findAll({
            where: { bandId },
            order: [['updatedAt', 'DESC']]
        });

        res.render('bands/show', {
            title: band.name,
            band,
            setlists,
            userId
        });
    } catch (error) {
        console.error('Show band error:', error);
        req.flash('error', 'An error occurred loading the band');
        res.redirect('/bands');
    }
});

// POST /bands/:id/setlists - Create a new setlist for the band
router.post('/:id/setlists', [
    body('title').trim().isLength({ min: 1 }).withMessage('Setlist title is required'),
    body('date').optional().isISO8601().withMessage('Invalid date format')
], async (req, res) => {
    try {
        const bandId = req.params.id;
        const userId = req.session.user.id;

        // Check if user is a member
        const membership = await BandMember.findOne({
            where: { bandId, userId }
        });

        if (!membership) {
            req.flash('error', 'You are not a member of this band');
            return res.redirect('/bands');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.array()[0].msg);
            return res.redirect(`/bands/${bandId}`);
        }

        const { title, date } = req.body;

        // Create setlist
        const setlist = await Setlist.create({
            title,
            bandId,
            date: date || null
        });

        // Create default sets
        const setNames = ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Maybe'];
        for (let i = 0; i < setNames.length; i++) {
            await SetlistSet.create({
                setlistId: setlist.id,
                name: setNames[i],
                order: i
            });
        }

        req.flash('success', 'Setlist created successfully!');
        res.redirect(`/setlists/${setlist.id}/edit`);
    } catch (error) {
        console.error('Create setlist error:', error);
        req.flash('error', 'An error occurred creating the setlist');
        res.redirect(`/bands/${req.params.id}`);
    }
});

// POST /bands/:id/invite - Send email invitation to join the band
router.post('/:id/invite', [
    body('email').isEmail().withMessage('Please enter a valid email')
], async (req, res) => {
    try {
        const bandId = req.params.id;
        const userId = req.session.user.id;
        const { email } = req.body;

        // Check if user is owner of the band
        const membership = await BandMember.findOne({
            where: { bandId, userId, role: 'owner' }
        });

        if (!membership) {
            req.flash('error', 'Only band owners can invite members');
            return res.redirect(`/bands/${bandId}`);
        }

        // Get band details
        const band = await Band.findByPk(bandId);
        if (!band) {
            req.flash('error', 'Band not found');
            return res.redirect('/bands');
        }

        // Check if user is already a member
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            const existingMembership = await BandMember.findOne({
                where: { bandId, userId: existingUser.id }
            });

            if (existingMembership) {
                req.flash('error', 'This person is already a member of the band');
                return res.redirect(`/bands/${bandId}`);
            }
        }

        // Check if there's already a pending invitation
        const existingInvitation = await BandInvitation.findOne({
            where: {
                bandId,
                email,
                usedAt: null,
                expiresAt: { [require('sequelize').Op.gt]: new Date() }
            }
        });

        if (existingInvitation) {
            req.flash('error', 'An invitation has already been sent to this email address');
            return res.redirect(`/bands/${bandId}`);
        }

        // Create invitation
        const invitation = await BandInvitation.create({
            bandId,
            email,
            token: uuidv4(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            invitedBy: userId
        });

        // Get inviter name
        const inviter = await User.findByPk(userId);

        // Send email
        const emailSent = await sendBandInvitation(invitation, band, inviter.username);

        if (emailSent) {
            req.flash('success', `Invitation sent to ${email}! They have 7 days to accept.`);
        } else {
            req.flash('error', 'Failed to send invitation email. Please check your email configuration.');
        }

        res.redirect(`/bands/${bandId}`);
    } catch (error) {
        console.error('Invite member error:', error);
        req.flash('error', 'An error occurred sending the invitation');
        res.redirect(`/bands/${req.params.id}`);
    }
});

// GET /bands/:id/songs - Show band's songs with checkboxes
router.get('/:id/songs', async (req, res) => {
    try {
        const bandId = req.params.id;
        const userId = req.session.user.id;

        // Check if user is a member
        const membership = await BandMember.findOne({
            where: { bandId, userId }
        });

        if (!membership) {
            req.flash('error', 'You are not a member of this band');
            return res.redirect('/bands');
        }

        const band = await Band.findByPk(bandId);

        // Get all songs
        const allSongs = await Song.findAll({
            include: ['Vocalist', 'Artists'],
            order: [['title', 'ASC']]
        });

        // Get band's current songs
        const bandSongs = await BandSong.findAll({
            where: { bandId },
            include: [{
                model: Song,
                include: ['Vocalist', 'Artists']
            }]
        });

        const bandSongIds = bandSongs.map(bs => bs.songId);

        res.render('bands/songs', {
            title: `${band.name} - Songs`,
            band,
            allSongs,
            bandSongIds
        });
    } catch (error) {
        console.error('Band songs error:', error);
        req.flash('error', 'An error occurred loading band songs');
        res.redirect(`/bands/${req.params.id}`);
    }
});

// POST /bands/:id/songs/:songId - Add song to band
router.post('/:id/songs/:songId', async (req, res) => {
    try {
        const { id: bandId, songId } = req.params;
        const userId = req.session.user.id;

        // Check if user is a member
        const membership = await BandMember.findOne({
            where: { bandId, userId }
        });

        if (!membership) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if already added
        const existing = await BandSong.findOne({
            where: { bandId, songId }
        });

        if (existing) {
            return res.status(400).json({ error: 'Song already in band' });
        }

        await BandSong.create({ bandId, songId });
        res.json({ success: true });
    } catch (error) {
        console.error('Add band song error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /bands/:id/songs/:songId - Remove song from band
router.delete('/:id/songs/:songId', async (req, res) => {
    try {
        const { id: bandId, songId } = req.params;
        const userId = req.session.user.id;

        // Check if user is a member
        const membership = await BandMember.findOne({
            where: { bandId, userId }
        });

        if (!membership) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await BandSong.destroy({
            where: { bandId, songId }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Remove band song error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 