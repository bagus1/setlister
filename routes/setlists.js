const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const {
  generateShareTokens,
  getViewTypeFromToken,
} = require("../utils/shareTokens");
const { checkStorageQuota } = require("../middleware/checkStorageQuota");
const {
  updateBandStorageUsage,
  checkUserStorageQuota,
} = require("../utils/storageCalculator");
const { exec } = require("child_process");

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/recordings");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "recording-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept audio files only
    const allowedExtensions = /\.(webm|mp3|wav|m4a|ogg)$/i;
    const extname = allowedExtensions.test(file.originalname);

    // Check if it's an audio MIME type (audio/mpeg, audio/wav, etc.)
    const isAudioMimetype = file.mimetype.startsWith("audio/");

    // Accept if either the extension is valid OR it's an audio mimetype
    if (extname || isAudioMimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed!"));
    }
  },
});

// Configure multer for chunk uploads (no file filter)
const chunkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/temp");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename for chunk
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "chunk-" + uniqueSuffix);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for chunks
  },
  // No fileFilter - allow any file type for chunks
});

// Helper function to capture complete setlist state
async function captureSetlistState(setlistId) {
  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId },
    include: {
      sets: {
        include: {
          songs: {
            include: {
              song: {
                select: {
                  id: true,
                  title: true,
                  artists: {
                    select: {
                      artist: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!setlist) return null;

  // Transform to a clean JSON structure
  const setlistData = {
    id: setlist.id,
    title: setlist.title,
    date: setlist.date,
    isFinalized: setlist.isFinalized,
    recordingsUrl: setlist.recordingsUrl,
    sets: setlist.sets.map((set) => ({
      id: set.id,
      name: set.name,
      order: set.order,
      songs: set.songs.map((setlistSong) => ({
        id: setlistSong.id,
        songId: setlistSong.songId,
        order: setlistSong.order,
        title: setlistSong.song.title,
        artist: setlistSong.song.artists[0]?.artist.name || "Unknown Artist",
      })),
    })),
  };

  return setlistData;
}

// Helper function to generate change summary
function generateChangeSummary(previousState, currentState) {
  if (!previousState) {
    const totalSongs = currentState.sets.reduce(
      (total, set) => total + set.songs.length,
      0
    );
    return `Initial setlist with ${totalSongs} songs`;
  }

  const prevSongCount = previousState.sets.reduce(
    (total, set) => total + set.songs.length,
    0
  );
  const currSongCount = currentState.sets.reduce(
    (total, set) => total + set.songs.length,
    0
  );

  // Analyze changes to get detailed information
  const changes = analyzeSetlistChanges(previousState, currentState);

  // If song count changed, it's an add/remove operation
  if (currSongCount > prevSongCount) {
    if (changes.songsAdded.length === 1) {
      const song = changes.songsAdded[0];
      return `Added "${song.title}" to ${song.toSet} (${currSongCount} total)`;
    } else {
      return `Added ${currSongCount - prevSongCount} songs (${currSongCount} total)`;
    }
  } else if (currSongCount < prevSongCount) {
    if (changes.songsRemoved.length === 1) {
      return `Removed "${changes.songsRemoved[0].title}" (${currSongCount} total)`;
    } else {
      return `Removed ${prevSongCount - currSongCount} songs (${currSongCount} total)`;
    }
  }

  // Same song count - analyze what actually changed
  return generateDetailedSummary(changes, currSongCount);
}

// Helper function to analyze specific changes between versions
function analyzeSetlistChanges(previousState, currentState) {
  const changes = {
    songsAdded: [],
    songsRemoved: [],
    songsMovedBetweenSets: [],
    songsReorderedWithinSets: [],
    setNamesChanged: [],
  };

  // Create maps for easier comparison
  const prevSongsBySet = {};
  const currSongsBySet = {};

  previousState.sets.forEach((set) => {
    prevSongsBySet[set.name] = set.songs.map((s) => s.songId);
  });

  currentState.sets.forEach((set) => {
    currSongsBySet[set.name] = set.songs.map((s) => s.songId);
  });

  // Get all song IDs from both states
  const prevSongIds = new Set(
    previousState.sets.flatMap((set) => set.songs.map((s) => s.songId))
  );
  const currSongIds = new Set(
    currentState.sets.flatMap((set) => set.songs.map((s) => s.songId))
  );
  const allSongIds = new Set([...prevSongIds, ...currSongIds]);

  // Find added songs
  currSongIds.forEach((songId) => {
    if (!prevSongIds.has(songId)) {
      // Find which set the song was added to
      for (const [setName, songs] of Object.entries(currSongsBySet)) {
        if (songs.includes(songId)) {
          const song = currentState.sets
            .find((set) => set.name === setName)
            ?.songs.find((s) => s.songId === songId);

          if (song) {
            changes.songsAdded.push({
              songId,
              title: song.title,
              toSet: setName,
            });
          }
          break;
        }
      }
    }
  });

  // Find removed songs
  prevSongIds.forEach((songId) => {
    if (!currSongIds.has(songId)) {
      const song = previousState.sets
        .flatMap((set) => set.songs)
        .find((s) => s.songId === songId);

      if (song) {
        changes.songsRemoved.push({
          songId,
          title: song.title,
        });
      }
    }
  });

  // Find songs that moved between sets
  allSongIds.forEach((songId) => {
    let prevSet = null;
    let currSet = null;

    // Find which set the song was in before
    for (const [setName, songs] of Object.entries(prevSongsBySet)) {
      if (songs.includes(songId)) {
        prevSet = setName;
        break;
      }
    }

    // Find which set the song is in now
    for (const [setName, songs] of Object.entries(currSongsBySet)) {
      if (songs.includes(songId)) {
        currSet = setName;
        break;
      }
    }

    if (prevSet && currSet && prevSet !== currSet) {
      // Find song title for better description
      const song = currentState.sets
        .flatMap((set) => set.songs)
        .find((s) => s.songId === songId);

      if (song) {
        changes.songsMovedBetweenSets.push({
          songId,
          title: song.title,
          from: prevSet,
          to: currSet,
        });
      }
    }
  });

  // Check for reordering within sets and track which songs moved
  Object.keys(currSongsBySet).forEach((setName) => {
    if (prevSongsBySet[setName] && currSongsBySet[setName]) {
      const prevOrder = prevSongsBySet[setName];
      const currOrder = currSongsBySet[setName];

      // If songs are the same but order is different
      if (
        prevOrder.length === currOrder.length &&
        prevOrder.every((id) => currOrder.includes(id)) &&
        JSON.stringify(prevOrder) !== JSON.stringify(currOrder)
      ) {
        // Find the song that moved the most (likely the one that was dragged)
        const movedSongs = [];
        let maxMoveDistance = 0;
        let movedSong = null;

        for (let i = 0; i < prevOrder.length; i++) {
          const songId = prevOrder[i];
          const newPosition = currOrder.indexOf(songId);
          const moveDistance = Math.abs(i - newPosition);

          if (moveDistance > maxMoveDistance) {
            maxMoveDistance = moveDistance;
            const song = currentState.sets
              .find((set) => set.name === setName)
              ?.songs.find((s) => s.songId === songId);

            if (song) {
              movedSong = {
                songId: song.songId,
                title: song.title,
                fromPosition: i + 1,
                toPosition: newPosition + 1,
              };
            }
          }
        }

        if (movedSong) {
          movedSongs.push(movedSong);
        }

        changes.songsReorderedWithinSets.push({
          setName,
          movedSongs,
        });
      }
    }
  });

  return changes;
}

// Helper function to generate detailed summary from changes
function generateDetailedSummary(changes, totalSongs) {
  const parts = [];

  if (changes.songsMovedBetweenSets.length > 0) {
    if (changes.songsMovedBetweenSets.length === 1) {
      const move = changes.songsMovedBetweenSets[0];
      parts.push(`Moved "${move.title}" from ${move.from} to ${move.to}`);
    } else {
      parts.push(
        `Moved ${changes.songsMovedBetweenSets.length} songs between sets`
      );
    }
  }

  if (changes.songsReorderedWithinSets.length > 0) {
    changes.songsReorderedWithinSets.forEach((reorder) => {
      if (reorder.movedSongs.length === 1) {
        const song = reorder.movedSongs[0];
        parts.push(
          `Moved "${song.title}" to position ${song.toPosition} in ${reorder.setName}`
        );
      } else if (reorder.movedSongs.length > 1) {
        parts.push(
          `Reordered ${reorder.movedSongs.length} songs in ${reorder.setName}`
        );
      } else {
        parts.push(`Reordered songs in ${reorder.setName}`);
      }
    });
  }

  if (parts.length === 0) {
    return `Reordered a song within a set`;
  }

  return parts.join(", ");
}

const router = express.Router();

// Redirect old youtube-playlist route to new nested URL
router.get("/:id/youtube-playlist", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(
      `/bands/${setlist.bandId}/setlists/${setlistId}/youtube-playlist`
    );
  } catch (error) {
    logger.logError("Redirect youtube-playlist error", error);
    res.status(500).send("Error redirecting");
  }
});

// Original YouTube playlist route (commented out - now in bands.js)
/*
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

    // Load BandSong preferences for the band
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
      select: {
        songId: true,
        youtube: true,
      },
    });

    // Create a map of songId -> preferred YouTube URL
    const bandSongMap = {};
    bandSongs.forEach((bandSong) => {
      if (bandSong.youtube) {
        bandSongMap[bandSong.songId] = { youtube: bandSong.youtube };
      }
    });

    // Collect YouTube links using preferred links when available
    const youtubeLinks = [];
    const seenVideoIds = new Set(); // Track seen video IDs to prevent duplicates

    setlist.sets.forEach((set) => {
      if (set.songs && set.name !== "Maybe") {
        set.songs.forEach((setlistSong) => {
          if (setlistSong.song) {
            const songId = setlistSong.song.id;
            const bandSong = bandSongMap[songId];

            // Get available YouTube links
            const availableYoutubeLinks =
              setlistSong.song.links?.filter(
                (link) => link.type === "youtube"
              ) || [];

            if (availableYoutubeLinks.length > 0) {
              let selectedLink = null;

              // Use preferred YouTube link if available
              if (bandSong?.youtube) {
                selectedLink = availableYoutubeLinks.find(
                  (link) => link.url === bandSong.youtube
                );
              }

              // Fallback to first available if no preference or preferred not found
              if (!selectedLink) {
                selectedLink = availableYoutubeLinks[0];
              }

              if (selectedLink) {
                const videoId = extractYouTubeVideoId(selectedLink.url);
                if (videoId && !seenVideoIds.has(videoId)) {
                  seenVideoIds.add(videoId);
                  youtubeLinks.push({
                    songTitle: setlistSong.song.title,
                    artist:
                      setlistSong.song.artists &&
                      setlistSong.song.artists.length > 0
                        ? setlistSong.song.artists[0].artist.name
                        : null,
                    set: set.name,
                    order: setlistSong.order,
                    url: selectedLink.url,
                    videoId: videoId,
                  });
                }
              }
            }
          }
        });
      }
    });

    res.render("setlists/youtube-playlist", {
      title: `YouTube Playlist - ${setlist.title}`,
      setlist,
      band: setlist.band,
      hasBandHeader: true,
      youtubeLinks,
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
*/

// Public rehearsal view route (no authentication required)
// Redirect old rehearsal route to new nested URL
router.get("/:id/rehearsal", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/rehearsal`);
  } catch (error) {
    logger.logError("Rehearsal redirect error", error);
    res.status(500).send("Error redirecting to rehearsal view");
  }
});

// Redirect old listen route to new nested URL
router.get("/:id/listen", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const { url } = req.query;

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    const redirectUrl = `/bands/${setlist.bandId}/setlists/${setlistId}/listen`;
    const finalUrl = url
      ? `${redirectUrl}?url=${encodeURIComponent(url)}`
      : redirectUrl;
    res.redirect(finalUrl);
  } catch (error) {
    logger.logError("Listen redirect error", error);
    res.status(500).send("Error redirecting to listen view");
  }
});

// OLD ROUTE - Keep for reference during migration
router.get("/:id/listen/old", async (req, res) => {
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
      band: setlist.band,
      hasBandHeader: true,
      playlistData,
      externalUrl: url,
      layout: "layout",
    });
  } catch (error) {
    logger.logError("Listen route error", error);
    res.status(500).send("Error loading listen view");
  }
});

// Redirect old playlist route to new nested URL
router.get("/:id/playlist", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/playlist`);
  } catch (error) {
    logger.logError("Redirect playlist error", error);
    res.status(500).send("Error redirecting");
  }
});

// Original playlist route (commented out - moved to bands.js)
/*
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

    // Collect all songs with audio links, ensuring Maybe songs come after numbered sets
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
      band: setlist.band,
      hasBandHeader: true,
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
*/

// GET /setlists/:id/print - Show print page with export options (public)
// Redirect old print route to new nested URL
router.get("/:id/print", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/print`);
  } catch (error) {
    logger.logError("Print redirect error", error);
    res.status(500).send("Error redirecting to print page");
  }
});

// Redirect old gig-view route to new nested URL
router.get("/:id/gig-view", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/gig-view`);
  } catch (error) {
    logger.logError("Gig view redirect error", error);
    res.status(500).send("Error redirecting to gig view page");
  }
});

