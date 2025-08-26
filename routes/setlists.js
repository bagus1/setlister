const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// Public gig view route (no authentication required)
router.get("/:id/gig-view", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          select: {
            id: true,
            name: true,
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Get BandSong preferences for this band
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
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

    const gigDocuments = await prisma.gigDocument.findMany({
      where: { id: { in: gigDocumentIds } },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            key: true,
            time: true,
          },
        },
      },
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
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          select: {
            id: true,
            name: true,
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                    links: {
                      where: { type: "youtube" },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Collect all YouTube links from the setlist
    const youtubeLinks = [];
    setlist.sets.forEach((set) => {
      if (set.songs && set.name !== "Maybe") {
        set.songs.forEach((setlistSong) => {
          if (
            setlistSong.song &&
            setlistSong.song.links &&
            setlistSong.song.links.length > 0
          ) {
            setlistSong.song.links.forEach((link) => {
              if (link.type === "youtube") {
                youtubeLinks.push({
                  songTitle: setlistSong.song.title,
                  artist:
                    setlistSong.song.artists &&
                    setlistSong.song.artists.length > 0
                      ? setlistSong.song.artists[0].artist.name
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
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          select: {
            id: true,
            name: true,
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                    links: true,
                    gigDocuments: {
                      orderBy: {
                        version: "desc",
                      },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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

    res.render("setlists/rehearsal", {
      title: `Rehearsal View - ${setlist.title}`,
      setlist,
      getLinkIcon,
      getLinkDisplayText,
      getTypeIcon,
      getTypeDisplayName,
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
    const setlistId = parseInt(req.params.id);
    const { url } = req.query;

    if (!url) {
      return res.status(400).send("URL parameter is required");
    }

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          select: {
            id: true,
            name: true,
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          select: {
            id: true,
            name: true,
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                    links: {
                      where: { type: "audio" },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Collect all songs with audio links
    const audioSongs = [];
    const numberedSetSongs = [];
    const maybeSetSongs = [];

    // Calculate set totals and overall total
    const setTotals = {};
    let totalTime = 0;
    let maybeTime = 0;

    // Helper function to parse duration strings to seconds
    function parseDurationToSeconds(durationStr) {
      if (!durationStr) return null;

      // Handle formats like "3:45", "1:23:45", "45s", etc.
      const parts = durationStr.split(":");

      if (parts.length === 2) {
        // Format: "3:45" (minutes:seconds)
        const minutes = parseInt(parts[0]);
        const seconds = parseInt(parts[1]);
        return minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // Format: "1:23:45" (hours:minutes:seconds)
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
      } else if (durationStr.includes("s")) {
        // Format: "45s" (seconds only)
        return parseInt(durationStr);
      }

      return null;
    }

    // Helper function to extract duration from audio file
    async function getAudioDuration(audioUrl) {
      try {
        console.log("Attempting to get duration for:", audioUrl);

        // Use fluent-ffmpeg to get audio duration
        const ffmpeg = require("fluent-ffmpeg");

        return new Promise((resolve) => {
          ffmpeg.ffprobe(audioUrl, (err, metadata) => {
            if (err) {
              console.log("FFmpeg error:", err.message);
              resolve(null);
              return;
            }

            if (metadata && metadata.format && metadata.format.duration) {
              const durationSeconds = metadata.format.duration;
              const minutes = Math.floor(durationSeconds / 60);
              const seconds = Math.floor(durationSeconds % 60);
              const durationStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

              console.log(
                "Extracted duration from FFmpeg:",
                durationStr,
                `(${durationSeconds}s)`
              );
              resolve(durationStr);
            } else {
              console.log("No duration found in FFmpeg metadata");
              resolve(null);
            }
          });
        });
      } catch (error) {
        console.log("Error getting duration for:", audioUrl, error.message);
        return null;
      }
    }

    // Process each set and extract audio durations
    console.log("Starting to process sets for duration extraction...");
    for (const set of setlist.sets) {
      console.log("Processing set:", set.name);
      if (set.songs) {
        let setTime = 0;

        for (const setlistSong of set.songs) {
          if (setlistSong.song.links && setlistSong.song.links.length > 0) {
            const audioUrl = setlistSong.song.links[0].url;
            console.log(
              "Processing song:",
              setlistSong.song.title,
              "with audio URL:",
              audioUrl
            );

            const duration = await getAudioDuration(audioUrl);
            console.log("Extracted duration:", duration);

            const songData = {
              song: setlistSong.song,
              set: set.name,
              order: setlistSong.order,
              duration: duration,
              durationSeconds: duration
                ? parseDurationToSeconds(duration)
                : null,
            };

            console.log("Song data:", {
              title: songData.song.title,
              duration: songData.duration,
              durationSeconds: songData.durationSeconds,
            });

            // Calculate time for this song
            if (songData.durationSeconds) {
              setTime += songData.durationSeconds;
              if (set.name === "Maybe") {
                maybeTime += songData.durationSeconds;
              } else {
                totalTime += songData.durationSeconds;
              }
              console.log(
                "Added to set time:",
                songData.durationSeconds,
                "seconds"
              );
            }

            // Separate Maybe songs from numbered sets
            if (set.name === "Maybe") {
              maybeSetSongs.push(songData);
            } else {
              numberedSetSongs.push(songData);
            }
          }
        }

        // Store set total time
        if (setTime > 0) {
          setTotals[set.name] = setTime;
          console.log("Set", set.name, "total time:", setTime, "seconds");
        }
      }
    }

    console.log("Final totals:", { totalTime, maybeTime, setTotals });

    // Combine numbered sets first, then Maybe songs
    audioSongs.push(...numberedSetSongs, ...maybeSetSongs);

    res.render("setlists/playlist", {
      title: `Playlist - ${setlist.title}`,
      setlist,
      audioSongs,
      setTotals,
      totalTime,
      maybeTime,
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
    const setlistId = parseInt(req.params.id);

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to view setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                    links: {
                      include: {
                        song: true,
                      },
                    },
                    gigDocuments: {
                      include: {
                        song: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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

    // Get all band's songs through BandSong relationship
    const allBandSongs = await prisma.song.findMany({
      where: {
        bandSongs: {
          some: {
            bandId: setlist.bandId,
          },
        },
      },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
        links: {
          include: {
            song: true,
          },
        },
        gigDocuments: {
          include: {
            song: true,
          },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    // Get songs already in this setlist through SetlistSong relationships
    const setlistSongs = await prisma.setlistSong.findMany({
      where: {
        setlistSet: {
          setlistId: setlist.id,
        },
      },
      select: {
        songId: true,
      },
    });

    // Extract used song IDs (from all sets including Maybe)
    const usedSongIds = [];
    setlistSongs.forEach((setlistSong) => {
      usedSongIds.push(setlistSong.songId);
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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
      const setlistId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const { title, date } = req.body;

      // Verify user has access to original setlist
      const originalSetlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
        include: {
          band: {
            include: {
              members: {
                where: { userId: userId },
                select: {
                  id: true,
                },
              },
            },
          },
          sets: {
            include: {
              songs: {
                include: {
                  song: true,
                },
              },
            },
          },
        },
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
      const newSetlist = await prisma.setlist.create({
        data: {
          title,
          bandId: originalSetlist.bandId,
          date: date ? new Date(date) : null,
          isFinalized: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Copy all sets and their songs
      for (const originalSet of originalSetlist.sets) {
        // Create new set
        const newSet = await prisma.setlistSet.create({
          data: {
            setlistId: newSetlist.id,
            name: originalSet.name,
            order: originalSet.order,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Copy all songs in this set
        if (originalSet.songs && originalSet.songs.length > 0) {
          for (let i = 0; i < originalSet.songs.length; i++) {
            const originalSetlistSong = originalSet.songs[i];
            await prisma.setlistSong.create({
              data: {
                setlistSetId: newSet.id,
                songId: originalSetlistSong.songId,
                order: originalSetlistSong.order,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { sets } = req.body;

    // Verify user has access
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
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
    const setlistSets = await prisma.setlistSet.findMany({
      where: { setlistId },
      select: {
        id: true,
      },
    });

    if (setlistSets.length > 0) {
      const setlistSetIds = setlistSets.map((set) => set.id);
      await prisma.setlistSong.deleteMany({
        where: {
          setlistSetId: { in: setlistSetIds },
        },
      });
    }

    // Update sets
    for (const [setName, songs] of Object.entries(sets)) {
      let setlistSet = await prisma.setlistSet.findFirst({
        where: { setlistId, name: setName },
      });

      if (!setlistSet && songs.length > 0) {
        // Create set if it doesn't exist and has songs
        const setOrder = ["Set 1", "Set 2", "Set 3", "Set 4", "Maybe"].indexOf(
          setName
        );
        setlistSet = await prisma.setlistSet.create({
          data: {
            setlistId,
            name: setName,
            order: setOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      if (setlistSet) {
        // Add songs to set
        for (let i = 0; i < songs.length; i++) {
          await prisma.setlistSong.create({
            data: {
              setlistSetId: setlistSet.id,
              songId: songs[i],
              order: i + 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Add a small delay to ensure any pending saves are completed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Get BandSong preferences for this band

    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
      include: {
        song: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Create a map of songId to BandSong for quick lookup
    const bandSongMap = {};
    bandSongs.forEach((bandSong) => {
      bandSongMap[bandSong.songId] = bandSong;
    });

    // Get all gig documents for songs in this setlist
    const songIds = [];
    setlist.sets.forEach((set) => {
      if (set.songs) {
        set.songs.forEach((setlistSong) => {
          songIds.push(setlistSong.song.id);
        });
      }
    });

    const gigDocuments = await prisma.gigDocument.findMany({
      where: { songId: { in: songIds } },
      include: {
        song: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        version: "desc",
      },
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
        await prisma.bandSong.update({
          where: { id: bandSong.id },
          data: { gigDocumentId: preferredDocId },
        });
      } else {
        // Create new BandSong record
        await prisma.bandSong.create({
          data: {
            bandId: setlist.band.id,
            songId: songId,
            gigDocumentId: preferredDocId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      autoAssignedCount++;

      // Update the bandSongMap to reflect the new assignment
      if (!bandSongMap[songId]) {
        bandSongMap[songId] = {
          songId,
          bandId: setlist.band.id,
          gigDocumentId: preferredDocId,
        };
      } else {
        bandSongMap[songId].gigDocumentId = preferredDocId;
      }
    }

    // Calculate set times
    const setTimes = {};
    let totalTime = 0;

    setlist.sets.forEach((set) => {
      if (set.name !== "Maybe") {
        let setTime = 0;

        set.songs.forEach((setlistSong) => {
          if (setlistSong.song.time) {
            setTime += setlistSong.song.time;
          }
        });
        setTimes[set.name] = setTime;
        totalTime += setTime;
      }
    });

    // Calculate if setlist is still editable (always editable)
    const isEditable = true;

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

    const renderData = {
      title: `Finalize ${setlist.title}`,
      setlist,
      setTimes,
      totalTime,
      isEditable,
      bandSongMap,
      gigDocumentsBySong,
      getTypeIcon,
      getTypeDisplayName,
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Verify user has access
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    await prisma.setlist.update({
      where: { id: setlistId },
      data: {
        isFinalized: true,
        updatedAt: new Date(),
      },
    });

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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Verify user has access to this setlist
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    // Update or create BandSong preference
    await prisma.bandSong.upsert({
      where: {
        bandId_songId: {
          bandId: setlist.band.id,
          songId: songId,
        },
      },
      update: {
        gigDocumentId: gigDocumentId || null,
        updatedAt: new Date(),
      },
      create: {
        bandId: setlist.band.id,
        songId: songId,
        gigDocumentId: gigDocumentId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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
    const setlistId = parseInt(req.params.id);

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to export setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    // Generate text export with all details
    let exportText = `${setlist.title}\n`;
    exportText += `Band: ${setlist.band.name}\n`;
    if (setlist.date) {
      exportText += `Date: ${new Date(setlist.date).toLocaleDateString()}\n`;
    }
    exportText += `\n`;

    setlist.sets.forEach((set) => {
      if (set.name !== "Maybe" && set.songs.length > 0) {
        exportText += `${set.name}:\n`;

        set.songs.forEach((setlistSong, index) => {
          const song = setlistSong.song;
          let line = `  ${index + 1}. ${song.title}`;

          if (song.artists && song.artists.length > 0) {
            line += ` - ${song.artists[0].artist.name}`;
          }

          if (song.vocalist) {
            line += ` (${song.vocalist.name})`;
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
    const maybeSet = setlist.sets.find((set) => set.name === "Maybe");
    if (maybeSet && maybeSet.songs.length > 0) {
      exportText += "Maybe:\n";
      maybeSet.songs.forEach((setlistSong, index) => {
        const song = setlistSong.song;
        let line = `  ${index + 1}. ${song.title}`;
        if (song.artists && song.artists.length > 0) {
          line += ` - ${song.artists[0].artist.name}`;
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { includeArtist, includeVocalist, includeKey, includeTime } =
      req.body;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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

    setlist.sets.forEach((set) => {
      if (set.name !== "Maybe" && set.songs.length > 0) {
        exportText += `${set.name}:\n`;

        set.songs.forEach((setlistSong) => {
          const song = setlistSong.song;
          let line = `  ${song.title}`;

          if (includeArtist && song.artists.length > 0) {
            line += ` - ${song.artists[0].artist.name}`;
          }

          if (includeVocalist && song.vocalist) {
            line += ` (${song.vocalist.name})`;
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
    const setlistId = parseInt(req.params.id);

    // Check if user is authenticated
    if (!req.session.user || !req.session.user.id) {
      req.flash("error", "Please log in to export setlists");
      return res.redirect("/auth/login");
    }

    const userId = req.session.user.id;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
        sets: {
          include: {
            songs: {
              include: {
                song: {
                  include: {
                    artists: {
                      include: {
                        artist: true,
                      },
                    },
                    vocalist: true,
                  },
                },
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
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

    setlist.sets.forEach((set) => {
      if (set.songs.length > 0) {
        set.songs.forEach((setlistSong, index) => {
          const song = setlistSong.song;

          const setName = escapeCsv(set.name);
          const order = index + 1;
          const title = escapeCsv(song.title);
          const artist =
            song.artists && song.artists.length > 0
              ? escapeCsv(song.artists[0].artist.name)
              : "";
          const vocalist = song.vocalist ? escapeCsv(song.vocalist.name) : "";
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { action, data } = req.body;

    // Verify user has access
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
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
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { recordingsUrl } = req.body;

    // Validate input
    if (!recordingsUrl) {
      return res.status(400).json({ error: "Recordings URL is required" });
    }

    // Find setlist and verify user has access
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!setlist) {
      return res
        .status(404)
        .json({ error: "Setlist not found or access denied" });
    }

    // Update the setlist with the recordings URL
    await prisma.setlist.update({
      where: { id: setlistId },
      data: {
        recordingsUrl,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: "Recordings URL saved successfully" });
  } catch (error) {
    logger.logError("Save recordings URL error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /setlists/:id - Delete a setlist
router.delete("/:id", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Find setlist and verify user has access
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: {
                id: true,
              },
            },
          },
        },
      },
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

    // Delete related records in the correct order to avoid foreign key constraints
    // First, delete all SetlistSong records
    await prisma.setlistSong.deleteMany({
      where: {
        setlistSet: {
          setlistId: setlistId,
        },
      },
    });

    // Then, delete all SetlistSet records
    await prisma.setlistSet.deleteMany({
      where: { setlistId: setlistId },
    });

    // Finally, delete the setlist
    await prisma.setlist.delete({
      where: { id: setlistId },
    });

    res.json({ success: true, message: "Setlist deleted successfully" });
  } catch (error) {
    console.error("Delete setlist error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
