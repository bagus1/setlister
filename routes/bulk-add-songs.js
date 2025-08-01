const express = require('express');
const { body, validationResult } = require('express-validator');
const { Song, Artist, Vocalist, sequelize } = require('../models');
const { requireAuth } = require('./auth');

const router = express.Router();

// GET /bulk-add-songs - Show bulk add form
router.get('/', requireAuth, (req, res) => {
    res.render('songs/bulk-add', {
        title: 'Bulk Add Songs'
    });
});

// POST /bulk-add-songs - Process bulk add
router.post('/', requireAuth, [
    body('format').isIn(['text', 'csv']).withMessage('Invalid format'),
    body('data').notEmpty().withMessage('Please provide song data')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('songs/bulk-add', {
                title: 'Bulk Add Songs',
                errors: errors.array(),
                format: req.body.format,
                data: req.body.data
            });
        }

        const { format, data } = req.body;
        const results = {
            added: [],
            errors: [],
            skipped: []
        };

        if (format === 'text') {
            // Process simple text format (one song per line)
            const lines = data.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const title = line.trim();
                if (!title) continue;

                try {
                    // Check if song already exists
                    const existingSong = await Song.findOne({
                        where: { title },
                        include: ['Artists']
                    });

                    if (existingSong) {
                        results.skipped.push(`"${title}" (already exists)`);
                        continue;
                    }

                    // Create new song
                    const song = await Song.create({
                        title,
                        time: null, // No time specified in text format
                        key: null   // No key specified in text format
                    });

                    results.added.push(title);
                } catch (error) {
                    console.error('Error adding song:', error);
                    results.errors.push(`"${title}": ${error.message}`);
                }
            }
        } else if (format === 'csv') {
            // Process CSV format
            const lines = data.split('\n').filter(line => line.trim());

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                try {
                    // Parse CSV line (title,artist,vocalist,key,time)
                    const parts = line.split(',').map(part => part.trim().replace(/^["']|["']$/g, ''));
                    const [title, artistName = '', vocalistName = '', key = '', timeStr = ''] = parts;

                    if (!title) {
                        results.errors.push(`Line ${i + 1}: Missing song title`);
                        continue;
                    }

                    // Check if song already exists
                    const existingSong = await Song.findOne({
                        where: { title },
                        include: ['Artists']
                    });

                    if (existingSong) {
                        results.skipped.push(`"${title}" (already exists)`);
                        continue;
                    }

                    // Validate key if provided
                    const validKeys = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
                    const songKey = key && validKeys.includes(key) ? key : null;

                    // Parse time if provided (assumes format like "3:45" or "245" seconds)
                    let songTime = null;
                    if (timeStr) {
                        if (timeStr.includes(':')) {
                            const [minutes, seconds] = timeStr.split(':').map(Number);
                            if (!isNaN(minutes) && !isNaN(seconds)) {
                                songTime = (minutes * 60) + seconds;
                            }
                        } else {
                            const totalSeconds = parseInt(timeStr);
                            if (!isNaN(totalSeconds)) {
                                songTime = totalSeconds;
                            }
                        }
                    }

                    // Create or find artist
                    let artist = null;
                    if (artistName) {
                        [artist] = await Artist.findOrCreate({
                            where: { name: artistName },
                            defaults: { name: artistName }
                        });
                    }

                    // Create or find vocalist
                    let vocalist = null;
                    if (vocalistName) {
                        [vocalist] = await Vocalist.findOrCreate({
                            where: { name: vocalistName },
                            defaults: { name: vocalistName }
                        });
                    }

                    // Create song
                    const song = await Song.create({
                        title,
                        key: songKey,
                        time: songTime,
                        vocalistId: vocalist ? vocalist.id : null
                    });

                    // Associate with artist if provided
                    if (artist) {
                        await song.addArtist(artist);
                    }

                    let displayText = `"${title}"`;
                    if (artistName) displayText += ` by ${artistName}`;
                    if (vocalistName) displayText += ` (vocals: ${vocalistName})`;
                    if (songKey) displayText += ` [${songKey}]`;
                    if (songTime) {
                        const minutes = Math.floor(songTime / 60);
                        const seconds = songTime % 60;
                        displayText += ` (${minutes}:${seconds.toString().padStart(2, '0')})`;
                    }

                    results.added.push(displayText);
                } catch (error) {
                    console.error('Error processing CSV line:', error);
                    results.errors.push(`Line ${i + 1}: ${error.message}`);
                }
            }
        }

        res.render('songs/bulk-add', {
            title: 'Bulk Add Songs',
            results,
            format,
            data
        });

    } catch (error) {
        console.error('Bulk add error:', error);
        req.flash('error', 'An error occurred during bulk add');
        res.redirect('/bulk-add-songs');
    }
});

module.exports = router; 