// Redirect old edit route to new nested URL
router.get("/:id/edit", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/edit`);
  } catch (error) {
    logger.logError("Edit redirect error", error);
    req.flash("error", "Error redirecting to edit page");
    res.redirect("/bands");
  }
});

// OLD ROUTE - Keep for reference during migration
router.get("/:id/print/old", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: true,
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

// All other setlist routes require authentication
router.use(requireAuth);

// Helper function to check if setlist is still editable (always editable)
function isSetlistEditable(setlist) {
  return true; // Setlists are always editable
}

// Redirect old setlist show route to new nested URL
router.get("/:id", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}`);
  } catch (error) {
    logger.logError("Setlist redirect error", error);
    req.flash("error", "Error redirecting to setlist");
    res.redirect("/bands");
  }
});

// OLD ROUTE - Keep for reference during migration
router.get("/:id/old", async (req, res) => {
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
                    links: true,
                    gigDocuments: true,
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

    // Get BandSong preferences for this band
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
      include: {
        song: {
          select: {
            id: true,
            title: true,
            links: {
              where: { type: "youtube" },
            },
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
      where: {
        songId: { in: songIds },
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: [{ songId: "asc" }, { type: "asc" }, { version: "desc" }],
    });

    // Group gig documents by song ID
    const gigDocumentsBySong = {};
    gigDocuments.forEach((doc) => {
      if (!gigDocumentsBySong[doc.songId]) {
        gigDocumentsBySong[doc.songId] = [];
      }
      gigDocumentsBySong[doc.songId].push(doc);
    });

    // Process YouTube links for each song with auto-assignment
    const youtubeLinksBySong = {};
    let autoAssignedCount = 0;
    const bandSongsToUpdate = [];

    setlist.sets.forEach((set) => {
      if (set.songs) {
        set.songs.forEach((setlistSong) => {
          const songId = setlistSong.song.id;
          const bandSong = bandSongMap[songId];

          // Get available YouTube links from the song
          const availableYoutubeLinks =
            setlistSong.song.links?.filter((link) => link.type === "youtube") ||
            [];

          // Store all available YouTube links for the dropdown
          if (availableYoutubeLinks.length > 0) {
            youtubeLinksBySong[songId] = availableYoutubeLinks;
          } else {
            youtubeLinksBySong[songId] = [];
          }

          // If bandSong has a preferred YouTube link, auto-assign it
          if (bandSong?.youtube) {
            // Find the preferred link in available links
            const preferredLink = availableYoutubeLinks.find(
              (link) => link.url === bandSong.youtube
            );
            if (!preferredLink) {
              // Preferred link not found in available links, add it as a custom entry
              youtubeLinksBySong[songId].unshift({
                id: "preferred",
                url: bandSong.youtube,
                description: "Preferred Video",
                type: "youtube",
              });
            }
          } else if (availableYoutubeLinks.length > 0) {
            // No preferred link set, auto-assign first available YouTube link
            const firstYoutubeLink = availableYoutubeLinks[0];

            // Track for auto-assignment
            bandSongsToUpdate.push({
              bandId: setlist.band.id,
              songId: songId,
              youtube: firstYoutubeLink.url,
            });
            autoAssignedCount++;
          } else {
            // No YouTube links available
            youtubeLinksBySong[songId] = [];
          }
        });
      }
    });

    // Auto-assign first YouTube links for songs without preferences
    if (bandSongsToUpdate.length > 0) {
      try {
        await Promise.all(
          bandSongsToUpdate.map((bandSongData) =>
            prisma.bandSong.upsert({
              where: {
                bandId_songId: {
                  bandId: bandSongData.bandId,
                  songId: bandSongData.songId,
                },
              },
              update: {
                youtube: bandSongData.youtube,
              },
              create: {
                bandId: bandSongData.bandId,
                songId: bandSongData.songId,
                youtube: bandSongData.youtube,
                createdAt: new Date(),
              },
            })
          )
        );

        // Update bandSongMap with new assignments
        bandSongsToUpdate.forEach((bandSongData) => {
          if (!bandSongMap[bandSongData.songId]) {
            bandSongMap[bandSongData.songId] = {};
          }
          bandSongMap[bandSongData.songId].youtube = bandSongData.youtube;
        });

        console.log(
          `Auto-assigned ${autoAssignedCount} YouTube links for setlist ${setlistId}`
        );
      } catch (error) {
        console.error("Error auto-assigning YouTube links:", error);
        // Continue without failing the request
      }
    }

    // Calculate link counts for each song for tooltip functionality
    const songLinkCounts = {};
    setlist.sets.forEach((set) => {
      if (set.songs) {
        set.songs.forEach((setlistSong) => {
          const songId = setlistSong.song.id;
          const links = setlistSong.song.links || [];

          // Count different types of links
          const audioLinks = links.filter(
            (link) => link.type === "audio"
          ).length;
          const youtubeLinks = links.filter(
            (link) => link.type === "youtube"
          ).length;
          const totalLinks = links.length;

          // Check if song has gig documents
          const hasGigDocs =
            gigDocumentsBySong[songId] && gigDocumentsBySong[songId].length > 0;

          songLinkCounts[songId] = {
            audio: audioLinks,
            youtube: youtubeLinks,
            total: totalLinks,
            hasGigDocs: hasGigDocs,
            hasAnyRehearsalResource: hasGigDocs || totalLinks > 0,
          };
        });
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

    res.render("setlists/show", {
      title: setlist.title,
      setlist,
      band: setlist.band,
      hasBandHeader: true,
      isEditable,
      bandSongMap,
      gigDocumentsBySong,
      youtubeLinksBySong,
      songLinkCounts,
      getTypeIcon,
      getTypeDisplayName,
    });
  } catch (error) {
    logger.logError("Show setlist error", error);
    req.flash("error", "An error occurred loading the setlist");
    res.redirect("/bands");
  }
});

// GET /setlists/:id/copy - Show copy setlist form
// Redirect old copy route to new nested URL
router.get("/:id/copy", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);

    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/copy`);
  } catch (error) {
    logger.logError("Copy redirect error", error);
    req.flash("error", "Error redirecting to copy page");
    res.redirect("/bands");
  }
});

// OLD ROUTE - Keep for reference during migration
router.get("/:id/copy/old", async (req, res) => {
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
          shareTokens: generateShareTokens(),
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
      res.redirect(
        `/bands/${originalSetlist.bandId}/setlists/${newSetlist.id}/edit`
      );
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

    // Capture current state before making changes
    const previousState = await captureSetlistState(setlistId);

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

    // Capture new state after changes
    const currentState = await captureSetlistState(setlistId);

    // Create version record
    if (currentState) {
      const changeSummary = generateChangeSummary(previousState, currentState);

      // Use a transaction to handle race conditions
      try {
        await prisma.$transaction(async (tx) => {
          // Get next version number within transaction
          const lastVersion = await tx.setlistVersion.findFirst({
            where: { setlistId },
            orderBy: { versionNumber: "desc" },
            select: { versionNumber: true },
          });

          const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;

          // Create version record within transaction
          await tx.setlistVersion.create({
            data: {
              setlistId,
              versionNumber: nextVersionNumber,
              createdById: userId,
              setlistData: currentState,
              changeSummary,
            },
          });
        });
      } catch (versionError) {
        // If version creation fails due to race condition, log but don't fail the entire save
        if (versionError.code === "P2002") {
          logger.logError(
            "[SAVE] Version creation failed due to race condition, continuing without version",
            versionError
          );
        } else {
          throw versionError; // Re-throw if it's a different error
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError("[SAVE] Save setlist error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Redirect old versions route to new nested URL
router.get("/:id/versions", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(`/bands/${setlist.bandId}/setlists/${setlistId}/versions`);
  } catch (error) {
    logger.logError("Redirect versions error", error);
    res.status(500).send("Error redirecting");
  }
});

// Redirect old version view route to new nested URL
router.get("/:id/versions/:versionId/view", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    res.redirect(
      `/bands/${setlist.bandId}/setlists/${setlistId}/versions/${versionId}/view`
    );
  } catch (error) {
    logger.logError("Redirect version view error", error);
    res.status(500).send("Error redirecting");
  }
});

// Redirect old restore route to new nested URL
router.post("/:id/restore/:versionId", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    res.redirect(
      `/bands/${setlist.bandId}/setlists/${setlistId}/versions/${versionId}/restore`
    );
  } catch (error) {
    logger.logError("Redirect restore error", error);
    res.status(500).json({ error: "Error redirecting" });
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

// POST /setlists/:id/auto-save - Auto-save setlist metadata (title, date)
router.post("/:id/auto-save", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { field, value } = req.body;

    // Verify user has access to this setlist
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!setlist || setlist.band.members.length === 0) {
      return res
        .status(404)
        .json({ error: "Setlist not found or access denied" });
    }

    // Update the appropriate field
    const updateData = { updatedAt: new Date() };

    if (field === "title") {
      updateData.title = value;
    } else if (field === "date") {
      updateData.date = new Date(value);
    } else {
      return res.status(400).json({ error: "Invalid field" });
    }

    await prisma.setlist.update({
      where: { id: setlistId },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Auto-save setlist error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /setlists/:id/update-set-name - Update set name
router.post("/:id/update-set-name", requireAuth, async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { oldName, newName } = req.body;

    // Verify user has access to the setlist
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId: userId },
            },
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    if (setlist.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validate input
    if (!oldName || !newName) {
      return res
        .status(400)
        .json({ error: "Both oldName and newName are required" });
    }

    if (newName.trim().length === 0) {
      return res.status(400).json({ error: "New name cannot be empty" });
    }

    // Update the set name
    await prisma.setlistSet.updateMany({
      where: {
        setlistId: setlistId,
        name: oldName,
      },
      data: {
        name: newName.trim(),
        updatedAt: new Date(),
      },
    });

    logger.info(
      `Set name updated: ${oldName} -> ${newName} for setlist ${setlistId} by user ${userId}`
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Update set name error:", error);
    res.status(500).json({ error: "Server error" });
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

// POST /setlists/:id/save-recordings-url - Save recordings URL for a setlist (legacy route)
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

    // Verify user is a member of the band
    if (setlist.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
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

// POST /setlists/:id/preferred-youtube - Save preferred YouTube video for a song
router.post("/:id/preferred-youtube", async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { songId, youtubeUrl } = req.body;

    if (!songId || !youtubeUrl) {
      return res
        .status(400)
        .json({ error: "Song ID and YouTube URL are required" });
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
      return res.status(404).json({ error: "Setlist not found" });
    }

    if (setlist.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update or create BandSong record with preferred YouTube URL
    await prisma.bandSong.upsert({
      where: {
        bandId_songId: {
          bandId: setlist.band.id,
          songId: parseInt(songId),
        },
      },
      update: {
        youtube: youtubeUrl,
      },
      create: {
        bandId: setlist.band.id,
        songId: parseInt(songId),
        youtube: youtubeUrl,
        createdAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "Preferred YouTube video saved successfully",
    });
  } catch (error) {
    console.error("Save preferred YouTube error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /setlists/:id/recordings - List all recordings for a setlist
router.get("/:id/recordings", requireAuth, async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Get setlist
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        recordings: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
            splits: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found");
      return res.redirect("/bands");
    }

    if (setlist.band.members.length === 0) {
      req.flash("error", "Not authorized");
      return res.redirect("/bands");
    }

    // Check if user is over quota (to disable buttons)
    const { isUserOverQuota } = require("../utils/storageCalculator");
    const quotaStatus = await isUserOverQuota(userId);

    res.render("setlists/recordings-index", {
      title: `Recordings - ${setlist.title}`,
      pageTitle: `Recordings`,
      marqueeTitle: setlist.title,
      setlist,
      recordings: setlist.recordings,
      hasBandHeader: true,
      band: setlist.band,
      quotaStatus,
    });
  } catch (error) {
    logger.logError("Recordings index error", error);
    req.flash("error", "Error loading recordings");
    res.redirect("/bands");
  }
});

// POST /setlists/:id/recordings - Upload recording
router.post(
  "/:id/recordings",
  requireAuth,
  upload.single("audio"),
  // Note: Quota check removed - we allow uploads but disable buttons when over limit
  async (req, res) => {
    try {
      const setlistId = parseInt(req.params.id);
      const userId = req.session.user.id;

      // Verify setlist exists and user has access
      const setlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
        include: {
          band: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!setlist) {
        return res.status(404).json({ error: "Setlist not found" });
      }

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      // Convert file path to web-accessible URL
      // req.file.path could be absolute or relative, extract just the relative part
      const duration = parseInt(req.body.duration) || 0;
      const fileSize = req.file.size || 0;

      // Get just the filename and construct the web path
      const recordingPath = `/uploads/recordings/${req.file.filename}`;

      // Determine format from file extension
      const format = path.extname(req.file.filename).substring(1) || "webm";

      // Use bestMemberId if provided (for attribution to member with available space)
      // Otherwise use the current user
      const bestMemberId = req.body.bestMemberId
        ? parseInt(req.body.bestMemberId)
        : null;
      const createdById = bestMemberId || userId;

      // Save to database
      const recording = await prisma.recording.create({
        data: {
          setlistId,
          filePath: recordingPath,
          fileSize: BigInt(fileSize),
          duration,
          format,
          createdById: createdById,
        },
      });

      // Recalculate band storage after successful upload
      try {
        await updateBandStorageUsage(setlist.bandId);
      } catch (storageError) {
        // Log but don't fail the upload if storage calculation fails
        logger.logError(
          "Failed to recalculate band storage after upload",
          storageError
        );
      }

      res.json({
        success: true,
        recordingId: recording.id,
        message: "Recording uploaded successfully",
      });
    } catch (error) {
      logger.logError("Recording upload error", error);
      res.status(500).json({ error: "Failed to upload recording" });
    }
  }
);

// POST /setlists/:id/recordings/upload-chunk - Upload a file chunk
router.post(
  "/:id/recordings/upload-chunk",
  requireAuth,
  (req, res, next) => {
    logger.logInfo(
      `Chunk upload request started for setlist ${req.params.id} by user ${req.session.user.id}`
    );
    logger.logInfo(`Chunk request headers: ${JSON.stringify(req.headers)}`);
    next();
  },
  chunkUpload.single("chunk"),
  (err, req, res, next) => {
    if (err) {
      logger.logError("Chunk multer error:", err);
      return res
        .status(400)
        .json({ error: "Chunk upload error", details: err.message });
    }
    logger.logInfo("Chunk multer processing completed successfully");
    next();
  },
  async (req, res) => {
    try {
      const { chunkIndex, totalChunks, originalFileName, originalFileSize } =
        req.body;

      logger.logInfo(
        `Processing chunk ${chunkIndex}/${totalChunks} for file ${originalFileName}`
      );

      if (!req.file) {
        logger.logError("No chunk file uploaded");
        return res.status(400).json({ error: "No chunk uploaded" });
      }

      logger.logInfo(
        `Chunk file received: ${req.file.filename}, size: ${req.file.size} bytes`
      );

      // Store chunk info in session or temporary storage
      const chunkKey = `chunk_${req.params.id}_${originalFileName}_${chunkIndex}`;

      // Move chunk to temporary directory
      const tempDir = path.join(__dirname, "../uploads/temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const chunkPath = path.join(tempDir, `${chunkKey}.tmp`);
      fs.renameSync(req.file.path, chunkPath);

      logger.logInfo(`Chunk ${chunkIndex} saved to: ${chunkPath}`);

      res.json({
        success: true,
        chunkIndex: parseInt(chunkIndex),
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
      });
    } catch (error) {
      logger.logError("Chunk upload error", error);
      res
        .status(500)
        .json({ error: "Failed to upload chunk", details: error.message });
    }
  }
);

// POST /setlists/:id/recordings/reassemble - Reassemble chunks into final file
router.post("/:id/recordings/reassemble", requireAuth, async (req, res) => {
  try {
    const { originalFileName, originalFileSize, totalChunks } = req.body;
    const setlistId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Note: Quota check removed - we allow uploads but disable buttons when over limit

    // Reassemble chunks
    const tempDir = path.join(__dirname, "../uploads/temp");
    const finalPath = path.join(
      __dirname,
      "../uploads/recordings",
      `${Date.now()}_${originalFileName}`
    );

    const writeStream = fs.createWriteStream(finalPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `chunk_${setlistId}_${originalFileName}_${i}`;
      const chunkPath = path.join(tempDir, `${chunkKey}.tmp`);

      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Chunk ${i} not found`);
      }

      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);

      // Clean up chunk file
      fs.unlinkSync(chunkPath);
    }

    writeStream.end();

    // Wait for the write stream to finish before processing
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Now process the reassembled file as a normal recording
    const stats = fs.statSync(finalPath);

    // Convert absolute path to relative path for consistency with other routes
    const recordingPath = `/uploads/recordings/${path.basename(finalPath)}`;

    // Calculate duration using ffmpeg
    let duration = 0;
    try {
      const ffprobe = require("fluent-ffmpeg");
      duration = await new Promise((resolve, reject) => {
        ffprobe.ffprobe(finalPath, (err, metadata) => {
          if (err) {
            console.error("Error getting duration:", err);
            resolve(0);
          } else {
            resolve(Math.floor(metadata.format.duration || 0));
          }
        });
      });
    } catch (error) {
      console.error("Error calculating duration:", error);
      duration = 0;
    }

    // Generate a lightweight preview waveform for mobile
    try {
      const { exec } = require("child_process");
      const waveformsDir = path.join(
        __dirname,
        "..",
        "public",
        "uploads",
        "waveforms"
      );
      if (!fs.existsSync(waveformsDir)) {
        fs.mkdirSync(waveformsDir, { recursive: true });
      }
      const base = path.basename(finalPath).replace(/\.[^/.]+$/, "");
      const previewOut = path.join(waveformsDir, `preview-${base}.dat`);
      const cmd = `audiowaveform -i ${JSON.stringify(finalPath)} -o ${JSON.stringify(previewOut)} -z 128`;
      exec(cmd, (err) => {
        if (err) {
          console.warn(
            "Preview waveform generation failed:",
            err?.message || err
          );
        }
      });
    } catch (e) {
      console.warn(
        "Could not launch preview waveform generation:",
        e?.message || e
      );
    }

    // Create recording record
    // Use bestMemberId if provided (for attribution to member with available space)
    // Otherwise use the current user
    const bestMemberId = req.body.bestMemberId
      ? parseInt(req.body.bestMemberId)
      : null;
    const createdById = bestMemberId || req.session.user.id;

    const recording = await prisma.recording.create({
      data: {
        setlist: { connect: { id: setlistId } },
        filePath: recordingPath,
        fileSize: BigInt(stats.size),
        duration: Number.isFinite(duration) ? duration : 0,
        format: path.extname(originalFileName).substring(1) || "webm",
        createdById: createdById,
      },
    });

    // Get setlist to access bandId
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      select: { bandId: true },
    });

    // Recalculate band storage after successful chunked upload
    if (setlist) {
      try {
        await updateBandStorageUsage(setlist.bandId);
      } catch (storageError) {
        // Log but don't fail the upload if storage calculation fails
        logger.logError(
          "Failed to recalculate band storage after chunked upload",
          storageError
        );
      }
    }

    res.json({
      success: true,
      recordingId: recording.id,
      message: "File reassembled and uploaded successfully",
    });
  } catch (error) {
    logger.logError("Reassembly error", error);
    res.status(500).json({ error: "Failed to reassemble file" });
  }
});

