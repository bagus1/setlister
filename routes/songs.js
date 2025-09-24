const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// API Routes (must come before /:id routes)

// GET /songs/api/artists/search - Search artists for autofill
router.get("/api/artists/search", async (req, res) => {
  try {
    const { q } = req.query;
    const artists = await prisma.artist.findMany({
      where: {
        name: {
          contains: q,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { name: "asc" },
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
    const vocalists = await prisma.vocalist.findMany({
      where: {
        name: {
          contains: q,
          mode: "insensitive",
        },
      },
      take: 10,
      orderBy: { name: "asc" },
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
    const song = await prisma.song.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
      },
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
    // Build where clause to filter private songs
    const whereClause = {
      OR: [
        { private: false }, // Show all public songs
        { private: true, createdById: req.session.user?.id }, // Show private songs only if user owns them
      ],
    };

    // If no user is logged in, only show public songs
    if (!req.session.user) {
      whereClause.OR = [{ private: false }];
    }

    const songs = await prisma.song.findMany({
      where: whereClause,
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
        links: true,
        gigDocuments: true,
        creator: true, // Include creator info for display
      },
      orderBy: { title: "asc" },
    });

    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: { name: "asc" },
    });

    res.render("songs/index", {
      title: "Songs",
      pageTitle: "Songs",
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
    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: { name: "asc" },
    });

    res.render("songs/new", {
      pageTitle: "Add a Song",
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
        private: isPrivate,
      } = req.body;

      // Get artist ID first (needed for proper duplicate detection)
      let artistId = null;
      if (artist && artist.trim()) {
        const artistRecord = await prisma.artist.findFirst({
          where: { name: artist.trim() },
        });
        if (artistRecord) {
          artistId = artistRecord.id;
        }
      }

      // Check for duplicate song with proper artist logic (case-insensitive)
      let existingSong = null;

      if (artistId) {
        // If artist is provided, check for same title AND same artist (both case-insensitive)
        existingSong = await prisma.song.findFirst({
          where: {
            title: {
              equals: title.trim(),
              mode: "insensitive",
            },
            artists: {
              some: {
                artistId: artistId,
              },
            },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: req.session.user.id }, // Only check same user's private songs
            ],
          },
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
          },
        });
      } else {
        // If no artist provided, check for same title with NO artists (case-insensitive)
        existingSong = await prisma.song.findFirst({
          where: {
            title: {
              equals: title.trim(),
              mode: "insensitive",
            },
            artists: {
              none: {},
            },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: req.session.user.id }, // Only check same user's private songs
            ],
          },
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
          },
        });
      }

      const duplicateWarning = existingSong
        ? `A song with the title "${title}" already exists${existingSong.artists && existingSong.artists.length > 0 ? ` by ${existingSong.artists[0].artist.name}` : ""} (found: "${existingSong.title}").`
        : null;

      if (!errors.isEmpty() || duplicateWarning) {
        const artists = await prisma.artist.findMany({
          orderBy: { name: "asc" },
        });

        const vocalists = await prisma.vocalist.findMany({
          orderBy: { name: "asc" },
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

      // Convert BPM to integer
      const bpmInt = bpm && bpm.trim() ? parseInt(bpm) : null;

      // Convert display key to enum value
      let enumKey = null;
      if (key && key.trim()) {
        const keyMap = {
          "C#": "C_",
          Db: "Db",
          D: "D",
          "D#": "D_",
          Eb: "Eb",
          E: "E",
          F: "F",
          "F#": "F_",
          Gb: "Gb",
          G: "G",
          "G#": "G_",
          Ab: "Ab",
          A: "A",
          "A#": "A_",
          Bb: "Bb",
          B: "B",
          Cm: "Cm",
          "C#m": "C_m",
          Dbm: "Dbm",
          Dm: "Dm",
          "D#m": "D_m",
          Ebm: "Ebm",
          Em: "Em",
          Fm: "Fm",
          "F#m": "F_m",
          Gbm: "Gbm",
          Gm: "Gm",
          "G#m": "G_m",
          Abm: "Abm",
          Am: "Am",
          "A#m": "A_m",
          Bbm: "Bbm",
          Bm: "Bm",
        };
        enumKey = keyMap[key.trim()] || null;
      }

      // Handle vocalist
      let vocalistId = null;
      if (vocalist && vocalist.trim()) {
        let vocalistRecord = await prisma.vocalist.findFirst({
          where: { name: vocalist.trim() },
        });

        if (!vocalistRecord) {
          vocalistRecord = await prisma.vocalist.create({
            data: {
              name: vocalist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        vocalistId = vocalistRecord.id;
      }

      // Create the song
      console.log("Creating song with data:", {
        title: title.trim(),
        key: enumKey,
        time: totalTime,
        bpm: bpmInt,
        vocalistId: vocalistId,
        createdById: req.session.user.id,
        private: isPrivate === "true",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const song = await prisma.song.create({
        data: {
          title: title.trim(),
          key: enumKey,
          time: totalTime,
          bpm: bpmInt,
          vocalistId: vocalistId,
          createdById: req.session.user.id,
          private: isPrivate === "true",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log("Song created successfully:", song);

      // Handle artist (create if needed, use existing artistId if found)
      if (artist && artist.trim()) {
        let finalArtistId = artistId; // Use the one we found earlier

        // If artist doesn't exist yet, create it
        if (!finalArtistId) {
          const artistRecord = await prisma.artist.create({
            data: {
              name: artist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          finalArtistId = artistRecord.id;
        }

        // Create the song-artist relationship
        await prisma.songArtist.create({
          data: {
            songId: song.id,
            artistId: finalArtistId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
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

// GET /songs/:songId/links/:linkId - Show link viewer (audio player, etc.)
router.get("/:songId/links/:linkId", async (req, res) => {
  try {
    const { songId, linkId } = req.params;
    
    // Get the song and link details
    const song = await prisma.song.findUnique({
      where: { id: parseInt(songId) },
      include: {
        artists: {
          include: {
            artist: true
          }
        },
        vocalist: true,
        links: {
          where: { id: parseInt(linkId) }
        }
      }
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    if (!song.links || song.links.length === 0) {
      req.flash("error", "Link not found");
      return res.redirect(`/songs/${songId}`);
    }

    const link = song.links[0];
    
    // Helper function for link display text
    const getLinkDisplayText = (link) => {
      const typeLabels = {
        youtube: "YouTube",
        video: "Video",
        spotify: "Spotify",
        "apple-music": "Apple Music",
        "apple_music": "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        "bass_tab": "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        "guitar_tutorial": "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        "bass_tutorial": "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        "keyboard_tutorial": "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        "sheet_music": "Sheet Music",
        "backing-track": "Backing Track",
        "backing_track": "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        "horn_chart": "Horn Chart",
        other: "Other",
      };

      const typeLabel = typeLabels[link.type] || "Link";
      return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
    };
    
    // For now, only handle audio links
    if (link.type !== 'audio') {
      req.flash("error", "Link viewer not available for this type");
      return res.redirect(`/songs/${songId}`);
    }

    const artistName = song.artists && song.artists.length > 0 ? song.artists[0].artist.name : 'Unknown Artist';
    const linkDisplayText = getLinkDisplayText(link);
    
    res.render("songs/link-viewer", {
      title: song.title,
      pageTitle: `${song.title} | Setlist Manager`,
      marqueeTitle: song.title,
      song,
      link,
      getLinkDisplayText
    });
  } catch (error) {
    logger.logError("Song link viewer error:", error);
    req.flash("error", "An error occurred loading the link viewer");
    res.redirect("/songs");
  }
});

// GET /songs/:id - Show specific song
router.get("/:id", async (req, res) => {
  try {
    const song = await prisma.song.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
        links: true,
        gigDocuments: {
          include: {
            creator: true,
          },
        },
      },
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
        "apple_music": "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        "bass_tab": "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        "guitar_tutorial": "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        "bass_tutorial": "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        "keyboard_tutorial": "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        "sheet_music": "Sheet Music",
        "backing-track": "Backing Track",
        "backing_track": "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        "horn_chart": "Horn Chart",
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

    let pageTitle = song.title;
    if (song.artists && song.artists.length > 0) {
      pageTitle = `${song.title} by ${song.artists[0].artist.name}`;
    }

    if (req.params.id === "444") {
      pageTitle = "Songs";
    }

    res.render("songs/show", {
      title: song.title,
      pageTitle,
      song,
      loggedIn: !!req.session.user,
      currentUser: req.session.user,
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
    const song = await prisma.song.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
      },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    // Get current user's permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: req.session.user.id },
      select: { id: true, canMakePrivate: true },
    });

    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: { name: "asc" },
    });

    res.render("songs/edit", {
      title: `Edit ${song.title}`,
      pageTitle: "Edit Song",
      song,
      artists,
      vocalists,
      currentUser,
    });
  } catch (error) {
    logger.logError("Edit song form error", error);
    res.redirect("/songs");
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
        const song = await prisma.song.findUnique({
          where: { id: parseInt(req.params.id) },
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
            vocalist: true,
          },
        });

        // Get current user's permissions
        const currentUser = await prisma.user.findUnique({
          where: { id: req.session.user.id },
          select: { canMakePrivate: true },
        });

        const artists = await prisma.artist.findMany({
          orderBy: { name: "asc" },
        });

        const vocalists = await prisma.vocalist.findMany({
          orderBy: { name: "asc" },
        });

        return res.render("songs/edit", {
          title: `Edit ${song.title}`,
          pageTitle: "Edit Song",
          song,
          artists,
          vocalists,
          currentUser,
          errors: errors.array(),
          formData: req.body,
        });
      }

      const song = await prisma.song.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          artists: { include: { artist: true } },
          vocalist: true,
        },
      });
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
        makePublic,
      } = req.body;

      // Calculate total time in seconds
      const totalTime =
        (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

      // Convert display key to enum value
      let enumKey = null;
      if (key && key.trim()) {
        const keyMap = {
          "C#": "C_",
          Db: "Db",
          D: "D",
          "D#": "D_",
          Eb: "Eb",
          E: "E",
          F: "F",
          "F#": "F_",
          Gb: "Gb",
          G: "G",
          "G#": "G_",
          Ab: "Ab",
          A: "A",
          "A#": "A_",
          Bb: "Bb",
          B: "B",
          Cm: "Cm",
          "C#m": "C_m",
          Dbm: "Dbm",
          Dm: "Dm",
          "D#m": "D_m",
          Ebm: "Ebm",
          Em: "Em",
          Fm: "Fm",
          "F#m": "F_m",
          Gbm: "Gbm",
          Gm: "Gm",
          "G#m": "G_m",
          Abm: "Abm",
          Am: "Am",
          "A#m": "A_m",
          Bbm: "Bbm",
          Bm: "Bm",
        };
        enumKey = keyMap[key.trim()] || null;
      }

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
        let vocalistRecord = await prisma.vocalist.findFirst({
          where: { name: vocalist.trim() },
        });

        if (!vocalistRecord) {
          vocalistRecord = await prisma.vocalist.create({
            data: {
              name: vocalist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        vocalistId = vocalistRecord.id;
      }

      // Handle artist - only allow adding if currently blank
      const currentArtists = await prisma.songArtist.findMany({
        where: { songId: song.id },
        include: { artist: true },
      });

      if (
        artist &&
        artist.trim() &&
        (!currentArtists || currentArtists.length === 0)
      ) {
        let artistRecord = await prisma.artist.findFirst({
          where: { name: artist.trim() },
        });

        if (!artistRecord) {
          artistRecord = await prisma.artist.create({
            data: {
              name: artist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        await prisma.songArtist.create({
          data: {
            songId: song.id,
            artistId: artistRecord.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Prepare update data
      const updateData = {
        key: enumKey,
        time: totalTime || null,
        bpm: bpmValue,
        vocalistId,
        updatedAt: new Date(),
      };

      // If makePublic is checked and song is currently private, handle merge logic
      if (makePublic === "true" && song.private) {
        // Check if there's a conflict with an existing public song
        const existingPublicSong = await prisma.song.findFirst({
          where: {
            title: { equals: song.title, mode: "insensitive" },
            private: false,
            id: { not: song.id }, // Exclude current song
            artists: {
              some: {
                artist: {
                  name: {
                    equals: song.artists[0]?.artist?.name || "",
                    mode: "insensitive",
                  },
                },
              },
            },
          },
          include: {
            artists: { include: { artist: true } },
            vocalist: true,
            links: true,
            gigDocuments: true,
          },
        });

        if (existingPublicSong) {
          // CONFLICT: Merge private song into existing public song
          console.log(
            `Merging private song ${song.id} into public song ${existingPublicSong.id}`
          );

          // Smart merge: public data takes precedence, private fills gaps
          const mergedData = {
            // Keep public song's data, but fill gaps with private data
            key: existingPublicSong.key || enumKey,
            time: existingPublicSong.time || totalTime || null,
            bpm: existingPublicSong.bpm || bpmValue,
            vocalistId: existingPublicSong.vocalistId || vocalistId,
            updatedAt: new Date(),
          };

          // Update the existing public song with merged data
          await prisma.song.update({
            where: { id: existingPublicSong.id },
            data: mergedData,
          });

          // Update all references from private song to public song
          await updateSongReferences(song.id, existingPublicSong.id);

          // Delete the private song
          await prisma.song.delete({
            where: { id: song.id },
          });

          req.flash(
            "success",
            `Song merged with existing public song "${existingPublicSong.title}"`
          );
          return res.redirect(`/songs/${existingPublicSong.id}`);
        } else {
          // NO CONFLICT: Simply make the private song public
          updateData.private = false;
        }
      }

      // Update song (excluding title which is read-only)
      await prisma.song.update({
        where: { id: song.id },
        data: updateData,
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
    const song = await prisma.song.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    await prisma.song.delete({
      where: { id: parseInt(req.params.id) },
    });
    req.flash("success", "Song deleted successfully");
    res.redirect("/songs");
  } catch (error) {
    logger.logError("Delete song error", error);
    req.flash("error", "Error deleting song");
    res.redirect("/songs");
  }
});

// Function to update all references when merging private song into public song
async function updateSongReferences(privateSongId, publicSongId) {
  try {
    // Update setlist_songs references
    await prisma.setlistSong.updateMany({
      where: { songId: privateSongId },
      data: { songId: publicSongId },
    });

    // Update band_songs references
    await prisma.bandSong.updateMany({
      where: { songId: privateSongId },
      data: { songId: publicSongId },
    });

    // Update medley_songs references
    await prisma.medleySong.updateMany({
      where: { songId: privateSongId },
      data: { songId: publicSongId },
    });

    // Update links references
    await prisma.link.updateMany({
      where: { songId: privateSongId },
      data: { songId: publicSongId },
    });

    // Update gig_documents references
    await prisma.gigDocument.updateMany({
      where: { songId: privateSongId },
      data: { songId: publicSongId },
    });

    // Delete song_artists references for private song (since public song already has them)
    await prisma.songArtist.deleteMany({
      where: { songId: privateSongId },
    });

    console.log(
      `Updated all references from private song ${privateSongId} to public song ${publicSongId}`
    );
  } catch (error) {
    console.error("Error updating song references:", error);
    throw error;
  }
}

// Debug route to catch all unmatched requests - REMOVED to fix route conflicts

module.exports = router;
