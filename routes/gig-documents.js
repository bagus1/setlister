const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { GigDocument, Band, Setlist, Song, Link, SetlistSet, SetlistSong, User } = require('../models');
const { requireAuth } = require('./auth');

// GET /gig-documents - List all gig documents for user's bands
router.get('/', requireAuth, async (req, res) => {
    try {
        const userBands = await Band.findAll({
            include: [{
                model: User,
                where: { id: req.session.user.id }
            }]
        });

        const bandIds = userBands.map(band => band.id);
        
        const gigDocuments = await GigDocument.findAll({
            where: { bandId: bandIds },
            include: [{ model: Band }],
            order: [['createdAt', 'DESC']]
        });

        res.render('gig-documents/index', {
            title: 'Gig Documents',
            gigDocuments,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Gig documents index error:', error);
        req.flash('error', 'Error loading gig documents');
        res.redirect('/dashboard');
    }
});

// GET /gig-documents/new - Create new gig document form
router.get('/new', requireAuth, async (req, res) => {
    try {
        const userBands = await Band.findAll({
            include: [{
                model: User,
                where: { id: req.session.user.id }
            }]
        });

        const setlists = await Setlist.findAll({
            where: { bandId: userBands.map(band => band.id) },
            order: [['createdAt', 'DESC']]
        });

        res.render('gig-documents/new', {
            title: 'New Gig Document',
            bands: userBands,
            setlists,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('New gig document error:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/gig-documents');
    }
});

// POST /gig-documents - Create new gig document
router.post('/', requireAuth, [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
    body('bandId').isInt().withMessage('Please select a band'),
    body('setlistId').optional().isInt(),
    body('gigDate').optional().isISO8601().withMessage('Invalid date format'),
    body('venue').optional().isLength({ max: 255 }).withMessage('Venue too long'),
    body('description').optional()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            req.flash('error', errors.array()[0].msg);
            return res.redirect('/gig-documents/new');
        }

        const { title, bandId, setlistId, gigDate, venue, description } = req.body;

        // Verify user has access to this band
        const userBand = await Band.findOne({
            include: [{
                model: User,
                where: { id: req.session.user.id }
            }],
            where: { id: bandId }
        });

        if (!userBand) {
            req.flash('error', 'Band not found or access denied');
            return res.redirect('/gig-documents/new');
        }

        // Generate document content if setlist is provided
        let content = null;
        if (setlistId) {
            const setlist = await Setlist.findByPk(setlistId, {
                include: [{
                    model: SetlistSet,
                    include: [{
                        model: SetlistSong,
                        include: [{
                            model: Song,
                            include: ['Artists', 'Vocalist', 'Links']
                        }]
                    }]
                }]
            });

            if (setlist) {
                content = await generateGigDocumentContent(setlist);
            }
        }

        const gigDocument = await GigDocument.create({
            bandId,
            title: title.trim(),
            gigDate: gigDate ? new Date(gigDate) : null,
            venue: venue ? venue.trim() : null,
            description: description ? description.trim() : null,
            content,
            generatedAt: content ? new Date() : null
        });

        req.flash('success', 'Gig document created successfully');
        res.redirect(`/gig-documents/${gigDocument.id}`);
    } catch (error) {
        console.error('Create gig document error:', error);
        req.flash('error', 'Error creating gig document');
        res.redirect('/gig-documents/new');
    }
});

// GET /gig-documents/:id - Show gig document
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const gigDocument = await GigDocument.findByPk(req.params.id, {
            include: [{ model: Band }]
        });

        if (!gigDocument) {
            req.flash('error', 'Gig document not found');
            return res.redirect('/gig-documents');
        }

        // Verify user has access to this band
        const userBand = await Band.findOne({
            include: [{
                model: User,
                where: { id: req.session.user.id }
            }],
            where: { id: gigDocument.bandId }
        });

        if (!userBand) {
            req.flash('error', 'Access denied');
            return res.redirect('/gig-documents');
        }

        res.render('gig-documents/show', {
            title: gigDocument.title,
            gigDocument,
            loggedIn: !!req.session.user
        });
    } catch (error) {
        console.error('Show gig document error:', error);
        req.flash('error', 'Error loading gig document');
        res.redirect('/gig-documents');
    }
});

// POST /gig-documents/:id/generate - Generate document content from setlist
router.post('/:id/generate', requireAuth, async (req, res) => {
    try {
        const { setlistId } = req.body;
        
        const gigDocument = await GigDocument.findByPk(req.params.id);
        if (!gigDocument) {
            req.flash('error', 'Gig document not found');
            return res.redirect('/gig-documents');
        }

        const setlist = await Setlist.findByPk(setlistId, {
            include: [{
                model: SetlistSet,
                include: [{
                    model: SetlistSong,
                    include: [{
                        model: Song,
                        include: ['Artists', 'Vocalist', 'Links']
                    }]
                }]
            }]
        });

        if (!setlist) {
            req.flash('error', 'Setlist not found');
            return res.redirect(`/gig-documents/${gigDocument.id}`);
        }

        const content = await generateGigDocumentContent(setlist);
        
        await gigDocument.update({
            content,
            generatedAt: new Date()
        });

        req.flash('success', 'Document content generated successfully');
        res.redirect(`/gig-documents/${gigDocument.id}`);
    } catch (error) {
        console.error('Generate content error:', error);
        req.flash('error', 'Error generating document content');
        res.redirect(`/gig-documents/${req.params.id}`);
    }
});

// Helper function to generate gig document content
async function generateGigDocumentContent(setlist) {
    let content = `# ${setlist.title}\n\n`;
    if (setlist.description) {
        content += `${setlist.description}\n\n`;
    }

    content += `Generated on ${new Date().toLocaleDateString()}\n\n`;

    // Process each set
    for (const set of setlist.SetlistSets) {
        if (set.SetlistSongs.length === 0) continue;

        content += `## ${set.name}\n\n`;
        
        for (let i = 0; i < set.SetlistSongs.length; i++) {
            const setlistSong = set.SetlistSongs[i];
            const song = setlistSong.Song;
            
            content += `### ${i + 1}. ${song.title}\n`;
            
            if (song.Artists && song.Artists.length > 0) {
                content += `**Artist:** ${song.Artists.map(artist => artist.name).join(', ')}\n`;
            }
            
            if (song.Vocalist) {
                content += `**Vocalist:** ${song.Vocalist.name}\n`;
            }
            
            if (song.key) {
                content += `**Key:** ${song.key}\n`;
            }
            
            if (song.time) {
                const minutes = Math.floor(song.time / 60);
                const seconds = song.time % 60;
                content += `**Duration:** ${minutes}:${seconds.toString().padStart(2, '0')}\n`;
            }
            
            // Add links/content
            if (song.Links && song.Links.length > 0) {
                const chordLinks = song.Links.filter(link => 
                    ['chords', 'google-doc', 'document'].includes(link.type)
                );
                
                if (chordLinks.length > 0) {
                    content += `**Chords/Lyrics:**\n`;
                    for (const link of chordLinks) {
                        if (link.content) {
                            content += `${link.content}\n`;
                        } else if (link.url) {
                            content += `[${link.description || link.type}](${link.url})\n`;
                        }
                    }
                }
            }
            
            content += '\n';
        }
        
        content += '\n';
    }

    return content;
}

module.exports = router;
