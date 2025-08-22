const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  Setlist,
  SetlistSet,
  SetlistSong,
  Band,
  BandMember,
  Song,
  BandSong,
  Artist,
  Vocalist,
  User,
  GigDocument,
  Link,
} = require("../models");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// Public gig view route (no authentication required)
router.get("/:id/gig-view", async (req, res) => {
  try {
    const setlistId = req.params.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          attributes: ["id", "name"],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Get BandSong preferences for this band
    const bandSongs = await BandSong.findAll({
      where: { bandId: setlist.Band.id },
      raw: false,
    });

    // Create a map of songId to preferred gig document
    const preferredGigDocuments = {};
    bandSongs.forEach((bandSong) => {
      if (bandSong.gigDocumentId) {
        preferredGigDocuments[bandSong.songId] = bandSong.gigDocumentId;
      }
    });

    // Get all preferred gig documents
    const gigDocumentIds = Object.values(preferredGigDocuments);

    const gigDocuments = await GigDocument.findAll({
      where: { id: gigDocumentIds },
      include: [
        {
          model: Song,
          attributes: ["id", "title", "key", "time"],
        },
      ],
    });

    // Create a map of gig document ID to gig document
    const gigDocumentMap = {};
    gigDocuments.forEach((doc) => {
      gigDocumentMap[doc.id] = doc;
    });

    res.render("setlists/gig-view", {
      title: `Gig View - ${setlist.title}`,
      setlist,
      preferredGigDocuments,
      gigDocumentMap,
      layout: false, // No layout for clean printing
    });
  } catch (error) {
    logger.logError("Gig view error", error);
    res.status(500).send("Error loading gig view");
  }
});

// Public YouTube playlist route (no authentication required)
router.get("/:id/youtube-playlist", async (req, res) => {
  try {
    const setlistId = req.params.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          attributes: ["id", "name"],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: [
                    "Artists",
                    "Vocalist",
                    {
                      model: Link,
                      where: { type: "youtube" },
                      required: false,
                    },
                  ],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Collect all YouTube links from the setlist
    const youtubeLinks = [];
    setlist.SetlistSets.forEach((set) => {
      if (set.SetlistSongs && set.name !== "Maybe") {
        set.SetlistSongs.forEach((setlistSong) => {
          if (
            setlistSong.Song &&
            setlistSong.Song.Links &&
            setlistSong.Song.Links.length > 0
          ) {
            setlistSong.Song.Links.forEach((link) => {
              if (link.type === "youtube") {
                youtubeLinks.push({
                  songTitle: setlistSong.Song.title,
                  artist:
                    setlistSong.Song.Artists &&
                    setlistSong.Song.Artists.length > 0
                      ? setlistSong.Song.Artists[0].name
                      : null,
                  set: set.name,
                  order: setlistSong.order,
                  url: link.url,
                  videoId: extractYouTubeVideoId(link.url),
                });
              }
            });
          }
        });
      }
    });

    res.render("setlists/youtube-playlist", {
      title: `YouTube Playlist - ${setlist.title}`,
      setlist,
      youtubeLinks,
      layout: false, // No layout for clean printing
    });
  } catch (error) {
    logger.logError("YouTube playlist error", error);
    res.status(500).send("Error loading YouTube playlist");
  }
});

// Helper function to extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Public rehearsal view route (no authentication required)
router.get("/:id/rehearsal", async (req, res) => {
  try {
    const setlistId = req.params.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          attributes: ["id", "name"],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist", "Links", "GigDocuments"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
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

    res.render("setlists/rehearsal", {
      title: `Rehearsal View - ${setlist.title}`,
      setlist,
      getLinkIcon,
      getLinkDisplayText,
      layout: false, // No layout for clean printing
    });
  } catch (error) {
    logger.logError("Rehearsal view error", error);
    res.status(500).send("Error loading rehearsal view");
  }
});