// POST /setlists/:id/recordings/upload - Upload existing recording file
router.post(
  "/:id/recordings/upload",
  requireAuth,
  upload.single("audioFile"),
  // Note: Quota check removed - we allow uploads but disable buttons when over limit
  async (req, res) => {
    try {
      const setlistId = parseInt(req.params.id);
      const userId = req.session.user.id;

      // Verify setlist exists and user has access
      const setlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
        include: {
          band: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!setlist) {
        return res.status(404).json({ error: "Setlist not found" });
      }

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      // Convert file path to web-accessible URL
      // req.file.path could be absolute or relative, extract just the relative part
      const duration = parseInt(req.body.duration) || 0;
      const fileSize = req.file.size || 0;

      // Get just the filename and construct the web path
      const recordingPath = `/uploads/recordings/${req.file.filename}`;

      // Determine format from file extension
      const format = path.extname(req.file.filename).substring(1) || "webm";

      // Save to database
      const recording = await prisma.recording.create({
        data: {
          setlistId,
          filePath: recordingPath,
          fileSize: BigInt(fileSize),
          duration,
          format,
          createdById: userId,
        },
      });

      // Recalculate band storage after successful upload
      try {
        await updateBandStorageUsage(setlist.bandId);
      } catch (storageError) {
        // Log but don't fail the upload if storage calculation fails
        logger.logError(
          "Failed to recalculate band storage after upload",
          storageError
        );
      }

      // --- Waveform Generation ---
      const audioPath = req.file.path;
      const datPath = audioPath.replace(/\.(mp3|wav|m4a|ogg)$/, ".dat");
      const waveformPath = `/uploads/recordings/${path.basename(datPath)}`;

      // Generate waveform with higher zoom for better timing accuracy
      exec(
        `audiowaveform -i "${audioPath}" -o "${datPath}" -b 8 -z 512`,
        async (error, stdout, stderr) => {
          if (error) {
            console.error("Waveform generation failed:", stderr);
            await prisma.recording.update({
              where: { id: recording.id },
              data: { waveformStatus: "failed" },
            });
          } else {
            console.log("Waveform data generated successfully");
            await prisma.recording.update({
              where: { id: recording.id },
              data: {
                waveformStatus: "completed",
                waveformPath: waveformPath,
              },
            });
          }
        }
      );

      res.json({
        success: true,
        recordingId: recording.id,
        message: "Recording uploaded successfully",
      });
    } catch (error) {
      logger.logError("Recording upload error", error);
      res.status(500).json({ error: "Failed to upload recording" });
    }
  }
);

