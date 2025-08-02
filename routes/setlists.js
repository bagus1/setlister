const express = require('express');
const { body, validationResult } = require('express-validator');
const { Setlist, SetlistSet, SetlistSong, Band, BandMember, Song, BandSong, Artist, Vocalist, User } = require('../models');
const { requireAuth } = require('./auth');

const router = express.Router();

// All setlist routes require authentication
router.use(requireAuth);

// GET /setlists/:id - Show setlist details
router.get('/:id', async (req, res) => {
    try {
        const setlistId = req.params.id;

        // Check if user is authenticated
        if (!req.session.user || !req.session.user.id) {
            req.flash('error', 'Please log in to view setlists');
            return res.redirect('/auth/login');
        }

        const userId = req.session.user.id;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{ model: Song, include: ['Artists', 'Vocalist'] }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found or access denied');
            return res.redirect('/bands');
        }

        res.render('setlists/show', {
            title: setlist.title,
            setlist
        });
    } catch (error) {
        console.error('Show setlist error:', error);
        req.flash('error', 'An error occurred loading the setlist');
        res.redirect('/bands');
    }
});

// GET /setlists/:id/edit - Show setlist edit page with drag-drop
router.get('/:id/edit', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{ model: Song, include: ['Artists', 'Vocalist'] }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found');
            return res.redirect('/bands');
        }

        // Check if setlist date has passed (no editing after performance date)
        if (setlist.date && new Date() > new Date(setlist.date)) {
            req.flash('error', 'This setlist cannot be edited as the performance date has passed');
            return res.redirect(`/setlists/${setlist.id}/finalize`);
        }

        // Get all band's songs
        const allBandSongs = await Song.findAll({
            include: [
                'Artists',
                'Vocalist',
                {
                    model: Band,
                    where: { id: setlist.bandId },
                    through: { attributes: [] }
                }
            ],
            order: [['title', 'ASC']]
        });

        // Get songs already in this setlist through SetlistSets
        const setlistSets = await SetlistSet.findAll({
            where: { setlistId: setlist.id },
            include: [{
                model: SetlistSong,
                attributes: ['songId']
            }]
        });

        // Extract used song IDs
        const usedSongIds = [];
        setlistSets.forEach(set => {
            if (set.SetlistSongs) {
                set.SetlistSongs.forEach(setlistSong => {
                    usedSongIds.push(setlistSong.songId);
                });
            }
        });

        // Filter out songs already in the setlist
        const bandSongs = allBandSongs.filter(song => !usedSongIds.includes(song.id));

        res.render('setlists/edit', {
            title: `Edit ${setlist.title}`,
            setlist,
            bandSongs
        });
    } catch (error) {
        console.error('Edit setlist error:', error);
        req.flash('error', 'An error occurred loading the setlist editor');
        res.redirect('/bands');
    }
});

