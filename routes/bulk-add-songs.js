const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

const router = express.Router();

// GET /bulk-add-songs - Show bulk add form
router.get("/", requireAuth, (req, res) => {
  res.render("songs/bulk-add", {
    title: "Bulk Add Songs",
  });
});

// Smart parser function that automatically detects format
function parseBulkInput(input) {
  const lines = input
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  return lines.map((line, index) => {
    const parts = line
      .split(",")
      .map((part) => part.trim().replace(/^["']|["']$/g, ""));

    // Handle different formats based on number of parts
    if (parts.length === 1) {
      // Single title only
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: "",
        vocalistName: "",
        key: "",
        timeStr: "",
        bpm: "",
        format: "title-only",
      };
    } else if (parts.length === 2) {
      // Title, Artist
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: parts[1],
        vocalistName: "",
        key: "",
        timeStr: "",
        bpm: "",
        format: "title-artist",
      };
    } else if (parts.length === 3) {
      // Title, Artist, Vocalist
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: parts[1],
        vocalistName: parts[2],
        key: "",
        timeStr: "",
        bpm: "",
        format: "title-artist-vocalist",
      };
    } else if (parts.length === 4) {
      // Title, Artist, Vocalist, Key
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: parts[1],
        vocalistName: parts[2],
        key: parts[3],
        timeStr: "",
        bpm: "",
        format: "title-artist-vocalist-key",
      };
    } else if (parts.length === 5) {
      // Title, Artist, Vocalist, Key, Time
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: parts[1],
        vocalistName: parts[2],
        key: parts[3],
        timeStr: parts[4],
        bpm: "",
        format: "title-artist-vocalist-key-time",
      };
    } else if (parts.length >= 6) {
      // Title, Artist, Vocalist, Key, Time, BPM (and potentially more)
      return {
        lineNumber: index + 1,
        title: parts[0],
        artistName: parts[1],
        vocalistName: parts[2],
        key: parts[3],
        timeStr: parts[4],
        bpm: parts[5],
        format: "full-csv",
      };
    } else {
      // Fallback - just title
      return {
        lineNumber: index + 1,
        title: parts[0] || "",
        artistName: "",
        vocalistName: "",
        key: "",
        timeStr: "",
        bpm: "",
        format: "fallback",
      };
    }
  });
}

// POST /bulk-add-songs - Process bulk add with smart parsing
router.post(
  "/",
  requireAuth,
  [body("data").notEmpty().withMessage("Please provide song data")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("songs/bulk-add", {
          title: "Bulk Add Songs",
          errors: errors.array(),
          data: req.body.data,
        });
      }

      const { data } = req.body;
      const results = {
        added: [],
        errors: [],
        skipped: [],
        duplicates: [],
        detectedFormat: null,
      };

      // Parse input using smart parser
      const parsedSongs = parseBulkInput(data);

      // Determine detected format for display
      if (parsedSongs.length > 0) {
        results.detectedFormat =
          parsedSongs[0].format === "csv" ? "CSV" : "Line-separated";
      }

      for (const songData of parsedSongs) {
        const {
          lineNumber,
          title,
          artistName,
          vocalistName,
          key,
          timeStr,
          bpm,
          format,
        } = songData;

        if (!title) {
          results.errors.push(`Line ${lineNumber}: Missing song title`);
          continue;
        }

        try {
          // Check if song already exists with proper duplicate logic (case-insensitive)
          let existingSong = null;

          if (artistName) {
            // If artist is provided, check for same title AND same artist (both case-insensitive)
            existingSong = await prisma.song.findFirst({
              where: {
                title: { equals: title.trim(), mode: "insensitive" },
                artists: {
                  some: {
                    artist: {
                      name: { equals: artistName.trim(), mode: "insensitive" },
                    },
                  },
                },
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
                title: { equals: title.trim(), mode: "insensitive" },
                artists: {
                  none: {},
                },
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

          if (existingSong) {
            const existingArtist =
              existingSong.artists && existingSong.artists.length > 0
                ? existingSong.artists[0].artist.name
                : "no artist";
            results.duplicates.push(
              `Line ${lineNumber}: "${title}" by ${artistName || "no artist"} (already exists as "${existingSong.title}" by ${existingArtist})`
            );
            continue;
          }

          // Validate key if provided
          const validKeys = [
            "C",
            "Cm",
            "C#",
            "C#m",
            "Db",
            "Dbm",
            "D",
            "Dm",
            "D#",
            "D#m",
            "Eb",
            "Ebm",
            "E",
            "Em",
            "F",
            "Fm",
            "F#",
            "F#m",
            "Gb",
            "Gbm",
            "G",
            "Gm",
            "G#",
            "G#m",
            "Ab",
            "Abm",
            "A",
            "Am",
            "A#",
            "A#m",
            "Bb",
            "Bbm",
            "B",
            "Bm",
          ];
          const songKey = key && validKeys.includes(key) ? key : null;

          // Parse time if provided (assumes format like "3:45" or "245" seconds)
          let songTime = null;
          if (timeStr) {
            if (timeStr.includes(":")) {
              const [minutes, seconds] = timeStr.split(":").map(Number);
              if (!isNaN(minutes) && !isNaN(seconds)) {
                songTime = minutes * 60 + seconds;
              }
            } else {
              const totalSeconds = parseInt(timeStr);
              if (!isNaN(totalSeconds)) {
                songTime = totalSeconds;
              }
            }
          }

          // Parse BPM if provided
          let songBpm = null;
          if (bpm && bpm.trim() !== "") {
            const bpmValue = parseInt(bpm.trim());
            if (!isNaN(bpmValue) && bpmValue >= 40 && bpmValue <= 300) {
              songBpm = bpmValue;
            }
          }

          // Create or find artist (case-insensitive)
          let artist = null;
          if (artistName) {
            artist = await prisma.artist.upsert({
              where: { name: artistName.trim() },
              update: {},
              create: {
                name: artistName.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // Create or find vocalist
          let vocalist = null;
          if (vocalistName) {
            vocalist = await prisma.vocalist.upsert({
              where: { name: vocalistName.trim() },
              update: {},
              create: {
                name: vocalistName.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // Create song and artist relationship in a transaction
          const result = await prisma.$transaction(async (tx) => {
            // Create song
            const song = await tx.song.create({
              data: {
                title: title.trim(),
                key: songKey,
                time: songTime,
                bpm: songBpm,
                vocalistId: vocalist ? vocalist.id : null,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });

            // Associate with artist if provided
            if (artist) {
              await tx.songArtist.create({
                data: {
                  songId: song.id,
                  artistId: artist.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }

            return song;
          });

          let displayText = `"${title}"`;
          if (artistName) displayText += ` by ${artistName}`;
          if (vocalistName) displayText += ` (vocals: ${vocalistName})`;
          if (songKey) displayText += ` [${songKey}]`;
          if (songTime) {
            const minutes = Math.floor(songTime / 60);
            const seconds = songTime % 60;
            displayText += ` (${minutes}:${seconds.toString().padStart(2, "0")})`;
          }
          if (songBpm) displayText += ` ${songBpm} BPM`;

          results.added.push(displayText);
        } catch (error) {
          console.error("Error processing song:", error);
          results.errors.push(`Line ${lineNumber}: ${error.message}`);
        }
      }

      res.render("songs/bulk-add", {
        title: "Bulk Add Songs",
        results,
        data,
      });
    } catch (error) {
      console.error("Bulk add error:", error);
      req.flash("error", "An error occurred during bulk add");
      res.redirect("/bulk-add-songs");
    }
  }
);

module.exports = router;
