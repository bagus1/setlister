const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

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

    // Get all song IDs from the setlist
    const songIds = [];
    setlist.sets.forEach((set) => {
      if (set.songs) {
        set.songs.forEach((setlistSong) => {
          if (setlistSong.song) {
            songIds.push(setlistSong.song.id);
          }
        });
      }
    });

    // Get ALL gig documents for songs in this setlist (not just preferred ones)
    const gigDocuments = await prisma.gigDocument.findMany({
      where: {
        songId: { in: songIds },
      },
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
      orderBy: [
        { songId: "asc" },
        { version: "desc" }, // Get latest version first
      ],
    });

    // Create a map of songId to gig documents (array of docs for each song)
    const gigDocumentsBySong = {};
    gigDocuments.forEach((doc) => {
      if (!gigDocumentsBySong[doc.songId]) {
        gigDocumentsBySong[doc.songId] = [];
      }
      gigDocumentsBySong[doc.songId].push(doc);
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
      gigDocumentsBySong,
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

// GET /setlists/:id/print - Show print page with export options (public)
router.get("/:id/print", async (req, res) => {
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
      // Get next version number
      const lastVersion = await prisma.setlistVersion.findFirst({
        where: { setlistId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });

      const nextVersionNumber = (lastVersion?.versionNumber || 0) + 1;
      const changeSummary = generateChangeSummary(previousState, currentState);

      await prisma.setlistVersion.create({
        data: {
          setlistId,
          versionNumber: nextVersionNumber,
          createdById: userId,
          setlistData: currentState,
          changeSummary,
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError("[SAVE] Save setlist error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /setlists/:id/versions - Get version history
router.get("/:id/versions", requireAuth, async (req, res) => {
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
              select: { id: true },
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

    // Get versions
    const versions = await prisma.setlistVersion.findMany({
      where: { setlistId },
      include: {
        createdBy: {
          select: { username: true },
        },
      },
      orderBy: { versionNumber: "desc" },
      take: 50,
    });

    res.json({
      setlistId,
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        timestamp: version.createdAt,
        user: version.createdBy?.username || "Unknown User",
        changeSummary: version.changeSummary,
      })),
    });
  } catch (error) {
    logger.logError("Get setlist versions error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /setlists/:id/versions/:versionId/view - View specific version
router.get("/:id/versions/:versionId/view", requireAuth, async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const userId = req.session.user.id;

    // Verify user has access
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

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    if (setlist.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get version with navigation
    const version = await prisma.setlistVersion.findFirst({
      where: {
        id: versionId,
        setlistId: setlistId,
      },
      include: {
        createdBy: {
          select: { username: true },
        },
      },
    });

    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    // Get previous and next versions for navigation
    const [previousVersion, nextVersion] = await Promise.all([
      // Previous version (higher version number)
      prisma.setlistVersion.findFirst({
        where: {
          setlistId: setlistId,
          versionNumber: { gt: version.versionNumber },
        },
        orderBy: { versionNumber: "asc" },
        select: { id: true, versionNumber: true },
      }),
      // Next version (lower version number)
      prisma.setlistVersion.findFirst({
        where: {
          setlistId: setlistId,
          versionNumber: { lt: version.versionNumber },
        },
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true },
      }),
    ]);

    res.render("setlists/version-view", {
      title: `Version ${version.versionNumber} - ${setlist.title}`,
      setlist: setlist,
      version: version,
      versionId: versionId,
      previousVersion: previousVersion,
      nextVersion: nextVersion,
    });
  } catch (error) {
    logger.logError("View setlist version error", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /setlists/:id/restore/:versionId - Restore to specific version
router.post("/:id/restore/:versionId", requireAuth, async (req, res) => {
  try {
    const setlistId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    const userId = req.session.user.id;

    // Verify user has access
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

    if (!setlist) {
      return res.status(404).json({ error: "Setlist not found" });
    }

    if (setlist.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get version to restore
    const version = await prisma.setlistVersion.findFirst({
      where: {
        id: versionId,
        setlistId: setlistId,
      },
    });

    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    // Capture current state as backup
    const currentState = await captureSetlistState(setlistId);

    // Create backup version before restoring
    if (currentState) {
      const lastVersion = await prisma.setlistVersion.findFirst({
        where: { setlistId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });

      await prisma.setlistVersion.create({
        data: {
          setlistId,
          versionNumber: (lastVersion?.versionNumber || 0) + 1,
          createdById: userId,
          setlistData: currentState,
          changeSummary: `Backup before restoring to version ${version.versionNumber}`,
        },
      });
    }

    // Restore from version data
    const versionData = version.setlistData;

    // Clear existing songs
    const setlistSets = await prisma.setlistSet.findMany({
      where: { setlistId },
      select: { id: true },
    });

    if (setlistSets.length > 0) {
      const setlistSetIds = setlistSets.map((set) => set.id);
      await prisma.setlistSong.deleteMany({
        where: { setlistSetId: { in: setlistSetIds } },
      });
    }

    // Recreate sets and songs from version data
    for (const setData of versionData.sets) {
      let setlistSet = await prisma.setlistSet.findFirst({
        where: { setlistId, name: setData.name },
      });

      if (!setlistSet) {
        setlistSet = await prisma.setlistSet.create({
          data: {
            setlistId,
            name: setData.name,
            order: setData.order,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Add songs to set
      for (const songData of setData.songs) {
        await prisma.setlistSong.create({
          data: {
            setlistSetId: setlistSet.id,
            songId: songData.songId,
            order: songData.order,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError("Restore setlist version error", error);
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
                    links: true,
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
        creator: true,
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

    const renderData = {
      title: `Finalize ${setlist.title}`,
      setlist,
      setTimes,
      totalTime,
      isEditable,
      bandSongMap,
      gigDocumentsBySong,
      songLinkCounts,
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

module.exports = router;