// POST /setlists/:id/save - Save setlist changes
router.post('/:id/save', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;
        const { sets } = req.body;

        // Verify user has access
        const setlist = await Setlist.findByPk(setlistId, {
            include: [{
                model: Band,
                include: [{
                    model: User,
                    where: { id: userId },
                    through: { attributes: [] }
                }]
            }]
        });

        if (!setlist) {
            return res.status(404).json({ error: 'Setlist not found' });
        }

        // Check if setlist date has passed (no saving after performance date)
        if (setlist.date && new Date() > new Date(setlist.date)) {
            return res.status(403).json({ error: 'This setlist cannot be edited as the performance date has passed' });
        }

        // Clear existing setlist songs
        // First get all SetlistSets for this setlist
        const setlistSets = await SetlistSet.findAll({
            where: { setlistId },
            attributes: ['id']
        });

        if (setlistSets.length > 0) {
            const setlistSetIds = setlistSets.map(set => set.id);
            await SetlistSong.destroy({
                where: {
                    setlistSetId: setlistSetIds
                }
            });
        }

        // Update sets
        for (const [setName, songs] of Object.entries(sets)) {
            let setlistSet = await SetlistSet.findOne({
                where: { setlistId, name: setName }
            });

            if (!setlistSet && songs.length > 0) {
                // Create set if it doesn't exist and has songs
                const setOrder = ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Maybe'].indexOf(setName);
                setlistSet = await SetlistSet.create({
                    setlistId,
                    name: setName,
                    order: setOrder
                });
            }

            if (setlistSet) {
                // Add songs to set
                for (let i = 0; i < songs.length; i++) {
                    await SetlistSong.create({
                        setlistSetId: setlistSet.id,
                        songId: songs[i],
                        order: i + 1
                    });
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save setlist error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /setlists/:id/finalize - Show finalize page
router.get('/:id/finalize', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{ model: Song, include: ['Artists', 'Vocalist'] }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found');
            return res.redirect('/bands');
        }

        // Calculate set times
        const setTimes = {};
        let totalTime = 0;

        setlist.SetlistSets.forEach(set => {
            if (set.name !== 'Maybe') {
                let setTime = 0;
                set.SetlistSongs.forEach(setlistSong => {
                    if (setlistSong.Song.time) {
                        setTime += setlistSong.Song.time;
                    }
                });
                setTimes[set.name] = setTime;
                totalTime += setTime;
            }
        });

        res.render('setlists/finalize', {
            title: `Finalize ${setlist.title}`,
            setlist,
            setTimes,
            totalTime
        });
    } catch (error) {
        console.error('Finalize setlist error:', error);
        req.flash('error', 'An error occurred loading the finalize page');
        res.redirect('/bands');
    }
});

// POST /setlists/:id/finalize - Finalize the setlist
router.post('/:id/finalize', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;

        // Verify user has access
        const setlist = await Setlist.findByPk(setlistId, {
            include: [{
                model: Band,
                include: [{
                    model: User,
                    where: { id: userId },
                    through: { attributes: [] }
                }]
            }]
        });

        if (!setlist) {
            return res.status(404).json({ error: 'Setlist not found' });
        }

        await setlist.update({ isFinalized: true });

        req.flash('success', 'Setlist finalized successfully!');
        res.redirect(`/setlists/${setlistId}/print`);
    } catch (error) {
        console.error('Finalize setlist error:', error);
        req.flash('error', 'An error occurred finalizing the setlist');
        res.redirect(`/setlists/${req.params.id}/finalize`);
    }
});

// GET /setlists/:id/print - Show print page with export options
router.get('/:id/print', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{ model: Song, include: ['Artists', 'Vocalist'] }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found');
            return res.redirect('/bands');
        }

        res.render('setlists/print', {
            title: `Print ${setlist.title}`,
            setlist
        });
    } catch (error) {
        console.error('Print setlist error:', error);
        req.flash('error', 'An error occurred loading the print page');
        res.redirect('/bands');
    }
});

