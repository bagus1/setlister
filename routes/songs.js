const express = require("express");
const { body, validationResult } = require("express-validator");
const { Song, Artist, Vocalist, sequelize } = require("../models");
const { requireAuth } = require("./auth");
const { Op } = require("sequelize");
const logger = require("../utils/logger");

const router = express.Router();

// API Routes (must come before /:id routes)

// GET /songs/api/artists/search - Search artists for autofill
router.get("/api/artists/search", async (req, res) => {
  try {
    const { q } = req.query;
    const artists = await Artist.findAll({
      where: {
        name: {
          [Op.iLike]: `%${q}%`,
        },
      },
      limit: 10,
      order: [["name", "ASC"]],
    });

    res.json(
      artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
      }))
    );
  } catch (error) {
    logger.logError("Artist search error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /songs/api/vocalists/search - Search vocalists for autofill
router.get("/api/vocalists/search", async (req, res) => {
  try {
    const { q } = req.query;
    const vocalists = await Vocalist.findAll({
      where: {
        name: {
          [Op.iLike]: `%${q}%`,
        },
      },
      limit: 10,
      order: [["name", "ASC"]],
    });

    res.json(
      vocalists.map((vocalist) => ({
        id: vocalist.id,
        name: vocalist.name,
      }))
    );
  } catch (error) {
    logger.logError("Vocalist search error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /songs/api/song/:id - Get song details
router.get("/api/song/:id", async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id, {
      include: ["Artists", "Vocalist"],
    });

    if (!song) {
      return res.status(404).json({ error: "Song not found" });
    }

    res.json(song);
  } catch (error) {
    logger.logError("Get song error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /songs - Show all songs
router.get("/", async (req, res) => {
  try {
    const songs = await Song.findAll({
      include: ["Artists", "Vocalist", "Links", "GigDocuments"],
      order: [["title", "ASC"]],
    });

    const artists = await Artist.findAll({
      order: [["name", "ASC"]],
    });

    const vocalists = await Vocalist.findAll({
      order: [["name", "ASC"]],
    });

    res.render("songs/index", {
      title: "Songs",
      songs,
      artists,
      vocalists,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    logger.logError("Songs index error", error);
    req.flash("error", "Error loading songs");
    res.redirect("/");
  }
});

// GET /songs/new - Show new song form
router.get("/new", requireAuth, async (req, res) => {
  try {
    const artists = await Artist.findAll({
      order: [["name", "ASC"]],
    });

    const vocalists = await Vocalist.findAll({
      order: [["name", "ASC"]],
    });

    res.render("songs/new", {
      title: "Add New Song",
      artists,
      vocalists,
    });
  } catch (error) {
    logger.logError("New song form error", error);
    req.flash("error", "Error loading form");
    res.redirect("/songs");
  }
});

// POST /songs - Create new song
router.post(
  "/",
  requireAuth,
  [
    body("title").notEmpty().withMessage("Song title is required"),
    body("artist").optional().trim(),
    body("vocalist").optional().trim(),
    body("key").optional(),
    body("minutes").optional(),
    body("seconds").optional(),
    body("bpm")
      .optional()
      .custom((value) => {
        // Allow completely empty values
        if (!value || value === "" || value === null || value === undefined) {
          return true;
        }
        // If a value is provided, validate it
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 40 || numValue > 300) {
          throw new Error("BPM must be between 40 and 300");
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      const {
        title,
        artist,
        vocalist,
        key,
        minutes = 0,
        seconds = 0,
        bpm,
      } = req.body;

      // Check for duplicate song (case-insensitive)
      const { Sequelize } = require("sequelize");
      const existingSong = await Song.findOne({
        where: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("title")),
          Sequelize.fn("LOWER", title.trim())
        ),
        include: ["Artists"],
      });

      const duplicateWarning = existingSong
        ? `A song with the title "${title}" already exists${existingSong.Artists && existingSong.Artists.length > 0 ? ` by ${existingSong.Artists[0].name}` : ""} (found: "${existingSong.title}").`
        : null;

      if (!errors.isEmpty() || duplicateWarning) {
        const artists = await Artist.findAll({
          order: [["name", "ASC"]],
        });

        const vocalists = await Vocalist.findAll({
          order: [["name", "ASC"]],
        });

        return res.render("songs/new", {
          title: "Add New Song",
          errors: errors.array(),
          duplicateWarning,
          artists,
          vocalists,
          formData: req.body,
        });
      }

      // Calculate total time in seconds
      const totalTime =
        (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

      // Handle vocalist
      let vocalistId = null;
      if (vocalist && vocalist.trim()) {
        const [vocalistRecord] = await Vocalist.findOrCreate({
          where: { name: vocalist.trim() },
          defaults: { name: vocalist.trim() },
        });
        vocalistId = vocalistRecord.id;
      }

      // Handle artist
      if (artist && artist.trim()) {
        const [artistRecord] = await Artist.findOrCreate({
          where: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("name")),
            Sequelize.fn("LOWER", artist.trim())
          ),
          defaults: { name: artist.trim() },
        });
        await song.addArtist(artistRecord);
      }

      req.flash("success", "Song added successfully");
      res.redirect(`/songs/${song.id}`);
    } catch (error) {
      logger.logError("Create song error", error);
      req.flash("error", "Error creating song");
      res.redirect("/songs/new");
    }
  }
);

// GET /songs/:id - Show specific song
router.get("/:id", async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id, {
      include: ["Artists", "Vocalist", "Links", "GigDocuments"],
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    // Helper functions for link display
    const getLinkIcon = (type) => {
      const icons = {
        youtube: "youtube",
        video: "camera-video",
        spotify: "spotify",
        "apple-music": "music-note",
        soundcloud: "cloud",
        bandcamp: "music-note-beamed",
        lyrics: "file-text",
        tab: "music-note",
        "bass tab": "music-note-beamed",
        chords: "music-note-list",
        "guitar tutorial": "play-circle",
        "bass tutorial": "play-circle-fill",
        "keyboard tutorial": "play-btn",
        audio: "headphones",
        "sheet-music": "file-earmark-music",
        "backing-track": "music-player",
        karaoke: "mic",
        "horn chart": "file-earmark-music",
        other: "link-45deg",
      };
      return icons[type] || "link-45deg";
    };

    const getLinkDisplayText = (link) => {
      const typeLabels = {
        youtube: "YouTube",
        video: "Video",
        spotify: "Spotify",
        "apple-music": "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        "backing-track": "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        other: "Other",
      };

      const typeLabel = typeLabels[link.type] || "Link";
      return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
    };

    // Helper functions for gig document type display
    const getTypeIcon = (type) => {
      const icons = {
        chords: "music-note-list",
        "bass-tab": "music-note-beamed",
        "guitar-tab": "music-note",
        lyrics: "file-text",
      };
      return icons[type] || "file-earmark-text";
    };

    const getTypeDisplayName = (type) => {
      const names = {
        chords: "Chords",
        "bass-tab": "Bass Tab",
        "guitar-tab": "Guitar Tab",
        lyrics: "Lyrics",
      };
      return names[type] || type;
    };

    res.render("songs/show", {
      title: song.title,
      song,
      loggedIn: !!req.session.user,
      getLinkIcon,
      getLinkDisplayText,
      getTypeIcon,
      getTypeDisplayName,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    logger.logError("Song show error", error);
    req.flash("error", "Error loading song");
    res.redirect("/songs");
  }
});

// GET /songs/:id/edit - Show edit song form
router.get("/:id/edit", requireAuth, async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id, {
      include: ["Artists", "Vocalist"],
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    const artists = await Artist.findAll({
      order: [["name", "ASC"]],
    });

    const vocalists = await Vocalist.findAll({
      order: [["name", "ASC"]],
    });

    res.render("songs/edit", {
      title: `Edit ${song.title}`,
      song,
      artists,
      vocalists,
    });
  } catch (error) {
    logger.logError("Edit song form error", error);
    req.redirect("/songs");
  }
});

// POST /songs/:id/update - Update song (alternative to PUT)
router.post(
  "/:id/update",
  requireAuth,

  [
    body("title").notEmpty().withMessage("Song title is required"),
    body("artist").optional().trim(),
    body("vocalist").optional().trim(),
    body("key").optional(),
    body("minutes").optional(),
    body("seconds").optional(),
    body("bpm")
      .optional()
      .custom((value) => {
        // Allow completely empty values
        if (!value || value === "" || value === null || value === undefined) {
          return true;
        }
        // If a value is provided, validate it
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 40 || numValue > 300) {
          throw new Error("BPM must be between 40 and 300");
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const song = await Song.findByPk(req.params.id, {
          include: ["Artists", "Vocalist"],
        });

        const artists = await Artist.findAll({
          order: [["name", "ASC"]],
        });

        const vocalists = await Vocalist.findAll({
          order: [["name", "ASC"]],
        });

        return res.render("songs/edit", {
          title: `Edit ${song.title}`,
          song,
          artists,
          vocalists,
          errors: errors.array(),
          formData: req.body,
        });
      }

      const song = await Song.findByPk(req.params.id);
      if (!song) {
        req.flash("error", "Song not found");
        return res.redirect("/songs");
      }

      const {
        title,
        artist,
        vocalist,
        key,
        minutes = 0,
        seconds = 0,
        bpm,
      } = req.body;

      // Calculate total time in seconds
      const totalTime =
        (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

      // Convert BPM to proper value
      let bpmValue = null;
      if (bpm && typeof bpm === "string" && bpm.trim() !== "") {
        bpmValue = parseInt(bpm.trim());
      } else if (bpm && typeof bpm === "number") {
        bpmValue = bpm;
      }

      // Handle vocalist
      let vocalistId = null;
      if (vocalist && vocalist.trim()) {
        const [vocalistRecord] = await Vocalist.findOrCreate({
          where: { name: vocalist.trim() },
          defaults: { name: vocalist.trim() },
        });
        vocalistId = vocalistRecord.id;
      }

      // Handle artist - only allow adding if currently blank
      const currentArtist = await song.getArtists();
      if (
        artist &&
        artist.trim() &&
        (!currentArtist || currentArtist.length === 0)
      ) {
        const [artistRecord] = await Artist.findOrCreate({
          where: { name: artist.trim() },
          defaults: { name: artist.trim() },
        });
        await song.addArtist(artistRecord);
      }

      // Update song (excluding title which is read-only)
      await song.update({
        key: key || null,
        time: totalTime || null,
        bpm: bpmValue,
        vocalistId,
      });

      // Note: Title is read-only and cannot be changed
      // Artist can only be added if currently blank

      req.flash("success", "Song updated successfully");
      res.redirect(`/songs/${song.id}`);
    } catch (error) {
      logger.logError("Update song error", error);
      req.flash("error", "Error updating song");
      res.redirect(`/songs/${req.params.id}/edit`);
    }
  }
);

// PUT /songs/:id - Update song

// DELETE /songs/:id - Delete song
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id);
    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    await song.destroy();
    req.flash("success", "Song deleted successfully");
    res.redirect("/songs");
  } catch (error) {
    logger.logError("Delete song error", error);
    req.flash("error", "Error deleting song");
    res.redirect("/songs");
  }
});

// Debug route to catch all unmatched requests - REMOVED to fix route conflicts

module.exports = router;