// POST /setlists/:id/recordings/:recordingId/process - Process recording splits
router.post(
  "/:id/recordings/:recordingId/process",
  requireAuth,
  async (req, res) => {
    try {
      const setlistId = parseInt(req.params.id);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;
      const { splits } = req.body;

      // Verify access
      const setlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
        include: {
          band: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!setlist || setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get recording
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording || recording.setlistId !== setlistId) {
        return res.status(404).json({ error: "Recording not found" });
      }

      if (!splits || !Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({ error: "No splits provided" });
      }

      // Check if splitting is allowed (band has free pool space OR recording creator has quota space)
      const { canSplitRecording } = require("../utils/storageCalculator");

      // Estimate split size: assume splits will be roughly proportional to the original recording
      // For a rough estimate, use duration ratio (most splits are similar format/bitrate to source)
      let estimatedSplitSizeBytes = BigInt(0);
      if (recording.fileSize && recording.duration > 0) {
        const bytesPerSecond = Number(recording.fileSize) / recording.duration;
        const totalSplitDuration = splits.reduce(
          (sum, split) => sum + (split.duration || 0),
          0
        );
        // Add 10% buffer for encoding overhead
        estimatedSplitSizeBytes = BigInt(
          Math.floor(bytesPerSecond * totalSplitDuration * 1.1)
        );
      }

      const splitCheck = await canSplitRecording(
        setlist.bandId,
        recording.createdById,
        estimatedSplitSizeBytes > 0 ? estimatedSplitSizeBytes : null
      );

      if (!splitCheck.allowed) {
        return res.status(403).json({
          error:
            splitCheck.message ||
            "Cannot split recording: insufficient storage space available",
        });
      }

      // Create splits directory organized by setlist
      const setlistSplitsDir = path.join(
        __dirname,
        `../uploads/recordings/splits/${setlistId}`
      );
      if (!fs.existsSync(setlistSplitsDir)) {
        fs.mkdirSync(setlistSplitsDir, { recursive: true });
      }

      // Process each split with FFmpeg
      const createdSplits = [];
      // recording.filePath can be absolute OR web-relative (starting with /uploads/)
      let inputPath;
      if (recording.filePath.startsWith("/uploads/")) {
        // Web-relative path starting with /uploads/ - build absolute path from project root
        // Remove leading slash from web path for path.join
        inputPath = path.join(__dirname, "..", recording.filePath.substring(1));
      } else if (recording.filePath.startsWith("/")) {
        // Absolute system path (e.g., /Users/john/...)
        inputPath = recording.filePath;
      } else {
        // Relative path - build from project root
        inputPath = path.join(__dirname, "..", recording.filePath);
      }

      for (const split of splits) {
        // Create split metadata first
        const recordingSplit = await prisma.recordingSplit.create({
          data: {
            recordingId: recording.id,
            songId: split.songId,
            startTime: split.start,
            endTime: split.end,
            duration: split.duration,
            filePath: null, // Will update after extraction
          },
        });

        // Determine output format - preserve original format for best quality/timing
        let extension = "mp3";
        let codec = "libmp3lame";

        if (recording.format) {
          const format = recording.format.toLowerCase();
          if (format === "webm" || format === "ogg") {
            // Preserve OGG/Opus - best timing, good compression
            extension = "ogg";
            codec = "libopus";
          } else if (format === "wav") {
            // Preserve WAV - lossless, perfect timing
            extension = "wav";
            codec = "pcm_s16le"; // Uncompressed WAV
          } else if (format === "flac") {
            // Preserve FLAC - lossless, good compression
            extension = "flac";
            codec = "flac";
          } else if (format === "m4a" || format === "aac" || format === "mp4") {
            // Convert M4A/AAC/MP4 to MP3 for better compatibility
            extension = "mp3";
            codec = "libmp3lame";
          }
          // MP3 stays as MP3
        }

        // Generate output filename
        const outputFilename = `split-${recordingSplit.id}-${split.songTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.${extension}`;
        const outputPath = path.join(setlistSplitsDir, outputFilename);
        const webPath = `/uploads/recordings/splits/${setlistId}/${outputFilename}`;

        // Extract audio segment using FFmpeg
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .setStartTime(split.start)
            .setDuration(split.duration)
            .output(outputPath)
            .audioCodec(codec)
            .audioBitrate("192k")
            .on("end", () => {
              console.log(`Split extracted: ${outputFilename}`);
              resolve();
            })
            .on("error", (err) => {
              console.error(`FFmpeg error for ${outputFilename}:`, err);
              reject(err);
            })
            .run();
        });

        // Update split with file path
        await prisma.recordingSplit.update({
          where: { id: recordingSplit.id },
          data: { filePath: webPath },
        });

        // Note: We don't automatically create Links anymore
        // Users can promote recordings to the global song later if they want

        createdSplits.push(recordingSplit);
      }

      // Mark recording as processed
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          isProcessed: true,
          processedAt: new Date(),
        },
      });

      // Recalculate band storage after splits are created
      try {
        await updateBandStorageUsage(setlist.bandId);
      } catch (storageError) {
        // Log but don't fail the split processing if storage calculation fails
        logger.logError(
          "Failed to recalculate band storage after splits",
          storageError
        );
      }

      res.json({
        success: true,
        message: `Successfully created ${createdSplits.length} splits`,
        splits: createdSplits.length,
      });
    } catch (error) {
      logger.logError("Recording process splits error", error);
      res.status(500).json({ error: "Failed to process splits" });
    }
  }
);