// Public listen route (no authentication required)
router.get("/:id/listen", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          attributes: ["id", "name"],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Fetch the external playlist
    let playlistData;
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        playlistData = await response.json();
      } else {
        // Handle HTML content - try to extract audio links
        const html = await response.text();
        const audioLinks = [];

        // Create a base URL for resolving relative paths
        const baseUrl = new URL(url);

        // Debug: Log a sample of the HTML to see the actual format
        console.log("HTML sample:", html.substring(0, 1000));

        // Extract total summary information
        let totalSummary = "";
        const summaryMatch = html.match(
          /Total Length: ([^(]+) \((\d+) songs\)/
        );
        if (summaryMatch) {
          totalSummary = {
            duration: summaryMatch[1].trim(),
            songCount: parseInt(summaryMatch[2]),
          };
        }

        // Site-specific scraping logic
        let linkRegex;
        let match;

        // Determine the site and use appropriate scraping logic
        const hostname = baseUrl.hostname.toLowerCase();
        console.log("Detected hostname:", hostname);

        switch (hostname) {
          case "www.bagus.org":
          case "bagus.org":
            // Bagus.org format: href="/path/file.wav">Song Title</a><span class="duration">(duration)
            linkRegex =
              /href=["']([^"']+\.(?:mp3|wav|ogg|m4a|flac))["'][^>]*>([^<]+)<\/a><span class="duration">\(([^)]+)\)/gi;
            console.log("Using bagus.org scraping pattern");
            break;

          case "www.example.com":
          case "example.com":
            // Example site format (placeholder for future)
            linkRegex = /placeholder-regex-for-example-site/gi;
            console.log("Using example.com scraping pattern");
            break;

          default:
            // Default/fallback pattern for unknown sites
            linkRegex =
              /href=["']([^"']+\.(?:mp3|wav|ogg|m4a|flac))["'][^>]*>([^<]+)<\/a>/gi;
            console.log(
              "Using default scraping pattern for unknown site:",
              hostname
            );
            break;
        }

        while ((match = linkRegex.exec(html)) !== null) {
          let audioUrl, title, duration;

          if (hostname.includes("bagus.org")) {
            // Bagus.org specific parsing
            audioUrl = match[1];
            title = match[2].trim();
            duration = match[3].trim();
          } else if (hostname.includes("example.com")) {
            // Example site specific parsing (placeholder)
            audioUrl = match[1];
            title = match[2].trim();
            duration = null; // No duration info for this site
          } else {
            // Default parsing for unknown sites
            audioUrl = match[1];
            title = match[2].trim();
            duration = null; // No duration info for unknown sites
          }

          console.log("Found track:", { title, audioUrl, duration });

          // Convert relative URLs to absolute URLs
          let fullUrl = audioUrl;
          if (audioUrl.startsWith("/")) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${audioUrl}`;
          } else if (audioUrl.startsWith("./")) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.replace(/\/[^\/]*$/, "")}${audioUrl.substring(1)}`;
          } else if (!audioUrl.startsWith("http")) {
            fullUrl = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.replace(/\/[^\/]*$/, "")}/${audioUrl}`;
          }

          audioLinks.push({
            url: fullUrl,
            title: title,
            duration: duration,
          });
        }

        console.log("Audio links found:", audioLinks.length);
        console.log("First few links:", audioLinks.slice(0, 3));

        playlistData = {
          tracks: audioLinks,
          summary: totalSummary,
        };
      }
    } catch (fetchError) {
      logger.logError("Failed to fetch external playlist", fetchError);
      return res
        .status(500)
        .send("Failed to fetch or parse the external recordings playlist");
    }

    res.render("setlists/listen", {
      title: `Listen to Set - ${setlist.title}`,
      setlist,
      playlistData,
      externalUrl: url,
      layout: "layout",
    });
  } catch (error) {
    logger.logError("Listen route error", error);
    res.status(500).send("Error loading listen view");
  }
});

// Public playlist view route (no authentication required)
router.get("/:id/playlist", async (req, res) => {
  try {
    const setlistId = req.params.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          attributes: ["id", "name"],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: [
                    "Artists",
                    "Vocalist",
                    {
                      model: require("../models").Link,
                      where: { type: "audio" },
                      required: false,
                    },
                  ],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Collect all songs with audio links
    const audioSongs = [];
    setlist.SetlistSets.forEach((set) => {
      if (set.SetlistSongs) {
        set.SetlistSongs.forEach((setlistSong) => {
          if (setlistSong.Song.Links && setlistSong.Song.Links.length > 0) {
            audioSongs.push({
              song: setlistSong.Song,
              set: set.name,
              order: setlistSong.order,
            });
          }
        });
      }
    });

    res.render("setlists/playlist", {
      title: `Playlist - ${setlist.title}`,
      setlist,
      audioSongs,
      user: req.session.user,
      currentUrl: req.originalUrl,
      layout: "layout",
    });
  } catch (error) {
    logger.logError("Playlist view error", error);
    res.status(500).send("Error loading playlist view");
  }
});

// All other setlist routes require authentication
router.use(requireAuth);

// Helper function to check if setlist is still editable (always editable)
function isSetlistEditable(setlist) {
  return true; // Setlists are always editable
}

// GET /setlists/:id - Show setlist details
router.get("/:id", async (req, res) => {
  try {
    const setlistId = req.params.id;

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to view setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [{ model: Song, include: ["Artists", "Vocalist"] }],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found or access denied");
      return res.redirect("/bands");
    }

    res.render("setlists/show", {
      title: setlist.title,
      setlist,
    });
  } catch (error) {
    logger.logError("Show setlist error", error);
    req.flash("error", "An error occurred loading the setlist");
    res.redirect("/bands");
  }
});

// GET /setlists/:id/edit - Show setlist edit page with drag-drop
router.get("/:id/edit", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist", "Links", "GigDocuments"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Check if setlist date is in the past and show warning
    if (setlist.date && new Date(setlist.date) < new Date()) {
      req.flash(
        "warning",
        "The date for this setlist is in the past, are you sure you want to mess with history?"
      );
    }

    // Check if setlist date has passed (allow editing until one week after setlist date)
    if (!isSetlistEditable(setlist)) {
      req.flash(
        "error",
        "This setlist cannot be edited as it has been more than one week since the performance date"
      );
      return res.redirect(`/setlists/${setlist.id}/finalize`);
    }

    // Get all band's songs
    const allBandSongs = await Song.findAll({
      include: [
        "Artists",
        "Vocalist",
        "Links",
        "GigDocuments",
        {
          model: Band,
          where: { id: setlist.bandId },
          through: { attributes: [] },
        },
      ],
      order: [["title", "ASC"]],
    });

    // Get songs already in this setlist through SetlistSets
    const setlistSets = await SetlistSet.findAll({
      where: { setlistId: setlist.id },
      include: [
        {
          model: SetlistSong,
          attributes: ["songId"],
        },
      ],
    });

    // Extract used song IDs (from all sets including Maybe)
    const usedSongIds = [];
    setlistSets.forEach((set) => {
      if (set.SetlistSongs) {
        set.SetlistSongs.forEach((setlistSong) => {
          usedSongIds.push(setlistSong.songId);
        });
      }
    });

    // Filter out songs already in any set (including Maybe)
    const bandSongs = allBandSongs.filter(
      (song) => !usedSongIds.includes(song.id)
    );

    res.render("setlists/edit", {
      title: `Edit ${setlist.title}`,
      setlist,
      bandSongs,
      success: req.flash("success"),
      error: req.flash("error"),
      warning: req.flash("warning"),
    });
  } catch (error) {
    console.error("Edit setlist error:", error);
    req.flash("error", "An error occurred loading the setlist editor");
    res.redirect("/bands");
  }
});

// GET /setlists/:id/copy - Show copy setlist form
router.get("/:id/copy", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [{ model: Song, include: ["Artists", "Vocalist"] }],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found or access denied");
      return res.redirect("/bands");
    }

    res.render("setlists/copy", {
      title: `Copy ${setlist.title}`,
      setlist,
    });
  } catch (error) {
    console.error("Copy setlist error:", error);
    req.flash("error", "An error occurred loading the setlist copy form");
    res.redirect("/bands");
  }
});

// POST /setlists/:id/copy - Create a copy of the setlist
router.post(
  "/:id/copy",
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Setlist title is required"),
    body("date")
      .optional()
      .custom((value) => {
        if (value === "" || value === null || value === undefined) {
          return true; // Allow empty/null values
        }
        // If a value is provided, validate it's a proper date
        const date = new Date(value);
        return !isNaN(date.getTime());
      })
      .withMessage("Invalid date format"),
  ],
  async (req, res) => {
    try {
      const setlistId = req.params.id;
      const userId = req.session.user.id;
      const { title, date } = req.body;

      // Verify user has access to original setlist
      const originalSetlist = await Setlist.findByPk(setlistId, {
        include: [
          {
            model: Band,
            include: [
              {
                model: User,
                where: { id: userId },
                through: { attributes: [] },
              },
            ],
          },
          {
            model: SetlistSet,
            include: [
              {
                model: SetlistSong,
                include: [{ model: Song }],
                order: [["order", "ASC"]],
              },
            ],
            order: [["order", "ASC"]],
          },
        ],
      });

      if (!originalSetlist) {
        req.flash("error", "Setlist not found or access denied");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/setlists/${setlistId}/copy`);
      }

      // Create new setlist
      const newSetlist = await Setlist.create({
        title,
        bandId: originalSetlist.bandId,
        date: date || null,
        isFinalized: false,
      });

      // Copy all sets and their songs
      for (const originalSet of originalSetlist.SetlistSets) {
        // Create new set
        const newSet = await SetlistSet.create({
          setlistId: newSetlist.id,
          name: originalSet.name,
          order: originalSet.order,
        });

        // Copy all songs in this set
        if (originalSet.SetlistSongs && originalSet.SetlistSongs.length > 0) {
          for (let i = 0; i < originalSet.SetlistSongs.length; i++) {
            const originalSetlistSong = originalSet.SetlistSongs[i];
            await SetlistSong.create({
              setlistSetId: newSet.id,
              songId: originalSetlistSong.songId,
              order: originalSetlistSong.order,
            });
          }
        }
      }

      req.flash(
        "success",
        `Setlist "${title}" created successfully from "${originalSetlist.title}"!`
      );
      res.redirect(`/setlists/${newSetlist.id}/edit`);
    } catch (error) {
      console.error("Copy setlist error:", error);
      req.flash("error", "An error occurred copying the setlist");
      res.redirect("/bands");
    }
  }
);