// GET /setlists/:id/export - Export setlist as text (direct download)
router.get('/:id/export', async (req, res) => {
    try {
        const setlistId = req.params.id;

        // Check if user is authenticated
        if (!req.session.user || !req.session.user.id) {
            req.flash('error', 'Please log in to export setlists');
            return res.redirect('/auth/login');
        }

        const userId = req.session.user.id;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{
                            model: Song,
                            include: ['Artists', 'Vocalist']
                        }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found');
            return res.redirect('/bands');
        }

        // Generate text export with all details
        let exportText = `${setlist.title}\n`;
        exportText += `Band: ${setlist.Band.name}\n`;
        if (setlist.date) {
            exportText += `Date: ${new Date(setlist.date).toLocaleDateString()}\n`;
        }
        exportText += `\n`;

        setlist.SetlistSets.forEach(set => {
            if (set.name !== 'Maybe' && set.SetlistSongs.length > 0) {
                exportText += `${set.name}:\n`;

                set.SetlistSongs.forEach((setlistSong, index) => {
                    const song = setlistSong.Song;
                    let line = `  ${index + 1}. ${song.title}`;

                    if (song.Artists && song.Artists.length > 0) {
                        line += ` - ${song.Artists[0].name}`;
                    }

                    if (song.Vocalist) {
                        line += ` (${song.Vocalist.name})`;
                    }

                    if (song.key) {
                        line += ` [${song.key}]`;
                    }

                    if (song.time) {
                        const minutes = Math.floor(song.time / 60);
                        const seconds = song.time % 60;
                        line += ` (${minutes}:${seconds.toString().padStart(2, '0')})`;
                    }

                    exportText += line + '\n';
                });

                exportText += '\n';
            }
        });

        // Include Maybe list if it has songs
        const maybeSet = setlist.SetlistSets.find(set => set.name === 'Maybe');
        if (maybeSet && maybeSet.SetlistSongs.length > 0) {
            exportText += 'Maybe:\n';
            maybeSet.SetlistSongs.forEach((setlistSong, index) => {
                const song = setlistSong.Song;
                let line = `  ${index + 1}. ${song.title}`;
                if (song.Artists && song.Artists.length > 0) {
                    line += ` - ${song.Artists[0].name}`;
                }
                exportText += line + '\n';
            });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${setlist.title}.txt"`);
        res.send(exportText);
    } catch (error) {
        console.error('Export setlist error:', error);
        req.flash('error', 'Export failed');
        res.redirect('/bands');
    }
});

// POST /setlists/:id/export - Export setlist as text (with options)
router.post('/:id/export', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;
        const { includeArtist, includeVocalist, includeKey, includeTime } = req.body;

        const setlist = await Setlist.findByPk(setlistId, {
            include: [
                {
                    model: Band,
                    include: [{
                        model: User,
                        where: { id: userId },
                        through: { attributes: [] }
                    }]
                },
                {
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{ model: Song, include: ['Artists', 'Vocalist'] }],
                        order: [['order', 'ASC']]
                    }],
                    order: [['order', 'ASC']]
                }
            ]
        });

        if (!setlist) {
            return res.status(404).json({ error: 'Setlist not found' });
        }

        // Generate text export
        let exportText = `${setlist.title}\n`;
        if (setlist.date) {
            exportText += `Date: ${new Date(setlist.date).toLocaleDateString()}\n`;
        }
        exportText += `\n`;

        setlist.SetlistSets.forEach(set => {
            if (set.name !== 'Maybe' && set.SetlistSongs.length > 0) {
                exportText += `${set.name}:\n`;

                set.SetlistSongs.forEach(setlistSong => {
                    const song = setlistSong.Song;
                    let line = `  ${song.title}`;

                    if (includeArtist && song.Artists.length > 0) {
                        line += ` - ${song.Artists[0].name}`;
                    }

                    if (includeVocalist && song.Vocalist) {
                        line += ` (${song.Vocalist.name})`;
                    }

                    if (includeKey && song.key) {
                        line += ` [${song.key}]`;
                    }

                    if (includeTime && song.time) {
                        const minutes = Math.floor(song.time / 60);
                        const seconds = song.time % 60;
                        line += ` (${minutes}:${seconds.toString().padStart(2, '0')})`;
                    }

                    exportText += line + '\n';
                });

                exportText += '\n';
            }
        });

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${setlist.title}.txt"`);
        res.send(exportText);
    } catch (error) {
        console.error('Export setlist error:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// API endpoint to update setlist via Socket.io
router.post('/:id/update', async (req, res) => {
    try {
        const setlistId = req.params.id;
        const userId = req.session.user.id;
        const { action, data } = req.body;

        // Verify user has access
        const setlist = await Setlist.findByPk(setlistId, {
            include: [{
                model: Band,
                include: [{
                    model: User,
                    where: { id: userId },
                    through: { attributes: [] }
                }]
            }]
        });

        if (!setlist) {
            return res.status(404).json({ error: 'Setlist not found' });
        }

        // Broadcast update to other users
        const io = req.app.get('io');
        if (io) {
            io.to(`setlist-${setlistId}`).emit('setlist-updated', {
                setlistId,
                action,
                data,
                userId
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Update setlist error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 