// POST /setlists/:id/recordings/splits/:splitId/promote - Promote a split to song's global links
router.post(
  "/:id/recordings/splits/:splitId/promote",
  requireAuth,
  async (req, res) => {
    try {
      const setlistId = parseInt(req.params.id);
      const splitId = parseInt(req.params.splitId);
      const userId = req.session.user.id;
      const { songId } = req.body;

      // Get the split and verify access
      const split = await prisma.recordingSplit.findUnique({
        where: { id: splitId },
        include: {
          recording: {
            include: {
              setlist: {
                include: {
                  band: {
                    include: {
                      members: {
                        where: { userId },
                      },
                    },
                  },
                },
              },
            },
          },
          song: true,
        },
      });

      if (!split) {
        return res.status(404).json({ error: "Split not found" });
      }

      if (split.recording.setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if already promoted (has a linkId)
      if (split.linkId) {
        return res
          .status(400)
          .json({ error: "This recording is already added to the song" });
      }

      // Create Link for the global song
      const link = await prisma.link.create({
        data: {
          songId: songId,
          createdById: userId,
          type: "audio",
          url: split.filePath,
          description: `Live recording - ${split.recording.setlist.title} (${new Date(split.recording.createdAt).toLocaleDateString()})`,
        },
      });

      // Update split to reference the link
      await prisma.recordingSplit.update({
        where: { id: splitId },
        data: { linkId: link.id },
      });

      console.log(
        `Recording split ${splitId} promoted to song ${songId} - Link ${link.id} created`
      );

      res.json({
        success: true,
        message: "Recording added to song successfully",
        linkId: link.id,
      });
    } catch (error) {
      logger.logError("Promote split error", error);
      res.status(500).json({ error: "Failed to add recording to song" });
    }
  }
);

// DELETE /setlists/:id/recordings/splits/:splitId - Delete a recording split
router.delete(
  "/:id/recordings/splits/:splitId",
  requireAuth,
  async (req, res) => {
    try {
      const splitId = parseInt(req.params.splitId);
      const userId = req.session.userId;

      // Find the split with all necessary relationships
      const split = await prisma.recordingSplit.findUnique({
        where: { id: splitId },
        include: {
          recording: {
            include: {
              setlist: {
                include: {
                  band: {
                    include: {
                      members: true,
                    },
                  },
                },
              },
            },
          },
          link: true,
        },
      });

      if (!split) {
        return res.status(404).json({ error: "Split not found" });
      }

      // Check authorization (user must be a member of the band)
      const isMember = split.recording.setlist.band.members.some(
        (member) => member.userId === userId
      );
      if (!isMember && split.recording.setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Check if the split is used as a link
      if (split.linkId && split.link) {
        // Delete the link record
        await prisma.link.delete({
          where: { id: split.linkId },
        });
        console.log(
          `Deleted link ${split.linkId} associated with split ${splitId}`
        );
      }

      // Check if the split file is referenced in AlbumTrack or BandSong
      // Note: These are string fields, not foreign keys, so we need to check manually
      const albumTracksWithSplit = await prisma.albumTrack.findMany({
        where: {
          audioUrl: {
            contains: split.filePath,
          },
        },
        include: {
          album: true,
          song: true,
        },
      });

      const bandSongsWithSplit = await prisma.bandSong.findMany({
        where: {
          audio: {
            contains: split.filePath,
          },
        },
        include: {
          song: true,
        },
      });

      // Build a warning message if there are references
      let warningMessage = "";
      if (albumTracksWithSplit.length > 0 || bandSongsWithSplit.length > 0) {
        warningMessage = "This split is also referenced in:\n";
        if (albumTracksWithSplit.length > 0) {
          warningMessage += `• ${albumTracksWithSplit.length} album track(s)\n`;
        }
        if (bandSongsWithSplit.length > 0) {
          warningMessage += `• ${bandSongsWithSplit.length} band song(s)\n`;
        }
      }

      // Delete the physical file if it exists
      if (split.filePath) {
        const fs = require("fs");
        const path = require("path");
        let filePath;
        if (split.filePath.startsWith("/Users")) {
          // Absolute path
          filePath = split.filePath;
        } else if (split.filePath.startsWith("/")) {
          // Relative path from public directory
          filePath = path.join(__dirname, "..", split.filePath.substring(1));
        } else {
          // Already relative
          filePath = path.join(__dirname, "..", split.filePath);
        }

        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
          } else {
            console.log(`File not found: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`Error deleting file: ${fileError.message}`);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete the split record
      await prisma.recordingSplit.delete({
        where: { id: splitId },
      });

      // Recalculate band storage after split deletion
      const bandId = split.recording.setlist.band.id;
      try {
        await updateBandStorageUsage(bandId);
      } catch (storageError) {
        logger.logError(
          "Failed to recalculate band storage after split deletion",
          storageError
        );
      }

      console.log(
        `Deleted recording split ${splitId}${warningMessage ? " (with warnings)" : ""}`
      );

      res.json({
        success: true,
        message: "Split deleted successfully",
        warning: warningMessage || null,
      });
    } catch (error) {
      logger.logError("Delete split error", error);
      res.status(500).json({ error: "Failed to delete split" });
    }
  }
);

// PUT /setlists/:id/recordings/splits/:splitId/skip - Toggle skip state
router.put(
  "/:id/recordings/splits/:splitId/skip",
  requireAuth,
  async (req, res) => {
    try {
      const splitId = parseInt(req.params.splitId);
      const userId = req.session.user.id;
      const { isSkipped } = req.body;

      // Find the split
      const split = await prisma.recordingSplit.findUnique({
        where: { id: splitId },
        include: {
          recording: {
            include: {
              setlist: {
                include: {
                  band: {
                    include: {
                      members: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!split) {
        return res.status(404).json({ error: "Split not found" });
      }

      // Check authorization (user must be a member of the band)
      const isMember = split.recording.setlist.band.members.some(
        (member) => member.userId === userId
      );

      if (!isMember) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Update skip state
      await prisma.recordingSplit.update({
        where: { id: splitId },
        data: { isSkipped },
      });

      res.json({ success: true, isSkipped });
    } catch (error) {
      logger.logError("Toggle skip state error", error);
      res.status(500).json({ error: "Failed to toggle skip state" });
    }
  }
);

module.exports = router;