// POST /setlists/:id/save - Save setlist changes
router.post("/:id/save", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;
    const { sets } = req.body;

    // Verify user has access
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    // Check if setlist date has passed (allow editing until one week after setlist date)
    if (!isSetlistEditable(setlist)) {
      return res.status(403).json({
        error:
          "This setlist cannot be edited as it has been more than one week since the performance date",
      });
    }

    // Clear existing setlist songs
    // First get all SetlistSets for this setlist
    const setlistSets = await SetlistSet.findAll({
      where: { setlistId },
      attributes: ["id"],
    });

    if (setlistSets.length > 0) {
      const setlistSetIds = setlistSets.map((set) => set.id);
      await SetlistSong.destroy({
        where: {
          setlistSetId: setlistSetIds,
        },
      });
    }

    // Update sets
    for (const [setName, songs] of Object.entries(sets)) {
      let setlistSet = await SetlistSet.findOne({
        where: { setlistId, name: setName },
      });

      if (!setlistSet && songs.length > 0) {
        // Create set if it doesn't exist and has songs
        const setOrder = ["Set 1", "Set 2", "Set 3", "Set 4", "Maybe"].indexOf(
          setName
        );
        setlistSet = await SetlistSet.create({
          setlistId,
          name: setName,
          order: setOrder,
        });
      }

      if (setlistSet) {
        // Add songs to set
        for (let i = 0; i < songs.length; i++) {
          await SetlistSong.create({
            setlistSetId: setlistSet.id,
            songId: songs[i],
            order: i + 1,
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError("[SAVE] Save setlist error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /setlists/:id/finalize - Show finalize page
router.get("/:id/finalize", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    // Add a small delay to ensure any pending saves are completed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [{ model: Song, include: ["Artists", "Vocalist"] }],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Get BandSong preferences for this band

    const bandSongs = await BandSong.findAll({
      where: { bandId: setlist.Band.id },
      include: [
        {
          model: Song,
          attributes: ["id", "title"],
        },
      ],
      raw: false,
    });

    // Create a map of songId to BandSong for quick lookup
    const bandSongMap = {};
    bandSongs.forEach((bandSong) => {
      bandSongMap[bandSong.songId] = bandSong;
    });

    // Get all gig documents for songs in this setlist
    const songIds = [];
    setlist.SetlistSets.forEach((set) => {
      if (set.SetlistSongs) {
        set.SetlistSongs.forEach((setlistSong) => {
          songIds.push(setlistSong.Song.id);
        });
      }
    });

    const gigDocuments = await GigDocument.findAll({
      where: { songId: songIds },
      include: [
        {
          model: Song,
          attributes: ["id", "title"],
        },
      ],
      order: [["version", "DESC"]],
    });

    // Group gig documents by songId
    const gigDocumentsBySong = {};
    gigDocuments.forEach((doc) => {
      if (!gigDocumentsBySong[doc.songId]) {
        gigDocumentsBySong[doc.songId] = [];
      }
      gigDocumentsBySong[doc.songId].push(doc);
    });

    let autoAssignedCount = 0;

    for (const songId of songIds) {
      const bandSong = bandSongMap[songId];
      const availableDocs = gigDocumentsBySong[songId];

      // Skip if no gig documents available for this song
      if (!availableDocs || availableDocs.length === 0) {
        continue;
      }

      // Skip if BandSong already has a preference set
      if (bandSong && bandSong.gigDocumentId) {
        continue;
      }

      // Auto-assign the highest version (first in the list since we ordered by version DESC)
      const preferredDocId = availableDocs[0].id;

      if (bandSong) {
        // Update existing BandSong record
        await bandSong.update({ gigDocumentId: preferredDocId });
      } else {
        // Create new BandSong record
        await BandSong.create({
          bandId: setlist.Band.id,
          songId: songId,
          gigDocumentId: preferredDocId,
        });
      }

      autoAssignedCount++;

      // Update the bandSongMap to reflect the new assignment
      if (!bandSongMap[songId]) {
        bandSongMap[songId] = {
          songId,
          bandId: setlist.Band.id,
          gigDocumentId: preferredDocId,
        };
      } else {
        bandSongMap[songId].gigDocumentId = preferredDocId;
      }
    }

    // Calculate set times
    const setTimes = {};
    let totalTime = 0;

    setlist.SetlistSets.forEach((set) => {
      if (set.name !== "Maybe") {
        let setTime = 0;

        set.SetlistSongs.forEach((setlistSong) => {
          if (setlistSong.Song.time) {
            setTime += setlistSong.Song.time;
          }
        });
        setTimes[set.name] = setTime;
        totalTime += setTime;
      }
    });

    // Calculate if setlist is still editable (always editable)
    const isEditable = true;

    const renderData = {
      title: `Finalize ${setlist.title}`,
      setlist,
      setTimes,
      totalTime,
      isEditable,
      bandSongMap,
      gigDocumentsBySong,
    };

    res.render("setlists/finalize", renderData);
  } catch (error) {
    console.error("Finalize setlist error:", error);
    req.flash("error", "An error occurred loading the finalize page");
    res.redirect("/bands");
  }
});

// POST /setlists/:id/finalize - Finalize the setlist
router.post("/:id/finalize", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    // Verify user has access
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    await setlist.update({ isFinalized: true });

    req.flash("success", "Setlist finalized successfully!");
    res.redirect(`/setlists/${setlistId}/print`);
  } catch (error) {
    console.error("Finalize setlist error:", error);
    req.flash("error", "An error occurred finalizing the setlist");
    res.redirect(`/setlists/${req.params.id}/finalize`);
  }
});

// POST /setlists/:id/preferred-gig-document - Update preferred gig document for a song
router.post("/:id/preferred-gig-document", async (req, res) => {
  try {
    const { songId, gigDocumentId } = req.body;
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    // Verify user has access to this setlist
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    // Update or create BandSong preference
    await BandSong.upsert({
      bandId: setlist.Band.id,
      songId: songId,
      gigDocumentId: gigDocumentId || null,
    });

    res.json({ success: true, message: "Preferred gig document updated" });
  } catch (error) {
    console.error("Update preferred gig document error:", error);
    res.status(500).json({ error: "Failed to update preferred gig document" });
  }
});

// GET /setlists/:id/print - Show print page with export options
router.get("/:id/print", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [{ model: Song, include: ["Artists", "Vocalist"] }],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    res.render("setlists/print", {
      title: `Print ${setlist.title}`,
      setlist,
    });
  } catch (error) {
    console.error("Print setlist error:", error);
    req.flash("error", "An error occurred loading the print page");
    res.redirect("/bands");
  }
});

// GET /setlists/:id/export - Export setlist as text (direct download)
router.get("/:id/export", async (req, res) => {
  try {
    const setlistId = req.params.id;

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to export setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Generate text export with all details
    let exportText = `${setlist.title}\n`;
    exportText += `Band: ${setlist.Band.name}\n`;
    if (setlist.date) {
      exportText += `Date: ${new Date(setlist.date).toLocaleDateString()}\n`;
    }
    exportText += `\n`;

    setlist.SetlistSets.forEach((set) => {
      if (set.name !== "Maybe" && set.SetlistSongs.length > 0) {
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
            line += ` (${minutes}:${seconds.toString().padStart(2, "0")})`;
          }

          exportText += line + "\n";
        });

        exportText += "\n";
      }
    });

    // Include Maybe list if it has songs
    const maybeSet = setlist.SetlistSets.find((set) => set.name === "Maybe");
    if (maybeSet && maybeSet.SetlistSongs.length > 0) {
      exportText += "Maybe:\n";
      maybeSet.SetlistSongs.forEach((setlistSong, index) => {
        const song = setlistSong.Song;
        let line = `  ${index + 1}. ${song.title}`;
        if (song.Artists && song.Artists.length > 0) {
          line += ` - ${song.Artists[0].name}`;
        }
        exportText += line + "\n";
      });
    }

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${setlist.title}.txt"`
    );
    res.send(exportText);
  } catch (error) {
    console.error("Export setlist error:", error);
    req.flash("error", "Export failed");
    res.redirect("/bands");
  }
});

// POST /setlists/:id/export - Export setlist as text (with options)
router.post("/:id/export", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;
    const { includeArtist, includeVocalist, includeKey, includeTime } =
      req.body;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [{ model: Song, include: ["Artists", "Vocalist"] }],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    // Generate text export
    let exportText = `${setlist.title}\n`;
    if (setlist.date) {
      exportText += `Date: ${new Date(setlist.date).toLocaleDateString()}\n`;
    }
    exportText += `\n`;

    setlist.SetlistSets.forEach((set) => {
      if (set.name !== "Maybe" && set.SetlistSongs.length > 0) {
        exportText += `${set.name}:\n`;

        set.SetlistSongs.forEach((setlistSong) => {
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
            line += ` (${minutes}:${seconds.toString().padStart(2, "0")})`;
          }

          exportText += line + "\n";
        });

        exportText += "\n";
      }
    });

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${setlist.title}.txt"`
    );
    res.send(exportText);
  } catch (error) {
    console.error("Export setlist error:", error);
    res.status(500).json({ error: "Export failed" });
  }
});

// GET /setlists/:id/export-csv - Export setlist as CSV (direct download)
router.get("/:id/export-csv", async (req, res) => {
  try {
    const setlistId = req.params.id;

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to export setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
        {
          model: SetlistSet,
          include: [
            {
              model: SetlistSong,
              include: [
                {
                  model: Song,
                  include: ["Artists", "Vocalist"],
                },
              ],
              order: [["order", "ASC"]],
            },
          ],
          order: [["order", "ASC"]],
        },
      ],
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Helper function to escape CSV values
    function escapeCsv(value) {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (
        str.includes('"') ||
        str.includes(",") ||
        str.includes("\n") ||
        str.includes("\r")
      ) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    // Generate CSV content
    let csvContent = "Set,Order,Title,Artist,Vocalist,Key,Time,BPM\n";

    setlist.SetlistSets.forEach((set) => {
      if (set.SetlistSongs.length > 0) {
        set.SetlistSongs.forEach((setlistSong, index) => {
          const song = setlistSong.Song;

          const setName = escapeCsv(set.name);
          const order = index + 1;
          const title = escapeCsv(song.title);
          const artist =
            song.Artists && song.Artists.length > 0
              ? escapeCsv(song.Artists[0].name)
              : "";
          const vocalist = song.Vocalist ? escapeCsv(song.Vocalist.name) : "";
          const key = song.key ? escapeCsv(song.key) : "";

          let time = "";
          if (song.time) {
            const minutes = Math.floor(song.time / 60);
            const seconds = song.time % 60;
            time = `${minutes}:${seconds.toString().padStart(2, "0")}`;
          }

          const bpm = song.bpm || "";

          csvContent += `${setName},${order},${title},${artist},${vocalist},${key},${time},${bpm}\n`;
        });
      }
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${setlist.title}.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error("CSV export setlist error:", error);
    req.flash("error", "An error occurred during CSV export");
    res.redirect("/bands");
  }
});

// API endpoint to update setlist via Socket.io
router.post("/:id/update", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;
    const { action, data } = req.body;

    // Verify user has access
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    // Broadcast update to other users
    const io = req.app.get("io");
    if (io) {
      io.to(`setlist-${setlistId}`).emit("setlist-updated", {
        setlistId,
        action,
        data,
        userId,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update setlist error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /setlists/:id/save-recordings-url - Save recordings URL for a setlist
router.post("/:id/save-recordings-url", requireAuth, async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;
    const { recordingsUrl } = req.body;

    // Validate input
    if (!recordingsUrl) {
      return res.status(400).json({ error: "Recordings URL is required" });
    }

    // Find setlist and verify user has access
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res
        .status(404)
        .json({ error: "Setlist not found or access denied" });
    }

    // Update the setlist with the recordings URL
    await setlist.update({ recordingsUrl });

    res.json({ success: true, message: "Recordings URL saved successfully" });
  } catch (error) {
    logger.logError("Save recordings URL error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /setlists/:id - Delete a setlist
router.delete("/:id", async (req, res) => {
  try {
    const setlistId = req.params.id;
    const userId = req.session.user.id;

    // Find setlist and verify user has access
    const setlist = await Setlist.findByPk(setlistId, {
      include: [
        {
          model: Band,
          include: [
            {
              model: User,
              where: { id: userId },
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!setlist) {
      return res
        .status(404)
        .json({ error: "Setlist not found or access denied" });
    }

    // Check if setlist is finalized and date has passed
    if (setlist.isFinalized && !isSetlistEditable(setlist)) {
      return res.status(400).json({
        error:
          "Cannot delete a finalized setlist after one week from the performance date",
      });
    }

    // Delete the setlist (cascade will handle related records)
    await setlist.destroy();

    res.json({ success: true, message: "Setlist deleted successfully" });
  } catch (error) {
    console.error("Delete setlist error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
