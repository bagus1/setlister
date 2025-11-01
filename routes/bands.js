const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const path = require("path");
const fs = require("fs");
const { exec, execSync } = require("child_process");
const {
  sendBandInvitation,
  sendBandInvitationNotification,
} = require("../utils/emailService");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");
const {
  generateShareTokens,
  getViewTypeFromToken,
} = require("../utils/shareTokens");
const { checkBandLimit } = require("../middleware/checkBandLimit");
const { deleteBandFiles } = require("../utils/fileCleanup");

// Helper function to validate token for public route access
async function validatePublicToken(setlistId, token, expectedViewType) {
  if (!token) {
    return false;
  }

  const setlist = await prisma.setlist.findUnique({
    where: { id: setlistId },
    select: { shareTokens: true },
  });

  if (!setlist) {
    return false;
  }

  const viewType = getViewTypeFromToken(setlist.shareTokens, token);
  return viewType === expectedViewType;
}

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

  const changes = [];
  const prevSets = new Map(previousState.sets.map((set) => [set.name, set]));
  const currSets = new Map(currentState.sets.map((set) => [set.name, set]));

  // Check for songs added/removed/moved
  for (const [setName, currSet] of currSets) {
    const prevSet = prevSets.get(setName);
    const prevSongs = prevSet
      ? new Set(prevSet.songs.map((s) => s.songId))
      : new Set();
    const currSongs = new Set(currSet.songs.map((s) => s.songId));

    // Songs added to this set
    for (const songId of currSongs) {
      if (!prevSongs.has(songId)) {
        const song = currSet.songs.find((s) => s.songId === songId);
        changes.push(`Added "${song.title}" to ${setName}`);
      }
    }

    // Songs removed from this set
    for (const songId of prevSongs) {
      if (!currSongs.has(songId)) {
        const song = prevSet.songs.find((s) => s.songId === songId);
        changes.push(`Removed "${song.title}" from ${setName}`);
      }
    }
  }

  // Check for songs moved between sets
  for (const [setName, currSet] of currSets) {
    const prevSet = prevSets.get(setName);
    if (!prevSet) continue;

    const prevSongs = prevSet.songs.map((s) => ({
      id: s.songId,
      title: s.title,
    }));
    const currSongs = currSet.songs.map((s) => ({
      id: s.songId,
      title: s.title,
    }));

    // Check if songs were reordered within the set
    const prevOrder = prevSongs.map((s) => s.id).join(",");
    const currOrder = currSongs.map((s) => s.id).join(",");

    if (prevOrder !== currOrder && prevSongs.length === currSongs.length) {
      changes.push(`Reordered songs in ${setName}`);
    }
  }

  if (changes.length === 0) {
    return "No changes detected";
  }

  return changes.join(", ");
}

const router = express.Router();

// Helper function for setlist editability
function isSetlistEditable(setlist) {
  return true; // Setlists are always editable
}

// PUBLIC ROUTES (no authentication required)
// These routes are accessible without login

// GET /bands/:bandId/setlists/:setlistId/recordings - List recordings for a setlist
router.get(
  "/:bandId/setlists/:setlistId/recordings",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
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
              splits: {
                include: {
                  song: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
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

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist not found");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      res.render("setlists/recordings-index", {
        title: `Recordings - ${setlist.title}`,
        pageTitle: `Recordings`,
        marqueeTitle: setlist.title,
        setlist,
        recordings: setlist.recordings,
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Recordings index error", error);
      req.flash("error", "Error loading recordings");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/player - Player for split recordings (public with share token)
router.get("/:bandId/setlists/:setlistId/player", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const shareToken = req.query.t;

    // Get setlist with recordings and splits
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
      include: {
        band: true,
        recordings: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
            splits: {
              include: {
                song: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    if (setlist.bandId !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    // Check authorization - either logged in as band member OR has valid share token
    const isAuthenticated = req.session.user?.id;
    let hasAccess = false;
    let isBandMember = false;

    if (isAuthenticated) {
      // Check if user is a band member
      const member = await prisma.bandMember.findFirst({
        where: {
          bandId: setlist.bandId,
          userId: req.session.user.id,
        },
      });
      hasAccess = !!member;
      isBandMember = !!member;
    }

    // Check share token if not authenticated or not a member
    if (!hasAccess && shareToken) {
      const viewType = getViewTypeFromToken(setlist.shareTokens, shareToken);
      hasAccess = viewType === "player";
    }

    if (!hasAccess) {
      return res.status(403).send("Not authorized to view this player");
    }

    res.render("setlists/recordings-player", {
      title: `Player - ${setlist.title}`,
      pageTitle: `Player`,
      marqueeTitle: setlist.band.name,
      setlist,
      recordings: setlist.recordings,
      hasBandHeader: false, // No band header for public view
      shareToken, // Pass token to view for generating share links
      isBandMember, // Pass whether current user is a band member
    });
  } catch (error) {
    logger.logError("Recordings player error", error);
    res.status(500).send("Error loading player");
  }
});

// ALL SUB-ROUTES FOR /recordings/:recordingId must come BEFORE the generic GET route
// Otherwise Express will match the GET route first and return HTML

// POST /bands/:bandId/setlists/:setlistId/recordings/:recordingId/assign-song - Assign recording to single song
router.post(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/assign-song",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;
      const { songTitle, songId } = req.body;

      // Verify access
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
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
      });

      if (
        !recording ||
        recording.setlist.bandId !== bandId ||
        recording.setlist.band.members.length === 0
      ) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Get or create song
      let finalSongId = songId ? parseInt(songId) : null;
      if (!finalSongId && songTitle) {
        // Create new song in band
        const newSong = await prisma.song.create({
          data: {
            title: songTitle.trim(),
            bandId: bandId,
            createdById: userId,
          },
        });
        finalSongId = newSong.id;

        // Add song to setlist
        const maxOrder = await prisma.setlistSong.findFirst({
          where: { setlistId },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        await prisma.setlistSong.create({
          data: {
            setlistId,
            songId: newSong.id,
            order: (maxOrder?.order || 0) + 1,
            setId: null, // Add to setlist, not a specific set
          },
        });
      }

      if (!finalSongId) {
        return res.status(400).json({ error: "Song ID or title required" });
      }

      // Create a single split for the entire recording
      const split = await prisma.recordingSplit.create({
        data: {
          recordingId: recordingId,
          songId: finalSongId,
          startTime: 0,
          endTime: recording.duration || 0,
          duration: recording.duration || 0,
          filePath: recording.filePath, // Point to the full recording
        },
      });

      // Mark recording as processed
      await prisma.recording.update({
        where: { id: recordingId },
        data: { isProcessed: true },
      });

      res.json({
        success: true,
        message: "Recording assigned to song",
        splitId: split.id,
      });
    } catch (error) {
      console.error("Assign recording to song error:", error);
      logger.logError("Assign recording to song error", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to assign recording" });
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/recordings/:recordingId/delete-source - Delete source file only
router.post(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/delete-source",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Verify access
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
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
          splits: {
            where: {
              linkId: { not: null },
            },
            include: {
              link: true,
            },
          },
        },
      });

      if (
        !recording ||
        recording.setlist.bandId !== bandId ||
        recording.setlist.band.members.length === 0
      ) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Delete any links first
      for (const split of recording.splits) {
        if (split.linkId) {
          await prisma.link.delete({ where: { id: split.linkId } });
        }
      }

      // Delete the audio file from disk
      const fs = require("fs");
      const originalFilePath = recording.filePath;

      if (originalFilePath && originalFilePath.trim() !== "") {
        // Build absolute path - handle both absolute and relative paths
        let filePath;
        if (originalFilePath.startsWith("/Users")) {
          // Already absolute path
          filePath = originalFilePath;
        } else if (originalFilePath.startsWith("/")) {
          // Relative path like /uploads/recordings/file.mp3 - remove leading /
          filePath = path.join(__dirname, "..", originalFilePath.substring(1));
        } else {
          // Already relative without leading /
          filePath = path.join(__dirname, "..", originalFilePath);
        }

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Clear the filePath in database by setting to empty string
      await prisma.recording.update({
        where: { id: recordingId },
        data: { filePath: "" },
      });

      // Recalculate band storage after source file deletion
      const { updateBandStorageUsage } = require("../utils/storageCalculator");
      try {
        await updateBandStorageUsage(bandId);
      } catch (storageError) {
        logger.logError(
          "Failed to recalculate band storage after source deletion",
          storageError
        );
      }

      res.json({ success: true, message: "Source file deleted" });
    } catch (error) {
      console.error("Delete source error:", error);
      logger.logError("Delete source error", error);
      res.status(500).json({ error: "Failed to delete source file" });
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/recordings/:recordingId/delete-all-splits - Delete all splits and reset for re-split
router.post(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/delete-all-splits",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Verify access
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
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
          splits: true,
        },
      });

      if (
        !recording ||
        recording.setlist.bandId !== bandId ||
        recording.setlist.band.members.length === 0
      ) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Delete all splits and their files
      for (const split of recording.splits) {
        // Delete the link if it exists
        if (split.linkId) {
          await prisma.link.delete({
            where: { id: split.linkId },
          });
        }
        // Delete the file
        if (split.filePath) {
          const fs = require("fs");
          const splitPath = path.join(__dirname, "..", split.filePath);
          if (fs.existsSync(splitPath)) {
            fs.unlinkSync(splitPath);
          }
        }
      }

      // Delete all splits
      await prisma.recordingSplit.deleteMany({
        where: { recordingId },
      });

      // Reset isProcessed flag
      await prisma.recording.update({
        where: { id: recordingId },
        data: { isProcessed: false },
      });

      // Recalculate band storage after deleting all splits
      const { updateBandStorageUsage } = require("../utils/storageCalculator");
      try {
        await updateBandStorageUsage(bandId);
      } catch (storageError) {
        logger.logError(
          "Failed to recalculate band storage after delete-all-splits",
          storageError
        );
      }

      res.json({
        success: true,
        message: "All splits deleted. Ready to re-split.",
      });
    } catch (error) {
      console.error("Delete all splits error:", error);
      logger.logError("Delete all splits error", error);
      res.status(500).json({ error: "Failed to delete all splits" });
    }
  }
);

// DELETE /bands/:bandId/setlists/:setlistId/recordings/:recordingId - Delete entire recording
router.delete(
  "/:bandId/setlists/:setlistId/recordings/:recordingId",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Verify access
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
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
          splits: {
            where: {
              linkId: { not: null },
            },
            include: {
              link: true,
            },
          },
        },
      });

      if (
        !recording ||
        recording.setlist.bandId !== bandId ||
        recording.setlist.band.members.length === 0
      ) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Delete any links first
      for (const split of recording.splits) {
        if (split.linkId) {
          await prisma.link.delete({ where: { id: split.linkId } });
        }
      }

      // Delete audio files from disk
      const fs = require("fs");

      // Delete main recording file
      if (recording.filePath) {
        const mainFilePath = path.join(__dirname, "..", recording.filePath);
        if (fs.existsSync(mainFilePath)) {
          fs.unlinkSync(mainFilePath);
        }
      }

      // Get all splits to delete their files
      const allSplits = await prisma.recordingSplit.findMany({
        where: { recordingId: recordingId },
      });

      for (const split of allSplits) {
        if (split.filePath) {
          const splitFilePath = path.join(__dirname, "..", split.filePath);
          if (fs.existsSync(splitFilePath)) {
            fs.unlinkSync(splitFilePath);
          }
        }
      }

      // Delete recording (cascades to splits)
      await prisma.recording.delete({ where: { id: recordingId } });

      // Recalculate band storage after recording deletion
      const { updateBandStorageUsage } = require("../utils/storageCalculator");
      try {
        await updateBandStorageUsage(bandId);
      } catch (storageError) {
        logger.logError(
          "Failed to recalculate band storage after recording deletion",
          storageError
        );
      }

      // Return JSON success - client will handle redirect
      res.json({
        success: true,
        message: "Recording and all associated files deleted successfully.",
      });
    } catch (error) {
      console.error("Delete recording error:", error);
      logger.logError("Delete recording error", error);
      res.status(500).json({ error: "Failed to delete recording" });
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId - View/play a specific recording
// GET /bands/:bandId/recordings - All band recordings
router.get("/:bandId/recordings", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const userId = req.session.user.id;

    // Get band with all recordings from all setlists
    const band = await prisma.band.findUnique({
      where: { id: bandId },
      include: {
        members: {
          where: { userId },
          select: {
            role: true,
            userId: true,
          },
        },
        setlists: {
          include: {
            recordings: {
              include: {
                creator: true,
                splits: {
                  where: {
                    filePath: { not: null },
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    if (band.members.length === 0) {
      req.flash("error", "Not authorized");
      return res.redirect("/bands");
    }

    // Flatten all recordings with their setlist context
    const allRecordings = [];
    band.setlists.forEach((setlist) => {
      setlist.recordings.forEach((recording) => {
        allRecordings.push({
          ...recording,
          setlist: {
            id: setlist.id,
            title: setlist.title,
            band: {
              id: band.id,
            },
          },
        });
      });
    });

    // Sort by creation date (newest first)
    allRecordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get storage info
    const {
      getBandStorageInfo,
      calculateUserStorageUsage,
    } = require("../utils/storageCalculator");

    const bandStorageInfo = await getBandStorageInfo(bandId);
    const userStorageInfo = await calculateUserStorageUsage(userId);

    // Calculate storage breakdown by recording and splits
    // Only count recordings where the source file still exists (filePath is not empty)
    let recordingsStorageBytes = BigInt(0);
    allRecordings.forEach((recording) => {
      if (
        recording.fileSize &&
        recording.filePath &&
        recording.filePath !== ""
      ) {
        recordingsStorageBytes += BigInt(recording.fileSize);
      }
    });

    // Calculate split file sizes from filesystem
    const fs = require("fs");
    const path = require("path");
    let splitsStorageBytes = BigInt(0);
    let splitsCount = 0;

    for (const recording of allRecordings) {
      if (recording.splits && recording.splits.length > 0) {
        for (const split of recording.splits) {
          if (split.filePath && split.filePath.startsWith("/uploads/")) {
            try {
              // Try public/uploads first, then uploads directly (for splits)
              let filePath = path.join(process.cwd(), "public", split.filePath);
              if (!fs.existsSync(filePath)) {
                filePath = path.join(
                  process.cwd(),
                  split.filePath.substring(1)
                );
              }
              if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                splitsStorageBytes += BigInt(stats.size);
                splitsCount++;
              }
            } catch (err) {
              // File doesn't exist, skip
            }
          }
        }
      }
    }

    res.render("bands/recordings-index", {
      title: `${band.name} - All Recordings`,
      pageTitle: "All Recordings",
      marqueeTitle: band.name,
      band,
      recordings: allRecordings,
      user: req.session.user,
      bandStorageInfo,
      userStorageInfo,
      recordingsStorageBytes: Number(recordingsStorageBytes),
      splitsStorageBytes: Number(splitsStorageBytes),
      splitsCount,
      quotaStatus: userStorageInfo
        ? { isOverQuota: userStorageInfo.usedPercent >= 100 }
        : { isOverQuota: false },
    });
  } catch (error) {
    logger.logError("Get all band recordings error", error);
    req.flash("error", "Failed to load recordings");
    res.redirect("/bands");
  }
});

router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
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
        },
      });

      if (
        !setlist ||
        setlist.bandId !== bandId ||
        setlist.band.members.length === 0
      ) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          splits: {
            include: {
              song: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: {
              startTime: "asc",
            },
          },
        },
      });

      if (!recording || recording.setlistId !== setlistId) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      res.render("setlists/recording-player", {
        title: `Recording - ${setlist.title}`,
        pageTitle: `Recording`,
        marqueeTitle: setlist.title,
        setlist,
        recording: {
          ...recording,
          filePath: recording.filePath
            ? `/uploads/recordings/${path.basename(recording.filePath)}`
            : "",
        },
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Recording player error", error);
      req.flash("error", "Error loading recording");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/api/songs - Get songs for a setlist (API endpoint)
router.get(
  "/:bandId/setlists/:setlistId/api/songs",
  requireAuth,
  async (req, res) => {
    try {
      const setlistId = parseInt(req.params.setlistId);
      const userId = req.session.user.id;

      // Get setlist with songs
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
          sets: {
            include: {
              songs: {
                include: {
                  song: {
                    select: {
                      id: true,
                      title: true,
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

      if (!setlist || setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Not authorized" });
      }

      // Flatten songs from all sets
      const songs = [];
      setlist.sets.forEach((set) => {
        set.songs.forEach((ss) => {
          songs.push({
            id: ss.song.id,
            title: ss.song.title,
          });
        });
      });

      res.json({ songs });
    } catch (error) {
      logger.logError("Get setlist songs API error", error);
      res.status(500).json({ error: "Failed to load songs" });
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId/split-comparison - Comparison demo
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split-comparison",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get setlist with all songs
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
          sets: {
            include: {
              songs: {
                include: {
                  song: true,
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

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      res.render("setlists/recording-split-peaks", {
        title: `Peaks.js vs WaveSurfer Comparison - ${setlist.title}`,
        pageTitle: `Peaks.js vs WaveSurfer Comparison`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
        },
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Peaks.js comparison page error", error);
      req.flash("error", "Error loading Peaks.js comparison page");
      res.redirect("/bands");
    }
  }
);
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split-peaks",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get setlist with all songs
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
          sets: {
            include: {
              songs: {
                include: {
                  song: true,
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

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      res.render("setlists/recording-split-peaks-prototype", {
        title: `Peaks.js Split Recording - ${setlist.title}`,
        pageTitle: `Peaks.js Split Recording`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
        },
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Peaks.js recording split page error", error);
      req.flash("error", "Error loading Peaks.js split page");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId/test-peaks-simple - Simple Peaks test
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/test-peaks-simple",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect("/bands");
      }

      res.render("setlists/test-peaks-simple", {
        title: "Simple Peaks Test",
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
        },
      });
    } catch (error) {
      logger.logError("Simple Peaks test error", error);
      req.flash("error", "Error loading simple Peaks test");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId/split-peaks2 - Clean Peaks.js prototype
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split-peaks2",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get setlist with all songs
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
          sets: {
            include: {
              songs: {
                include: {
                  song: true,
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

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      res.render("setlists/recording-split-peaks-prototype2", {
        title: `Peaks.js Split Recording v2 - ${setlist.title}`,
        pageTitle: `Peaks.js Split Recording v2`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
        },
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Peaks.js v2 recording split page error", error);
      req.flash("error", "Error loading Peaks.js v2 split page");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId/split - Peaks.js split page
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;
      logger.logInfo(`[SPLIT PAGE] Route handler called`, userId);
      logger.logInfo(
        `[SPLIT PAGE] Parsed IDs - Band: ${bandId}, Setlist: ${setlistId}, Recording: ${recordingId}`,
        userId
      );

      // Get setlist with all songs
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
        req.flash("error", "Setlist not found");
        return res.redirect("/bands");
      }

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      // Generate waveforms on-demand if they don't exist
      logger.logInfo(`[SPLIT PAGE] Starting waveform generation logic`, userId);
      logger.logInfo(
        `[SPLIT PAGE] Recording object: ${recording ? "exists" : "null"}`,
        userId
      );
      logger.logInfo(
        `[SPLIT PAGE] Recording filePath: ${recording?.filePath || "empty/null"}`,
        userId
      );
      const waveformZoomLevels = {};
      try {
        if (recording && recording.filePath) {
          logger.logInfo(
            `[SPLIT PAGE] Entering waveform generation block`,
            userId
          );
          const base = path
            .basename(recording.filePath)
            .replace(/\.[^/.]+$/, "");

          // Get absolute path to audio file
          // recording.filePath may be relative (/uploads/...) or just a filename
          // Files are stored in uploads/recordings/ at project root, not public/uploads/recordings/
          let audioAbsPath;
          if (recording.filePath.startsWith("/")) {
            // Remove leading slash and join with project root (not public)
            // /uploads/recordings/file.webm -> uploads/recordings/file.webm
            audioAbsPath = path.join(
              __dirname,
              "..",
              recording.filePath.substring(1)
            );
          } else {
            // Assume it's just a filename in uploads/recordings
            audioAbsPath = path.join(
              __dirname,
              "..",
              "uploads",
              "recordings",
              recording.filePath
            );
          }

          // Log audio file information
          logger.logInfo(`[SPLIT PAGE] Recording ID: ${recording.id}`, userId);
          logger.logInfo(
            `[SPLIT PAGE] Audio file path: ${recording.filePath}`,
            userId
          );
          logger.logInfo(
            `[SPLIT PAGE] Audio file absolute path: ${audioAbsPath}`,
            userId
          );
          logger.logInfo(
            `[SPLIT PAGE] Base filename (for waveforms): ${base}`,
            userId
          );

          const audioFileExists = fs.existsSync(audioAbsPath);
          logger.logInfo(
            `[SPLIT PAGE] Audio file exists: ${audioFileExists}`,
            userId
          );

          if (audioFileExists) {
            const audioStats = fs.statSync(audioAbsPath);
            const audioSizeMB = (audioStats.size / (1024 * 1024)).toFixed(2);
            logger.logInfo(
              `[SPLIT PAGE] Audio file size: ${audioStats.size} bytes (${audioSizeMB} MB)`,
              userId
            );
            logger.logInfo(
              `[SPLIT PAGE] Audio file format: ${recording.format || "unknown"}`,
              userId
            );
            logger.logInfo(
              `[SPLIT PAGE] Audio file duration: ${recording.duration || 0} seconds`,
              userId
            );
          }

          // Detect mobile device from user-agent
          const userAgent = req.headers["user-agent"] || "";
          const isMobile =
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
              userAgent
            );
          logger.logInfo(`[SPLIT PAGE] User agent: ${userAgent}`, userId);
          logger.logInfo(
            `[SPLIT PAGE] Detected as mobile: ${isMobile}`,
            userId
          );

          // Set up waveforms directory
          const waveformsDir = path.join(
            __dirname,
            "..",
            "public",
            "uploads",
            "waveforms"
          );
          if (!fs.existsSync(waveformsDir)) {
            fs.mkdirSync(waveformsDir, { recursive: true, mode: 0o755 });
            console.log(
              `[WAVEFORM] Created waveforms directory: ${waveformsDir}`
            );
          }
          // Verify directory is writable
          try {
            fs.accessSync(waveformsDir, fs.constants.W_OK);
            console.log(`[WAVEFORM] Directory is writable: ${waveformsDir}`);
          } catch (e) {
            console.error(
              `[WAVEFORM] Directory is NOT writable: ${waveformsDir}`,
              e.message
            );
          }

          // Get file size if available (from DB or filesystem)
          const fileSizeBytes = recording.fileSize
            ? Number(recording.fileSize)
            : fs.existsSync(audioAbsPath)
              ? fs.statSync(audioAbsPath).size
              : 0;

          // Determine zoom levels based on device type, browser, and file size
          // Higher samples/pixel = less detail = less memory usage
          // For Safari on large files, use VERY high samples/pixel to minimize memory
          const fileSizeMB = fileSizeBytes / (1024 * 1024);
          const isLargeFile = fileSizeMB > 50;
          const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
          const isSafariLargeFile = isSafari && isLargeFile;

          let zoomLevels;
          if (isMobile) {
            // Mobile: use 1024 samples/pixel for lower memory usage
            logger.logInfo(
              `[SPLIT PAGE] Mobile device detected - using 1024 samples/pixel (low memory)`,
              userId
            );
            zoomLevels = [
              {
                level: 1,
                samples: 1024,
                file: path.join(waveformsDir, `zoom1-${base}.dat`),
              },
            ];
          } else if (isSafariLargeFile) {
            // Safari on large files: use SINGLE VERY high samples/pixel (8192) to minimize memory
            // Only ONE zoom level - Safari can't handle loading multiple waveform files
            // This is much lower resolution but prevents Safari memory crashes
            logger.logInfo(
              `[SPLIT PAGE] Safari + Large file detected (${fileSizeMB.toFixed(2)} MB) - using SINGLE VERY low resolution (8192 samples/pixel) to prevent memory crashes`,
              userId
            );
            zoomLevels = [
              {
                level: 1,
                samples: 8192,
                file: path.join(waveformsDir, `zoom1-${base}.dat`),
              },
            ];
          } else if (isLargeFile) {
            // Large files on other browsers: use fewer/higher zoom levels
            logger.logInfo(
              `[SPLIT PAGE] Large file detected (${fileSizeMB.toFixed(2)} MB) - using reduced zoom levels (256-512 samples/pixel)`,
              userId
            );
            zoomLevels = [
              {
                level: 2,
                samples: 256,
                file: path.join(waveformsDir, `zoom2-${base}.dat`),
              },
              {
                level: 3,
                samples: 512,
                file: path.join(waveformsDir, `zoom3-${base}.dat`),
              },
            ];
          } else {
            // Desktop: progressive zoom levels (64, 128, 256, 512)
            logger.logInfo(
              `[SPLIT PAGE] Normal desktop file - using progressive zoom levels (64-512 samples/pixel)`,
              userId
            );
            zoomLevels = [
              {
                level: 1,
                samples: 64,
                file: path.join(waveformsDir, `zoom1-${base}.dat`),
              },
              {
                level: 2,
                samples: 128,
                file: path.join(waveformsDir, `zoom2-${base}.dat`),
              },
              {
                level: 3,
                samples: 256,
                file: path.join(waveformsDir, `zoom3-${base}.dat`),
              },
              {
                level: 4,
                samples: 512,
                file: path.join(waveformsDir, `zoom4-${base}.dat`),
              },
            ];
          }

          // Log the actual zoom levels that will be used
          const zoomSummary = zoomLevels
            .map((z) => `level ${z.level}: ${z.samples} samples/pixel`)
            .join(", ");
          logger.logInfo(
            `[SPLIT PAGE] Zoom levels configured: ${zoomSummary}`,
            userId
          );

          // Check which waveforms already exist, generate missing ones

          console.log(
            `[SPLIT PAGE] Total zoom levels to check/generate: ${zoomLevels.length}`
          );

          // audiowaveform doesn't support WebM and some OGG formats - transcode once if needed and reuse for all zoom levels
          let sharedInputFile = audioAbsPath;
          let sharedTempWavPath = null;
          const isWebM = audioAbsPath.toLowerCase().endsWith(".webm");
          const isOGG = audioAbsPath.toLowerCase().endsWith(".ogg") || audioAbsPath.toLowerCase().endsWith(".oga");

          if ((isWebM || isOGG) && fs.existsSync(audioAbsPath)) {
            // Check if any waveforms need to be generated
            const needsGeneration = zoomLevels.some(({ file }) => {
              return !fs.existsSync(file);
            });

            if (needsGeneration) {
              // Create a shared temporary WAV file for all zoom levels
              sharedTempWavPath = path.join(waveformsDir, `temp-${base}.wav`);
              logger.logInfo(
                `[SPLIT PAGE]   - Transcoding WebM to WAV once for all waveform generation: ${sharedTempWavPath}`,
                userId
              );

              // Transcode WebM/OGG to WAV using FFmpeg
              const transcodeCmd = `ffmpeg -y -i ${JSON.stringify(audioAbsPath)} -vn -c:a pcm_s16le -ar 44100 ${JSON.stringify(sharedTempWavPath)}`;
              logger.logInfo(
                `[SPLIT PAGE]   - Transcode command: ${transcodeCmd}`,
                userId
              );

              // Do transcoding synchronously (waveform generation needs the file)
              try {
                execSync(transcodeCmd, { stdio: "pipe" });
                sharedInputFile = sharedTempWavPath;
                logger.logInfo(
                  `[SPLIT PAGE]   - Transcode successful, using shared WAV for all waveforms`,
                  userId
                );
              } catch (transcodeErr) {
                logger.logError(
                  `[SPLIT PAGE]   - Transcode failed, cannot generate waveforms`,
                  transcodeErr?.message || transcodeErr,
                  userId
                );
                // Continue without waveforms - client will use Web Audio fallback
                sharedInputFile = null;
              }
            }
          }

          // Track active waveform generation processes to know when to clean up shared WAV
          let activeProcesses = 0;
          const pendingProcesses = new Set();

          for (const { level, samples, file } of zoomLevels) {
            const candidate = `/uploads/waveforms/zoom${level}-${base}.dat`;
            const abs = path.join(__dirname, "..", "public", candidate);
            const fileName = path.basename(file);

            console.log(
              `[SPLIT PAGE] Checking zoom level ${level} (${samples} samples/pixel):`
            );
            console.log(`[SPLIT PAGE]   - Output file: ${fileName}`);
            console.log(`[SPLIT PAGE]   - Full path: ${file}`);
            console.log(`[SPLIT PAGE]   - Web path: ${candidate}`);

            if (fs.existsSync(abs)) {
              // Waveform already exists
              const stats = fs.statSync(abs);
              const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
              logger.logInfo(`[SPLIT PAGE]   - Status: EXISTS`, userId);
              logger.logInfo(
                `[SPLIT PAGE]   - Size: ${stats.size} bytes (${fileSizeMB} MB)`,
                userId
              );
              logger.logInfo(
                `[SPLIT PAGE]   - Samples per pixel: ${samples}`,
                userId
              );
              logger.logInfo(
                `[SPLIT PAGE]   - Created: ${stats.birthtime}`,
                userId
              );
              waveformZoomLevels[level] = candidate;
            } else if (sharedInputFile && fs.existsSync(sharedInputFile)) {
              // Track this process
              activeProcesses++;
              const processId = `${level}-${samples}`;
              pendingProcesses.add(processId);
              // Generate waveform on-demand
              logger.logInfo(
                `[SPLIT PAGE]   - Status: GENERATING (does not exist yet)`,
                userId
              );

              // Use the shared input file (either original or transcoded WAV)
              const inputFile = sharedInputFile;

              // Use local audiowaveform binary if available, fallback to system
              const audiowaveformPath = process.env.HOME
                ? `${process.env.HOME}/local/bin/audiowaveform`
                : "audiowaveform";
              const audiowaveformCmd = fs.existsSync(audiowaveformPath)
                ? audiowaveformPath
                : "audiowaveform";
              const cmd = `${audiowaveformCmd} -i ${JSON.stringify(inputFile)} -o ${JSON.stringify(file)} -b 8 -z ${samples}`;
              logger.logInfo(`[SPLIT PAGE]   - Command: ${cmd}`, userId);
              logger.logInfo(
                `[SPLIT PAGE]   - Input file exists: ${fs.existsSync(inputFile)}`,
                userId
              );
              logger.logInfo(
                `[SPLIT PAGE]   - Output directory exists: ${fs.existsSync(path.dirname(file))}`,
                userId
              );

              // Set LD_LIBRARY_PATH so audiowaveform can find local libraries
              const env = {
                ...process.env,
                LD_LIBRARY_PATH: process.env.HOME
                  ? `${process.env.HOME}/local/lib:${process.env.HOME}/local/lib64:${process.env.LD_LIBRARY_PATH || ""}`
                  : process.env.LD_LIBRARY_PATH,
                PATH: process.env.HOME
                  ? `${process.env.HOME}/local/bin:${process.env.PATH}`
                  : process.env.PATH,
              };

              exec(cmd, { env }, (err, stdout, stderr) => {
                // Mark this process as complete
                pendingProcesses.delete(processId);
                activeProcesses--;

                if (err) {
                  logger.logError(
                    `[SPLIT PAGE]   - ERROR: Zoom level ${level} (${samples} samples) generation failed`,
                    err?.message || err,
                    userId
                  );
                  logger.logError(
                    `[SPLIT PAGE]   - stderr: ${stderr || "(none)"}`,
                    null,
                    userId
                  );
                  logger.logError(
                    `[SPLIT PAGE]   - stdout: ${stdout || "(none)"}`,
                    null,
                    userId
                  );
                } else {
                  // Check if file was created
                  const existsNow = fs.existsSync(file);
                  logger.logInfo(
                    `[SPLIT PAGE]   - SUCCESS: Zoom level ${level} (${samples} samples) generated`,
                    userId
                  );
                  logger.logInfo(
                    `[SPLIT PAGE]   - File exists after generation: ${existsNow}`,
                    userId
                  );

                  if (existsNow) {
                    const stats = fs.statSync(file);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    logger.logInfo(
                      `[SPLIT PAGE]   - Generated file: ${fileName}`,
                      userId
                    );
                    logger.logInfo(
                      `[SPLIT PAGE]   - Generated size: ${stats.size} bytes (${fileSizeMB} MB)`,
                      userId
                    );
                    logger.logInfo(
                      `[SPLIT PAGE]   - Samples per pixel: ${samples}`,
                      userId
                    );
                    logger.logInfo(
                      `[SPLIT PAGE]   - Generated at: ${new Date().toISOString()}`,
                      userId
                    );
                  } else {
                    logger.logWarn(
                      `[SPLIT PAGE]   - WARNING: Command succeeded but file does not exist at: ${file}`,
                      userId
                    );
                  }
                }

                // Clean up shared WAV file only when all processes are done
                if (
                  activeProcesses === 0 &&
                  sharedTempWavPath &&
                  fs.existsSync(sharedTempWavPath)
                ) {
                  try {
                    fs.unlinkSync(sharedTempWavPath);
                    logger.logInfo(
                      `[SPLIT PAGE]   - Cleaned up shared temporary WAV file (all processes complete)`,
                      userId
                    );
                  } catch (cleanupErr) {
                    logger.logWarn(
                      `[SPLIT PAGE]   - Failed to clean up shared temp WAV: ${cleanupErr?.message}`,
                      userId
                    );
                  }
                }
              });
              // Include it in the response even though it's generating (will be available on refresh)
              waveformZoomLevels[level] = candidate;
            } else if (!sharedInputFile) {
              logger.logWarn(
                `[SPLIT PAGE]   - SKIPPED: Audio file transcoding failed or file not found: ${audioAbsPath}`,
                userId
              );
            }
          }

          // If no processes were started (all waveforms already exist), clean up immediately
          if (
            activeProcesses === 0 &&
            sharedTempWavPath &&
            fs.existsSync(sharedTempWavPath)
          ) {
            try {
              fs.unlinkSync(sharedTempWavPath);
              logger.logInfo(
                `[SPLIT PAGE]   - Cleaned up shared temporary WAV file (no processes needed)`,
                userId
              );
            } catch (cleanupErr) {
              logger.logWarn(
                `[SPLIT PAGE]   - Failed to clean up shared temp WAV: ${cleanupErr?.message}`,
                userId
              );
            }
          }
          // Otherwise, cleanup will happen in the exec callbacks when all processes complete

          console.log(
            `[SPLIT PAGE] Waveform zoom levels available for client: ${Object.keys(waveformZoomLevels).length}`
          );
          console.log(
            `[SPLIT PAGE] Waveform levels: ${JSON.stringify(Object.keys(waveformZoomLevels))}`
          );
        }
      } catch (e) {
        console.error(
          "[SPLIT PAGE] Error in waveform generation block:",
          e?.message || e
        );
        console.error("[SPLIT PAGE] Error stack:", e?.stack);
        // Continue without waveforms - client will use Web Audio fallback
      }

      console.log(
        `[SPLIT PAGE] After waveform generation, waveformZoomLevels count: ${Object.keys(waveformZoomLevels).length}`
      );

      // Recalculate isSafariLargeFile for template (in case waveform generation block wasn't entered)
      const userAgentForTemplate = req.headers["user-agent"] || "";
      const fileSizeBytesForTemplate = recording.fileSize
        ? Number(recording.fileSize)
        : 0;
      const fileSizeMBForTemplate = fileSizeBytesForTemplate / (1024 * 1024);
      const isLargeFileForTemplate = fileSizeMBForTemplate > 50;
      const isSafariForTemplate = /^((?!chrome|android).)*safari/i.test(
        userAgentForTemplate
      );
      const isSafariLargeFile = isSafariForTemplate && isLargeFileForTemplate;

      // Compute iOS-friendly playback path if available
      let iosPlaybackPath = null;
      try {
        if (recording && recording.filePath) {
          const base = path
            .basename(recording.filePath)
            .replace(/\.[^/.]+$/, "");
          const candidate = `/uploads/recordings/${base}-ios.m4a`;
          const abs = path.join(__dirname, "..", "public", candidate);
          if (fs.existsSync(abs)) {
            iosPlaybackPath = candidate;
          }
        }
      } catch (e) {
        // ignore
      }

      const fullMode = req.query.full === "1";

      // Check if splitting is allowed (band has free pool space OR recording creator has quota space)
      const { canSplitRecording } = require("../utils/storageCalculator");
      const splitCheck = await canSplitRecording(
        setlist.bandId,
        recording.createdById,
        null // No size estimate at this point
      );

      console.log(
        `[SPLIT PAGE] About to render page, waveformZoomLevels:`,
        Object.keys(waveformZoomLevels)
      );
      res.render("setlists/recording-split-peaks-integrated", {
        title: `Split Recording (Peaks.js) - ${setlist.title}`,
        pageTitle: `Split Recording (Peaks.js)`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        useWebAudio: false,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
          fileSize: recording.fileSize,
          waveformPath: recording.waveformPath,
          createdById: recording.createdById,
        },
        waveformZoomLevels,
        isSafariLargeFile, // Pass flag to template so it knows to use single zoom
        iosPlaybackPath,
        fullMode,
        canSplit: splitCheck.allowed,
        splitCheckMessage: splitCheck.message,
        splitCheckReason: splitCheck.reason,
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      console.error(
        `[SPLIT PAGE] ERROR in route handler:`,
        error?.message || error
      );
      console.error(`[SPLIT PAGE] ERROR stack:`, error?.stack);
      logger.logError("Peaks.js integrated recording split page error", error);
      req.flash("error", "Error loading Peaks.js integrated split page");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/recordings/:recordingId/split-web-audio - Peaks.js with Web Audio
router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split-web-audio",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get setlist with all songs
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
        req.flash("error", "Setlist not found");
        return res.redirect("/bands");
      }

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      // Check if splitting is allowed (band has free pool space OR recording creator has quota space)
      const { canSplitRecording } = require("../utils/storageCalculator");
      const splitCheck = await canSplitRecording(
        setlist.bandId,
        recording.createdById,
        null // No size estimate at this point
      );

      res.render("setlists/recording-split-peaks-integrated", {
        title: `Split Recording (Web Audio) - ${setlist.title}`,
        pageTitle: `Split Recording (Web Audio)`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        useWebAudio: true,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
          waveformPath: recording.waveformPath,
          createdById: recording.createdById,
        },
        canSplit: splitCheck.allowed,
        splitCheckMessage: splitCheck.message,
        splitCheckReason: splitCheck.reason,
        hasBandHeader: true,
        band: setlist.band,
        user: req.session.user,
      });
    } catch (error) {
      logger.logError("Get recording split page error", error);
      req.flash("error", "Failed to load split page");
      res.redirect("/bands");
    }
  }
);

router.get(
  "/:bandId/setlists/:setlistId/recordings/:recordingId/split-with-wavesurfer",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const recordingId = parseInt(req.params.recordingId);
      const userId = req.session.user.id;

      // Get setlist with all songs
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
          sets: {
            include: {
              songs: {
                include: {
                  song: true,
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

      if (setlist.bandId !== bandId) {
        req.flash("error", "Setlist does not belong to this band");
        return res.redirect("/bands");
      }

      if (setlist.band.members.length === 0) {
        req.flash("error", "Not authorized");
        return res.redirect("/bands");
      }

      // Get recording from database
      const recording = await prisma.recording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        req.flash("error", "Recording not found");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      if (recording.setlistId !== setlistId) {
        req.flash("error", "Recording does not belong to this setlist");
        return res.redirect(
          `/bands/${bandId}/setlists/${setlistId}/recordings`
        );
      }

      // Calculate total songs count
      const totalSongs = setlist.sets.reduce(
        (total, set) => total + set.songs.length,
        0
      );

      res.render("setlists/recording-split", {
        title: `Split Recording - ${setlist.title}`,
        pageTitle: `Split Recording`,
        marqueeTitle: setlist.title,
        setlist,
        totalSongs,
        recording: {
          id: recording.id,
          filePath: `/uploads/recordings/${path.basename(recording.filePath)}`,
          duration: recording.duration,
        },
        hasBandHeader: true,
        band: setlist.band,
      });
    } catch (error) {
      logger.logError("Recording split page error", error);
      req.flash("error", "Error loading split page");
      res.redirect("/bands");
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/rehearsal - Public rehearsal view
router.get("/:bandId/setlists/:setlistId/rehearsal", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Check for songId in navigation context before clearing
    const {
      getNavigationContext,
      clearNavigationContext,
    } = require("../middleware/navigationContext");
    const navContext = getNavigationContext(req);
    const songIdToScroll = navContext?.songId || null;

    // Clear navigation context when viewing rehearsal (navigation complete)
    clearNavigationContext(req);

    // Validate token for public access
    const isValidToken = await validatePublicToken(
      setlistId,
      token,
      "rehearsal"
    );
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
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
      return res.status(404).send("Setlist not found");
    }

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    // Helper functions for display
    const getLinkIcon = (type) => {
      const icons = {
        youtube: "youtube",
        spotify: "spotify",
        soundcloud: "soundcloud",
        audio: "music-note",
        video: "play-circle",
        chord: "music-note-beamed",
        tab: "music-note-list",
        lyrics: "file-text",
        other: "link-45deg",
      };
      return icons[type] || "link-45deg";
    };

    const getLinkDisplayText = (link) => {
      if (link.title && link.title.trim()) {
        return link.title;
      }
      return link.url;
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
      pageTitle: setlist.title,
      setlist,
      band: setlist.band,
      hasBandHeader: true,
      user: req.session.user || null, // Pass user if logged in, null if not
      token: token || "",
      songIdToScroll, // Pass songId for scrolling
      getLinkIcon,
      getLinkDisplayText,
      getTypeDisplayName,
    });
  } catch (error) {
    logger.logError("Rehearsal view error", error);
    res.status(500).send("Error loading rehearsal view");
  }
});

// GET /bands/:bandId/setlists/:setlistId/listen - Public listen view
router.get("/:bandId/setlists/:setlistId/listen", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const { url, t: token } = req.query;

    // Validate token for public access
    const isValidToken = await validatePublicToken(setlistId, token, "listen");
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
    }

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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    // Fetch the external playlist (keeping the original logic)
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

        switch (hostname) {
          case "www.bagus.org":
          case "bagus.org":
            // Bagus.org format: href="/path/file.wav">Song Title</a><span class="duration">(duration)
            // Updated to handle the actual HTML structure: <a href="/path/file.wav">Title</a><span class="duration">(duration)</span>
            linkRegex =
              /href=["']([^"']+\.(?:mp3|wav|ogg|m4a|flac))["'][^>]*>([^<]+)<\/a><span class="duration">\(([^)]+)\)/gi;
            break;

          default:
            // Generic pattern for most sites
            linkRegex =
              /href=["']([^"']+\.(?:mp3|wav|ogg|m4a|flac))["'][^>]*>([^<]+)<\/a>(?:[^<]*<[^>]*>)*\(([^)]+)\)/gi;
        }

        // Extract audio links
        while ((match = linkRegex.exec(html)) !== null) {
          const [, relativePath, title, duration] = match;
          let fullUrl;

          try {
            fullUrl = new URL(relativePath, baseUrl).href;
          } catch (urlError) {
            console.warn("Invalid URL:", relativePath);
            continue;
          }

          audioLinks.push({
            url: fullUrl,
            title: title.trim(),
            duration: duration.trim(),
          });
        }

        // Create playlistData structure
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
      title: `${setlist.band.name} - ${setlist.title}`,
      setlist,
      band: setlist.band,
      playlistData,
      externalUrl: url,
      hasBandHeader: true,
      user: req.session.user || null, // Pass user if logged in, null if not
    });
  } catch (error) {
    logger.logError("Listen setlist error", error);
    res.status(500).send("Error loading listen page");
  }
});

// GET /bands/:bandId/setlists/:setlistId/print - Public print view (standalone)
router.get("/:bandId/setlists/:setlistId/print", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validatePublicToken(setlistId, token, "print");
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
    }

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
      return res.status(404).send("Setlist not found");
    }

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    res.render("setlists/print", {
      title: `Print ${setlist.title}`,
      setlist,
      layout: false, // Standalone print layout
    });
  } catch (error) {
    logger.logError("Print setlist error", error);
    res.status(500).send("Error loading print page");
  }
});

// GET /bands/:bandId/setlists/:setlistId/gig-view - Public gig view (standalone)
router.get("/:bandId/setlists/:setlistId/gig-view", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validatePublicToken(
      setlistId,
      token,
      "gig-view"
    );
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
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

// POST /bands/:bandId/setlists/:setlistId/preferred-audio - Update preferred audio file for a song
router.post(
  "/:bandId/setlists/:setlistId/preferred-audio",
  requireAuth,
  async (req, res) => {
    try {
      const { songId, audioUrl } = req.body;
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const parsedSongId = parseInt(songId);
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

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update or create BandSong preference
      await prisma.bandSong.upsert({
        where: {
          bandId_songId: {
            bandId: bandId,
            songId: parsedSongId,
          },
        },
        update: {
          audio: audioUrl || null,
          updatedAt: new Date(),
        },
        create: {
          bandId: bandId,
          songId: parsedSongId,
          audio: audioUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      res.json({ success: true, message: "Preferred audio file updated" });
    } catch (error) {
      console.error("Update preferred audio error:", error);
      res.status(500).json({ error: "Failed to update preferred audio file" });
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/preferred-gig-document - Update preferred gig document for a song
router.post(
  "/:bandId/setlists/:setlistId/preferred-gig-document",
  requireAuth,
  async (req, res) => {
    try {
      const { songId, gigDocumentId } = req.body;
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const parsedSongId = parseInt(songId);
      const parsedGigDocumentId = gigDocumentId
        ? parseInt(gigDocumentId)
        : null;
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

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify gig document exists if provided
      if (parsedGigDocumentId) {
        const gigDocument = await prisma.gigDocument.findUnique({
          where: { id: parsedGigDocumentId },
        });
        if (!gigDocument) {
          return res.status(404).json({ error: "Gig document not found" });
        }
      }

      // Update or create BandSong preference
      await prisma.bandSong.upsert({
        where: {
          bandId_songId: {
            bandId: bandId,
            songId: parsedSongId,
          },
        },
        update: {
          gigDocumentId: parsedGigDocumentId,
          updatedAt: new Date(),
        },
        create: {
          bandId: bandId,
          songId: parsedSongId,
          gigDocumentId: parsedGigDocumentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      res.json({ success: true, message: "Preferred gig document updated" });
    } catch (error) {
      console.error("Update preferred gig document error:", error);
      res
        .status(500)
        .json({ error: "Failed to update preferred gig document" });
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/preferred-midi - Update preferred MIDI file for a song
router.post(
  "/:bandId/setlists/:setlistId/preferred-midi",
  requireAuth,
  async (req, res) => {
    try {
      const { songId, midiUrl } = req.body;
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const parsedSongId = parseInt(songId);
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

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update or create BandSong preference
      await prisma.bandSong.upsert({
        where: {
          bandId_songId: {
            bandId: bandId,
            songId: parsedSongId,
          },
        },
        update: {
          midi: midiUrl || null,
          updatedAt: new Date(),
        },
        create: {
          bandId: bandId,
          songId: parsedSongId,
          midi: midiUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      res.json({ success: true, message: "Preferred MIDI file updated" });
    } catch (error) {
      console.error("Update preferred MIDI error:", error);
      res.status(500).json({ error: "Failed to update preferred MIDI file" });
    }
  }
);

// GET /bands/:bandId/setlists/:setlistId/playlist - Public playlist view
router.get("/:bandId/setlists/:setlistId/playlist", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validatePublicToken(
      setlistId,
      token,
      "playlist"
    );
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
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

    // Get band song preferences for audio files
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: bandId },
      select: {
        songId: true,
        audio: true,
      },
    });

    // Create a map of songId -> preferred audio URL
    const audioPreferences = {};
    bandSongs.forEach((bandSong) => {
      if (bandSong.audio) {
        audioPreferences[bandSong.songId] = bandSong.audio;
      }
    });

    if (!setlist) {
      return res.status(404).send("Setlist not found");
    }

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
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

      // Convert to string if it's not already
      const durationString = String(durationStr);

      // Handle formats like "3:45", "1:23:45", "45s", etc.
      const parts = durationString.split(":");

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
      } else if (durationString.includes("s")) {
        // Format: "45s" (seconds only)
        return parseInt(durationString);
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
              console.log("Error getting duration:", err.message);
              resolve(null);
            } else {
              const duration = metadata.format.duration;
              console.log("Duration found:", duration);
              resolve(duration);
            }
          });
        });
      } catch (error) {
        console.log("Error in getAudioDuration:", error.message);
        return null;
      }
    }

    // Process each set
    for (const set of setlist.sets) {
      if (set.name === "Maybe") continue; // Skip Maybe set for now

      let setTime = 0;

      for (const setlistSong of set.songs) {
        if (setlistSong.song.links && setlistSong.song.links.length > 0) {
          const songData = {
            song: setlistSong.song,
            set: set.name,
            order: setlistSong.order,
            duration: null,
            durationSeconds: null,
            preferredAudioUrl: null,
          };

          // Try to parse duration from the time field first
          if (setlistSong.song.time) {
            const parsedDuration = parseDurationToSeconds(
              setlistSong.song.time
            );
            if (parsedDuration) {
              songData.duration = Math.round(parsedDuration);
              songData.durationSeconds = Math.round(parsedDuration);
              setTime += Math.round(parsedDuration);
              totalTime += Math.round(parsedDuration);
            }
          }

          // Determine which audio file to use (preferred or first)
          let audioUrl = null;
          const preferredAudioUrl = audioPreferences[setlistSong.song.id];

          if (preferredAudioUrl) {
            // Find the preferred audio link
            const preferredLink = setlistSong.song.links.find(
              (link) => link.url === preferredAudioUrl
            );
            if (preferredLink) {
              audioUrl = preferredLink.url;
              songData.preferredAudioUrl = preferredLink.url;
            }
          }

          // Fall back to first audio link if no preference or preferred link not found
          if (!audioUrl) {
            audioUrl = setlistSong.song.links[0].url;
            songData.preferredAudioUrl = setlistSong.song.links[0].url;
          }

          // If no duration from time field, try to get it from the selected audio link
          if (!songData.duration && audioUrl) {
            const duration = await getAudioDuration(audioUrl);
            if (duration) {
              songData.duration = Math.round(duration);
              songData.durationSeconds = Math.round(duration);
              setTime += Math.round(duration);
              totalTime += Math.round(duration);
            }
          }

          if (set.name === "Maybe") {
            maybeSetSongs.push(songData);
            maybeTime += songData.duration || 0;
          } else {
            numberedSetSongs.push(songData);
          }
        }
      }

      setTotals[set.name] = setTime;
    }

    // Process Maybe set separately
    const maybeSet = setlist.sets.find((s) => s.name === "Maybe");
    if (maybeSet) {
      for (const setlistSong of maybeSet.songs) {
        if (setlistSong.song.links && setlistSong.song.links.length > 0) {
          const songData = {
            song: setlistSong.song,
            set: "Maybe",
            order: setlistSong.order,
            duration: null,
            durationSeconds: null,
            preferredAudioUrl: null,
          };

          // Try to parse duration from the time field first
          if (setlistSong.song.time) {
            const parsedDuration = parseDurationToSeconds(
              setlistSong.song.time
            );
            if (parsedDuration) {
              songData.duration = Math.round(parsedDuration);
              songData.durationSeconds = Math.round(parsedDuration);
              maybeTime += Math.round(parsedDuration);
              totalTime += Math.round(parsedDuration);
            }
          }

          // Determine which audio file to use (preferred or first)
          let audioUrl = null;
          const preferredAudioUrl = audioPreferences[setlistSong.song.id];

          if (preferredAudioUrl) {
            // Find the preferred audio link
            const preferredLink = setlistSong.song.links.find(
              (link) => link.url === preferredAudioUrl
            );
            if (preferredLink) {
              audioUrl = preferredLink.url;
              songData.preferredAudioUrl = preferredLink.url;
            }
          }

          // Fall back to first audio link if no preference or preferred link not found
          if (!audioUrl) {
            audioUrl = setlistSong.song.links[0].url;
            songData.preferredAudioUrl = setlistSong.song.links[0].url;
          }

          // If no duration from time field, try to get it from the selected audio link
          if (!songData.duration && audioUrl) {
            const duration = await getAudioDuration(audioUrl);
            if (duration) {
              songData.duration = Math.round(duration);
              songData.durationSeconds = Math.round(duration);
              maybeTime += Math.round(duration);
              totalTime += Math.round(duration);
            }
          }

          maybeSetSongs.push(songData);
        }
      }
    }

    // Combine all songs (numbered sets first, then maybe)
    audioSongs.push(...numberedSetSongs, ...maybeSetSongs);

    res.render("setlists/playlist", {
      title: `Playlist - ${setlist.title}`,
      pageTitle: setlist.title,
      setlist,
      band: setlist.band,
      hasBandHeader: true,
      audioSongs,
      setTotals,
      totalTime,
      maybeTime,
      user: req.session.user || null,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    logger.logError("Playlist view error", error);
    res.status(500).send("Error loading playlist view");
  }
});

// GET /bands/:bandId/setlists/:setlistId/youtube-playlist - Public YouTube playlist view
router.get(
  "/:bandId/setlists/:setlistId/youtube-playlist",
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const token = req.query.t;

      // Validate token for public access
      const isValidToken = await validatePublicToken(
        setlistId,
        token,
        "youtube-playlist"
      );
      if (!isValidToken) {
        return res.status(403).send("Access denied. Valid token required.");
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

      // Verify the setlist belongs to the specified band
      if (setlist.band.id !== bandId) {
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
        pageTitle: `YouTube Playlist - ${setlist.title}`,
        setlist,
        band: setlist.band,
        youtubeLinks,
        user: req.session.user || null,
      });
    } catch (error) {
      logger.logError("YouTube playlist error", error);
      res.status(500).send("Error loading YouTube playlist");
    }
  }
);

// Helper function to extract YouTube video ID from URL
function extractYouTubeVideoId(url) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// GET /bands/:bandId/setlists/:setlistId/midi - Public MIDI playlist view
router.get("/:bandId/setlists/:setlistId/midi", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validatePublicToken(setlistId, token, "midi");
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
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
                    links: {
                      where: { type: "midi" },
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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    // Load BandSong preferences for the band
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
      select: {
        songId: true,
        midi: true,
      },
    });

    // Create a map of songId -> preferred MIDI URL
    const bandSongMap = {};
    bandSongs.forEach((bandSong) => {
      if (bandSong.midi) {
        bandSongMap[bandSong.songId] = { midi: bandSong.midi };
      }
    });

    // Collect MIDI links using preferred links when available
    const midiLinks = [];

    setlist.sets.forEach((set) => {
      if (set.songs && set.name !== "Maybe") {
        set.songs.forEach((setlistSong) => {
          if (
            setlistSong.song &&
            setlistSong.song.links &&
            setlistSong.song.links.length > 0
          ) {
            const songId = setlistSong.song.id;
            const bandSong = bandSongMap[songId];

            // Get available MIDI links
            const availableMidiLinks = setlistSong.song.links.filter(
              (link) => link.type === "midi"
            );

            if (availableMidiLinks.length > 0) {
              let selectedLink = null;

              // Use preferred MIDI link if available
              if (bandSong?.midi) {
                selectedLink = availableMidiLinks.find(
                  (link) => link.url === bandSong.midi
                );
              }

              // Fallback to first available if no preference or preferred not found
              if (!selectedLink) {
                selectedLink = availableMidiLinks[0];
              }

              if (selectedLink) {
                midiLinks.push({
                  songTitle: setlistSong.song.title,
                  artist:
                    setlistSong.song.artists &&
                    setlistSong.song.artists.length > 0
                      ? setlistSong.song.artists[0].artist.name
                      : null,
                  set: set.name,
                  order: setlistSong.order,
                  url: selectedLink.url,
                  description: selectedLink.description || "MIDI File",
                });
              }
            }
          }
        });
      }
    });

    res.render("setlists/midi-playlist", {
      title: `MIDI Playlist - ${setlist.title}`,
      pageTitle: `MIDI Playlist - ${setlist.title}`,
      setlist,
      band: setlist.band,
      midiLinks,
      user: req.session.user || null,
    });
  } catch (error) {
    logger.logError("MIDI playlist error", error);
    res.status(500).send("Error loading MIDI playlist");
  }
});

// GET /bands/:bandId/setlists/:setlistId/leadsheets - Public leadsheet playlist view
router.get("/:bandId/setlists/:setlistId/leadsheets", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validatePublicToken(
      setlistId,
      token,
      "leadsheets"
    );
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
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
                    links: {
                      where: { type: "pdf" },
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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      return res.status(404).send("Setlist not found");
    }

    // Load BandSong preferences for the band
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: setlist.band.id },
      select: {
        songId: true,
        leadsheet: true,
      },
    });

    // Create a map of songId -> preferred leadsheet URL
    const bandSongMap = {};
    bandSongs.forEach((bandSong) => {
      if (bandSong.leadsheet) {
        bandSongMap[bandSong.songId] = { leadsheet: bandSong.leadsheet };
      }
    });

    // Collect leadsheet links using preferred links when available
    const leadsheetLinks = [];

    setlist.sets.forEach((set) => {
      if (set.songs && set.name !== "Maybe") {
        set.songs.forEach((setlistSong) => {
          if (
            setlistSong.song &&
            setlistSong.song.links &&
            setlistSong.song.links.length > 0
          ) {
            const songId = setlistSong.song.id;
            const bandSong = bandSongMap[songId];

            // Get available leadsheet links
            const availableLeadsheetLinks = setlistSong.song.links.filter(
              (link) => link.type === "pdf"
            );

            if (availableLeadsheetLinks.length > 0) {
              let selectedLink = null;

              // Use preferred leadsheet link if available
              if (bandSong?.leadsheet) {
                selectedLink = availableLeadsheetLinks.find(
                  (link) => link.url === bandSong.leadsheet
                );
              }

              // Fallback to first available if no preference or preferred not found
              if (!selectedLink) {
                selectedLink = availableLeadsheetLinks[0];
              }

              if (selectedLink) {
                leadsheetLinks.push({
                  songTitle: setlistSong.song.title,
                  artist:
                    setlistSong.song.artists &&
                    setlistSong.song.artists.length > 0
                      ? setlistSong.song.artists[0].artist.name
                      : null,
                  set: set.name,
                  order: setlistSong.order,
                  url: selectedLink.url,
                  description: selectedLink.description || "Lead Sheet",
                });
              }
            }
          }
        });
      }
    });

    res.render("setlists/leadsheet-playlist", {
      title: `Lead Sheets - ${setlist.title}`,
      pageTitle: `Lead Sheets - ${setlist.title}`,
      setlist,
      band: setlist.band,
      leadsheetLinks,
      user: req.session.user || null,
    });
  } catch (error) {
    logger.logError("Leadsheet playlist error", error);
    res.status(500).send("Error loading leadsheet playlist");
  }
});

// GET /bands/:bandId/setlists/:setlistId/leadsheets/print - Print-friendly leadsheet view
router.get(
  "/:bandId/setlists/:setlistId/leadsheets/print",
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);

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
                        where: { type: "pdf" },
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

      // Verify the setlist belongs to the specified band
      if (setlist.band.id !== bandId) {
        return res.status(404).send("Setlist not found");
      }

      // Load BandSong preferences for the band
      const bandSongs = await prisma.bandSong.findMany({
        where: { bandId: setlist.band.id },
        select: {
          songId: true,
          leadsheet: true,
        },
      });

      // Create a map of songId -> preferred leadsheet URL
      const bandSongMap = {};
      bandSongs.forEach((bandSong) => {
        if (bandSong.leadsheet) {
          bandSongMap[bandSong.songId] = { leadsheet: bandSong.leadsheet };
        }
      });

      // Collect leadsheet links using preferred links when available
      const leadsheetLinks = [];

      setlist.sets.forEach((set) => {
        if (set.songs && set.name !== "Maybe") {
          set.songs.forEach((setlistSong) => {
            if (
              setlistSong.song &&
              setlistSong.song.links &&
              setlistSong.song.links.length > 0
            ) {
              const songId = setlistSong.song.id;
              const bandSong = bandSongMap[songId];

              // Get available leadsheet links
              const availableLeadsheetLinks = setlistSong.song.links.filter(
                (link) => link.type === "pdf"
              );

              if (availableLeadsheetLinks.length > 0) {
                let selectedLink = null;

                // Use preferred leadsheet link if available
                if (bandSong?.leadsheet) {
                  selectedLink = availableLeadsheetLinks.find(
                    (link) => link.url === bandSong.leadsheet
                  );
                }

                // Fallback to first available if no preference or preferred not found
                if (!selectedLink) {
                  selectedLink = availableLeadsheetLinks[0];
                }

                if (selectedLink) {
                  leadsheetLinks.push({
                    songTitle: setlistSong.song.title,
                    artist:
                      setlistSong.song.artists &&
                      setlistSong.song.artists.length > 0
                        ? setlistSong.song.artists[0].artist.name
                        : null,
                    set: set.name,
                    order: setlistSong.order,
                    url: selectedLink.url,
                    description: selectedLink.description || "Lead Sheet",
                  });
                }
              }
            }
          });
        }
      });

      res.render("setlists/leadsheet-print", {
        title: `Lead Sheets - ${setlist.title} - Print`,
        pageTitle: `Lead Sheets - ${setlist.title}`,
        setlist,
        band: setlist.band,
        leadsheetLinks,
        user: req.session.user || null,
      });
    } catch (error) {
      logger.logError("Leadsheet print error", error);
      res.status(500).send("Error loading leadsheet print view");
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/preferred-leadsheet - Update preferred leadsheet for a song
router.post(
  "/:bandId/setlists/:setlistId/preferred-leadsheet",
  requireAuth,
  async (req, res) => {
    try {
      const { songId, leadsheetUrl } = req.body;
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const parsedSongId = parseInt(songId);
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

      if (setlist.band.members.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update or create BandSong preference
      await prisma.bandSong.upsert({
        where: {
          bandId_songId: {
            bandId: bandId,
            songId: parsedSongId,
          },
        },
        update: {
          leadsheet: leadsheetUrl || null,
          updatedAt: new Date(),
        },
        create: {
          bandId: bandId,
          songId: parsedSongId,
          leadsheet: leadsheetUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      res.json({ success: true, message: "Preferred leadsheet updated" });
    } catch (error) {
      console.error("Update preferred leadsheet error:", error);
      res.status(500).json({ error: "Failed to update preferred leadsheet" });
    }
  }
);

// AUTHENTICATED ROUTES (authentication required)
router.use(requireAuth);

// POST /bands/:bandId/setlists/:setlistId/save-recordings-url - Save recordings URL for a setlist
router.post(
  "/:bandId/setlists/:setlistId/save-recordings-url",
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
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

      // Verify the setlist belongs to the specified band
      if (setlist.bandId !== bandId) {
        return res.status(404).json({ error: "Setlist not found" });
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
  }
);

// GET /bands/:bandId/setlists/:setlistId/edit - Show setlist edit page with drag-drop
router.get("/:bandId/setlists/:setlistId/edit", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      req.flash("error", "Setlist not found or access denied");
      return res.redirect("/bands");
    }

    // Check if user is a member of this band
    if (setlist.band.members.length === 0) {
      req.flash("error", "Access denied");
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
      return res.redirect(`/bands/${bandId}/setlists/${setlistId}`);
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
      band: setlist.band,
      bandId: bandId,
      hasBandHeader: true,
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

// GET /bands/:bandId/setlists/:setlistId/copy - Show copy setlist form
router.get("/:bandId/setlists/:setlistId/copy", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      req.flash("error", "Setlist not found or access denied");
      return res.redirect("/bands");
    }

    // Check if user is a member of this band
    if (setlist.band.members.length === 0) {
      req.flash("error", "Access denied");
      return res.redirect("/bands");
    }

    res.render("setlists/copy", {
      title: `Copy ${setlist.title}`,
      setlist,
      hasBandHeader: true,
      band: setlist.band,
    });
  } catch (error) {
    logger.logError("Copy setlist error", error);
    req.flash("error", "An error occurred loading the setlist copy form");
    res.redirect("/bands");
  }
});

// GET /bands - List all bands for the user
router.get("/", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bands = await prisma.band.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        isPublic: true,
        updatedAt: true,
        members: {
          where: {
            userId: userId,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.render("bands/index", {
      title: "My Bands",
      pageTitle: "My Bands",
      bands,
    });
  } catch (error) {
    console.error("Bands index error:", error);
    req.flash("error", "An error occurred loading bands");
    res.redirect("/");
  }
});

// GET /bands/new - Show create band form
router.get("/new", (req, res) => {
  res.render("bands/new", { title: "Create Band" });
});

// Check slug availability (for EPK builder)
router.get("/:id/slug/check", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const { slug } = req.query;
    const { validateSlug, isReservedSlug } = require("../utils/slugify");

    // Validate format
    const validation = validateSlug(slug);
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }

    // Check if already in use by another band
    const existingBand = await prisma.band.findFirst({
      where: {
        slug,
        NOT: { id: bandId },
      },
    });

    if (existingBand) {
      return res.json({
        available: false,
        error: "This slug is already taken by another band",
      });
    }

    res.json({ available: true });
  } catch (error) {
    console.error("Error checking slug:", error);
    res.status(500).json({ available: false, error: "Server error" });
  }
});

// POST /bands - Create a new band
router.post(
  "/",
  requireAuth,
  checkBandLimit,
  [
    body("name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Band name is required"),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("bands/new", {
          title: "Create Band",
          errors: errors.array(),
          name: req.body.name,
          description: req.body.description,
        });
      }

      const { name, description } = req.body;
      const userId = req.session.user.id;
      const { generateUniqueSlug } = require("../utils/slugify");

      // Create band and add creator as owner in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Auto-generate slug from band name
        const slug = await generateUniqueSlug(tx, name);

        const band = await tx.band.create({
          data: {
            name,
            description,
            slug, // Auto-generated
            isPublic: false, // Private by default
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.bandMember.create({
          data: {
            bandId: band.id,
            userId,
            role: "owner",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return band;
      });

      const band = result;

      req.flash(
        "success",
        "Band created successfully! The next thing to do is to add some songs your band might play using any of the 4 methods mentioned below."
      );
      res.redirect(`/bands/${band.id}`);
    } catch (error) {
      console.error("Create band error:", error);
      req.flash("error", "An error occurred creating the band");
      res.redirect("/bands/new");
    }
  }
);

// GET /bands/:id - Show band details
router.get("/:id", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Check if user is a member
    const isMember = band.members.some((member) => member.user.id === userId);
    if (!isMember) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get setlists
    const setlists = await prisma.setlist.findMany({
      where: { bandId: parseInt(bandId) },
      orderBy: { updatedAt: "desc" },
    });

    // Get band songs with includes
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: parseInt(bandId) },
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
        song: {
          title: "asc",
        },
      },
    });

    // Get band venues (latest 3)
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    // Get upcoming gigs (next 3)
    const upcomingGigs = await prisma.gig.findMany({
      where: {
        bandId: parseInt(bandId),
        gigDate: {
          gte: new Date(),
        },
      },
      include: {
        venue: true,
      },
      orderBy: {
        gigDate: "asc",
      },
      take: 3,
    });

    // Get open opportunities with latest interactions
    const openOpportunities = await prisma.opportunity.findMany({
      where: {
        bandId: parseInt(bandId),
        status: {
          not: "BOOKED",
        },
      },
      include: {
        venue: true,
        interactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });

    // Get pending invitations (not used, not expired)
    let pendingInvitations = [];
    try {
      0;
      pendingInvitations = await prisma.bandInvitation.findMany({
        where: {
          bandId: parseInt(bandId),
          used_at: null,
          expires_at: { gt: new Date() },
        },
        include: {
          inviter: {
            select: {
              username: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (associationError) {
      console.error(
        `[${new Date().toISOString()}] Association error, falling back to basic query:`,
        associationError
      );
      // Fallback: get invitations without the association
      pendingInvitations = await prisma.bandInvitation.findMany({
        where: {
          bandId: parseInt(bandId),
          used_at: null,
          expires_at: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
      console.log(
        `[${new Date().toISOString()}] Fallback query loaded ${pendingInvitations.length} pending invitations`
      );
    }

    // Get albums for this band
    const albums = await prisma.album.findMany({
      where: { bandId: parseInt(bandId) },
      orderBy: {
        releaseDate: "desc",
      },
    });

    // Get storage info for this band (pooled from all Pro members)
    const {
      getBandStorageInfo,
      calculateUserStorageUsage,
      updateBandStorageUsage,
    } = require("../utils/storageCalculator");

    const bandStorageInfo = await getBandStorageInfo(parseInt(bandId));
    const userStorageInfo = await calculateUserStorageUsage(userId);

    // Check if user is over quota (to disable buttons)
    const { isUserOverQuota } = require("../utils/storageCalculator");
    const quotaStatus = await isUserOverQuota(userId);

    // Check if user can create more albums
    const { canPublishAlbum } = require("../utils/subscriptionHelper");
    const albumLimitInfo = await canPublishAlbum(userId, parseInt(bandId));

    res.render("bands/show", {
      title: band.name,
      hasBandHeader: true,
      band,
      setlists,
      albums,
      bandSongs,
      bandVenues,
      upcomingGigs,
      openOpportunities,
      pendingInvitations,
      userId,
      bandStorageInfo,
      userStorageInfo,
      albumLimitInfo,
      quotaStatus,
    });
  } catch (error) {
    console.error("Show band error:", error);
    req.flash("error", "An error occurred loading the band");
    res.redirect("/bands");
  }
});

// GET /bands/:id/edit - Show edit band form
router.get("/:id/edit", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        photos: {
          orderBy: { sortOrder: "asc" },
        },
        videos: {
          orderBy: { sortOrder: "asc" },
        },
        audioSamples: {
          orderBy: { sortOrder: "asc" },
        },
        logos: {
          orderBy: { sortOrder: "asc" },
        },
        pressQuotes: {
          orderBy: { sortOrder: "asc" },
        },
        socialLinks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Check if user is a member
    const isMember = band.members.some((member) => member.user.id === userId);
    if (!isMember) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    res.render("bands/edit", {
      title: `Edit ${band.name}`,
      band,
      hasBandHeader: true,
    });
  } catch (error) {
    logger.logError("Edit band error", error);
    req.flash("error", "An error occurred loading the band");
    res.redirect("/bands");
  }
});

// POST /bands/:id/update - Update band information
router.post(
  "/:id/update",
  [
    body("name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Band name is required"),
    body("description").optional().trim(),
    body("websiteUrl")
      .optional()
      .isURL()
      .withMessage("Website URL must be a valid URL"),
    body("epkUrl")
      .optional()
      .isURL()
      .withMessage("EPK URL must be a valid URL"),
    body("bookingPitch").optional().trim(),
    body("contactName").optional().trim(),
    body("contactEmail")
      .optional()
      .isEmail()
      .withMessage("Contact email must be a valid email"),
    body("contactPhone").optional().trim(),
  ],
  async (req, res) => {
    try {
      const bandId = req.params.id;
      const userId = req.session.user.id;

      // Verify band exists and user is a member
      const band = await prisma.band.findUnique({
        where: { id: parseInt(bandId) },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      const isMember = band.members.some((member) => member.user.id === userId);
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("bands/edit", {
          title: `Edit ${band.name}`,
          band,
          errors: errors.array(),
          name: req.body.name,
          description: req.body.description,
          websiteUrl: req.body.websiteUrl,
          epkUrl: req.body.epkUrl,
          bookingPitch: req.body.bookingPitch,
          contactName: req.body.contactName,
          contactEmail: req.body.contactEmail,
          contactPhone: req.body.contactPhone,
        });
      }

      const {
        name,
        description,
        websiteUrl,
        epkUrl,
        bookingPitch,
        contactName,
        contactEmail,
        contactPhone,
      } = req.body;

      // Update the band
      await prisma.band.update({
        where: { id: parseInt(bandId) },
        data: {
          name,
          description,
          websiteUrl: websiteUrl || null,
          epkUrl: epkUrl || null,
          bookingPitch: bookingPitch || null,
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Band updated successfully!");
      res.redirect(`/bands/${bandId}`);
    } catch (error) {
      logger.logError("Update band error", error);
      req.flash("error", "An error occurred updating the band");
      res.redirect(`/bands/${req.params.id}/edit`);
    }
  }
);

// POST /bands/:id/setlists - Create a new setlist for the band
router.post(
  "/:id/setlists",
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
      const bandId = req.params.id;
      const userId = req.session.user.id;

      // Check if user is a member
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId },
      });

      if (!membership) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/bands/${bandId}`);
      }

      const { title, date } = req.body;

      // Create setlist and default sets in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const setlist = await tx.setlist.create({
          data: {
            title,
            bandId: parseInt(bandId),
            createdById: req.session.user.id,
            date: date ? new Date(date) : null,
            shareTokens: generateShareTokens(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create default sets
        const setNames = ["Set_1", "Set_2", "Set_3", "Set_4", "Maybe"];
        for (let i = 0; i < setNames.length; i++) {
          await tx.setlistSet.create({
            data: {
              setlistId: setlist.id,
              name: setNames[i],
              order: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        return setlist;
      });

      const setlist = result;

      // Check if band has any songs
      const bandSongCount = await prisma.bandSong.count({
        where: { bandId: parseInt(bandId) },
      });

      req.flash("success", "Setlist created successfully!");

      // If no songs, redirect to show view (for recording)
      // If has songs, redirect to edit view (for building setlist)
      if (bandSongCount === 0) {
        res.redirect(`/bands/${bandId}/setlists/${setlist.id}`);
      } else {
        res.redirect(`/bands/${bandId}/setlists/${setlist.id}/edit`);
      }
    } catch (error) {
      console.error("Create setlist error:", error);
      req.flash("error", "An error occurred creating the setlist");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// POST /bands/:id/invite - Send email invitation to join the band
router.post(
  "/:id/invite",
  [body("email").isEmail().withMessage("Please enter a valid email")],
  async (req, res) => {
    try {
      const bandId = req.params.id;
      const userId = req.session.user.id;
      const { email } = req.body;

      // Check if user is owner of the band
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId, role: "owner" },
      });

      if (!membership) {
        req.flash("error", "Only band owners can invite members");
        return res.redirect(`/bands/${bandId}`);
      }

      // Get band details
      const band = await prisma.band.findUnique({
        where: { id: parseInt(bandId) },
      });
      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      // Check if user already exists and handle accordingly
      const existingUser = await prisma.user.findFirst({ where: { email } });
      if (existingUser) {
        const existingMembership = await prisma.bandMember.findFirst({
          where: { bandId: parseInt(bandId), userId: existingUser.id },
        });

        if (existingMembership) {
          req.flash("error", "This person is already a member of the band");
          return res.redirect(`/bands/${bandId}`);
        }

        // User exists but is not a member of this band - add them automatically
        await prisma.bandMember.create({
          data: {
            bandId: parseInt(bandId),
            userId: existingUser.id,
            role: "member",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Get inviter name
        const inviter = await prisma.user.findUnique({
          where: { id: userId },
        });

        // Send notification email to existing user
        const emailSent = await sendBandInvitationNotification(
          null,
          band,
          inviter.username,
          existingUser.email
        );

        if (emailSent) {
          req.flash(
            "success",
            `${email} has been added to the band! A notification email has been sent.`
          );
        } else {
          req.flash(
            "success",
            `${email} has been added to the band! (Email notification failed)`
          );
        }

        return res.redirect(`/bands/${bandId}`);
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.bandInvitation.findFirst({
        where: {
          bandId: parseInt(bandId),
          email,
          used_at: null,
          expires_at: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        req.flash(
          "error",
          "An invitation has already been sent to this email address"
        );
        return res.redirect(`/bands/${bandId}`);
      }

      // Create invitation
      const invitation = await prisma.bandInvitation.create({
        data: {
          id: uuidv4(),
          bandId: parseInt(bandId),
          email,
          token: uuidv4(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          invitedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Get inviter name
      const inviter = await prisma.user.findUnique({
        where: { id: userId },
      });

      // Send email
      const emailSent = await sendBandInvitation(
        invitation,
        band,
        inviter.username
      );

      if (emailSent) {
        req.flash(
          "success",
          `Invitation sent to ${email}! They have 7 days to accept.`
        );
      } else {
        req.flash(
          "error",
          "Failed to send invitation email. Please check your email configuration."
        );
      }

      res.redirect(`/bands/${bandId}`);
    } catch (error) {
      console.error("Invite member error:", error);
      req.flash("error", "An error occurred sending the invitation");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// GET /bands/:id/songs - Show band's songs with checkboxes
router.get("/:id/songs", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    // Check if referrer is a setlist edit page
    const referrer = req.get("Referer");
    let fromSetlist = null;

    if (referrer) {
      // Look for setlist edit URL pattern: /bands/:bandId/setlists/:setlistId/edit
      const setlistEditMatch = referrer.match(
        /\/bands\/(\d+)\/setlists\/(\d+)\/edit/
      );
      if (setlistEditMatch) {
        const setlistId = setlistEditMatch[2];
        // Verify the setlist exists and belongs to this band
        const setlist = await prisma.setlist.findFirst({
          where: { id: parseInt(setlistId), bandId: parseInt(bandId) },
        });
        if (setlist) {
          fromSetlist = {
            id: setlist.id,
            title: setlist.title,
          };
        }
      }
    }

    // Get all songs with privacy filtering
    const allSongs = await prisma.song.findMany({
      where: {
        OR: [
          { private: false }, // Show all public songs
          { private: true, createdById: userId }, // Show private songs only if user owns them
        ],
      },
      include: {
        vocalist: true,
        artists: {
          include: {
            artist: true,
          },
        },
        gigDocuments: true,
        links: true,
        creator: true, // Include creator info for display
      },
      orderBy: { title: "asc" },
    });

    // Get band's current songs
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        song: {
          include: {
            vocalist: true,
            artists: {
              include: {
                artist: true,
              },
            },
          },
        },
      },
    });

    const bandSongIds = bandSongs.map((bs) => bs.songId);

    res.render("bands/songs", {
      pageTitle: `${band.name} Song Manager`,
      band,
      hasBandHeader: false,
      allSongs,
      bandSongIds,
      fromSetlist,
    });
  } catch (error) {
    console.error("Band songs error:", error);
    req.flash("error", "An error occurred loading band songs");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// GET /bands/:id/songs/find-matches - Find similar songs for smart creation
router.get("/:id/songs/find-matches", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { title, artist } = req.query;

    // Check band membership
    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Song title is required" });
    }

    // Use the existing findSongMatches function
    const matches = await findSongMatches(
      title.trim(),
      artist ? artist.trim() : "",
      userId
    );

    // Check subscription for private song creation
    const { canCreatePrivateSongs } = require("../utils/subscriptionHelper");
    const privateCheck = await canCreatePrivateSongs(userId);

    res.json({
      success: true,
      matches: matches,
      canMakePrivate: privateCheck.allowed,
    });
  } catch (error) {
    logger.logError("Find song matches error", error);
    res.status(500).json({ error: "Failed to find song matches" });
  }
});

// POST /bands/:id/songs/quick-add - Quick add song with just title (for recording splits)
router.post("/:id/songs/quick-add", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { title, artist, isPrivate } = req.body;

    // Check band membership
    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Song title is required" });
    }

    // Check if song already exists (case-insensitive)
    const existingSong = await prisma.song.findFirst({
      where: {
        title: {
          equals: title.trim(),
          mode: "insensitive",
        },
      },
    });

    let song;
    let isExisting = false;

    if (existingSong) {
      song = existingSong;
      isExisting = true;

      // Check if already in band
      const existingBandSong = await prisma.bandSong.findFirst({
        where: {
          bandId: bandId,
          songId: existingSong.id,
        },
      });

      if (!existingBandSong) {
        // Add to band
        await prisma.bandSong.create({
          data: {
            bandId: bandId,
            songId: existingSong.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    } else {
      // Handle artist if provided
      let artistId = null;
      if (artist && artist.trim()) {
        // Find or create artist
        let existingArtist = await prisma.artist.findFirst({
          where: {
            name: {
              equals: artist.trim(),
              mode: "insensitive",
            },
          },
        });

        if (!existingArtist) {
          existingArtist = await prisma.artist.create({
            data: {
              name: artist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        artistId = existingArtist.id;
      }

      // Create new song
      song = await prisma.song.create({
        data: {
          title: title.trim(),
          createdById: userId,
          private: isPrivate === "true" || isPrivate === true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Add artist if provided
      if (artistId) {
        await prisma.songArtist.create({
          data: {
            songId: song.id,
            artistId: artistId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Add to band
      await prisma.bandSong.create({
        data: {
          bandId: bandId,
          songId: song.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      songId: song.id,
      title: song.title,
      isExisting,
    });
  } catch (error) {
    logger.logError("Quick add song error", error);
    res.status(500).json({ error: "Failed to add song" });
  }
});

// POST /bands/:id/songs/new - Process new song creation
router.post("/:id/songs/new", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const {
      title,
      artist,
      vocalist,
      key,
      minutes,
      seconds,
      bpm,
      style,
      makePrivate,
      content,
      docType,
      linkType,
      linkUrl,
      linkDescription,
    } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!title || !title.trim()) {
      req.flash("error", "Song title is required");
      return res.redirect(`/bands/${bandId}/songs/new`);
    }

    // Create or find artist if provided (case-insensitive)
    let artistId = null;
    if (artist && artist.trim()) {
      // First try to find existing artist (case-insensitive)
      const existingArtist = await prisma.artist.findFirst({
        where: {
          name: {
            equals: artist.trim(),
            mode: "insensitive",
          },
        },
      });

      if (existingArtist) {
        artistId = existingArtist.id;
      } else {
        // Create new artist if not found
        const artistRecord = await prisma.artist.create({
          data: {
            name: artist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        artistId = artistRecord.id;
      }
    }

    // Check if song with same title and artist already exists
    let song;
    let isExistingSong = false;

    if (artistId) {
      // Look for existing song with same title and artist (case insensitive)
      const existingSong = await prisma.song.findFirst({
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
            { private: true, createdById: userId }, // Only check same user's private songs
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

      if (existingSong) {
        song = existingSong;
        isExistingSong = true;
      }
    } else {
      // Look for existing song with same title and no artist (case insensitive)
      const existingSong = await prisma.song.findFirst({
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
            { private: true, createdById: userId }, // Only check same user's private songs
          ],
        },
      });

      if (existingSong) {
        song = existingSong;
        isExistingSong = true;
      }
    }

    // Create new song if it doesn't exist
    if (!song) {
      // Handle vocalist
      let vocalistId = null;
      if (vocalist && vocalist.trim()) {
        let existingVocalist = await prisma.vocalist.findFirst({
          where: { name: { equals: vocalist.trim(), mode: "insensitive" } },
        });

        if (!existingVocalist) {
          existingVocalist = await prisma.vocalist.create({
            data: {
              name: vocalist.trim(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        vocalistId = existingVocalist.id;
      }

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
          "C#m": "C_m",
          Dm: "Dm",
          "D#m": "D_m",
          Ebm: "Ebm",
          Em: "Em",
          Fm: "Fm",
          "F#m": "F_m",
          Gm: "Gm",
          "G#m": "G_m",
          Am: "Am",
          "A#m": "A_m",
          Bbm: "Bbm",
          Bm: "Bm",
          Cm: "Cm",
        };
        enumKey = keyMap[key] || null;
      }

      // Calculate total time in seconds
      const totalTime =
        (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
      const bpmValue = bpm && bpm.trim() ? parseInt(bpm) : null;

      // Check if user can make private songs (subscription-based)
      const { canCreatePrivateSongs } = require("../utils/subscriptionHelper");
      const privateCheck = await canCreatePrivateSongs(userId);

      const isPrivate = privateCheck.allowed && makePrivate === "true";

      song = await prisma.song.create({
        data: {
          title: title.trim(),
          createdById: userId,
          vocalistId: vocalistId,
          key: enumKey,
          time: totalTime || null,
          bpm: bpmValue,
          style: style && style.trim() ? style.trim() : null,
          private: isPrivate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Add artist relationship if artist was provided
      if (artistId) {
        await prisma.songArtist.create({
          data: {
            songId: song.id,
            artistId: artistId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Add song to band (check if relationship already exists)
    const existingBandSong = await prisma.bandSong.findFirst({
      where: {
        bandId: bandId,
        songId: song.id,
      },
    });

    if (!existingBandSong) {
      await prisma.bandSong.create({
        data: {
          bandId: bandId,
          songId: song.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create gig document if content was provided
    if (content && content.trim() && docType) {
      // Find the next available version for this song and document type
      const existingDocs = await prisma.gigDocument.findMany({
        where: {
          songId: song.id,
          type: docType,
        },
        orderBy: {
          version: "desc",
        },
      });

      let docVersion = 1;
      if (existingDocs.length > 0) {
        docVersion = existingDocs[0].version + 1;
      }

      await prisma.gigDocument.create({
        data: {
          songId: song.id,
          type: docType,
          version: docVersion,
          content: content.trim(),
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create link if provided
    if (linkType && linkUrl && linkUrl.trim()) {
      // Map form values to enum values
      const typeMapping = {
        "guitar tutorial": "guitar_tutorial",
        "bass tutorial": "bass_tutorial",
        "keyboard tutorial": "keyboard_tutorial",
        "bass tab": "bass_tab",
        "horn chart": "horn_chart",
        "apple music": "apple_music",
        "sheet-music": "sheet_music",
        "backing-track": "backing_track",
      };
      const mappedType = typeMapping[linkType] || linkType;

      await prisma.link.create({
        data: {
          songId: song.id,
          createdById: userId,
          type: mappedType,
          url: linkUrl.trim(),
          description:
            linkDescription && linkDescription.trim()
              ? linkDescription.trim()
              : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    let successMessage;
    if (isExistingSong) {
      successMessage = `Song "${song.title}" already exists and has been added to ${band.name}'s repertoire! It's ready to be used in Setlists!`;
    } else {
      successMessage = `Song "${song.title}" created and added to ${band.name} successfully! It's ready to be used in Setlists!`;
    }

    req.flash("success", successMessage);
    res.redirect(`/bands/${bandId}`);
  } catch (error) {
    console.error("New song creation error:", error);
    req.flash("error", "An error occurred creating the song");
    res.redirect(`/bands/${req.params.id}/songs/new`);
  }
});

// POST /bands/:id/songs/:songId - Add song to band
router.post("/:id/songs/:songId", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already added
    const existing = await prisma.bandSong.findFirst({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    if (existing) {
      return res.status(400).json({ error: "Song already in band" });
    }

    await prisma.bandSong.create({
      data: {
        bandId: parseInt(bandId),
        songId: parseInt(songId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Add band song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/songs/:songId - Remove song from band
router.delete("/:id/songs/:songId", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Log the action
    logger.logFormSubmission(
      `Removed song ${songId} from band ${bandId}`,
      req,
      { songId: parseInt(songId) }
    );

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandSong.deleteMany({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/songs/:songId/remove - Workaround for DELETE requests
router.post("/:id/songs/:songId/remove", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandSong.deleteMany({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band song error (POST):", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/invitations/:invitationId - Delete invitation
router.delete("/:id/invitations/:invitationId", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE invitation route hit:`,
    req.params
  );
  try {
    const { id: bandId, invitationId } = req.params;
    const userId = req.session.user.id;

    console.log(`[${new Date().toISOString()}] Deleting invitation:`, {
      bandId,
      invitationId,
      userId,
    });

    // Check if user is owner of the band
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId, role: "owner" },
    });

    if (!membership) {
      console.log(
        `[${new Date().toISOString()}] User ${userId} is not owner of band ${bandId}`
      );
      return res
        .status(403)
        .json({ error: "Only band owners can delete invitations" });
    }

    // Delete the invitation
    await prisma.bandInvitation.deleteMany({
      where: {
        id: invitationId,
        bandId: parseInt(bandId),
        used_at: null, // Only delete unused invitations
      },
    });

    console.log(
      `[${new Date().toISOString()}] Successfully deleted invitation ${invitationId}`
    );
    res.json({ success: true });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Delete invitation error:`,
      error
    );
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/invitations/:invitationId/delete - Workaround for DELETE requests
router.post("/:id/invitations/:invitationId/delete", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST delete invitation route hit:`,
    req.params
  );
  try {
    const { id: bandId, invitationId } = req.params;
    const userId = req.session.user.id;

    console.log(`[${new Date().toISOString()}] Deleting invitation via POST:`, {
      bandId,
      invitationId,
      userId,
    });

    // Check if user is owner of the band
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId, role: "owner" },
    });

    if (!membership) {
      console.log(
        `[${new Date().toISOString()}] User ${userId} is not owner of band ${bandId}`
      );
      return res
        .status(403)
        .json({ error: "Only band owners can delete invitations" });
    }

    // Delete the invitation
    await prisma.bandInvitation.deleteMany({
      where: {
        id: invitationId,
        bandId: parseInt(bandId),
        used_at: null, // Only delete unused invitations
      },
    });

    console.log(
      `[${new Date().toISOString()}] Successfully deleted invitation ${invitationId} via POST`
    );
    res.json({ success: true });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST delete invitation error:`,
      error
    );
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/quick-set - Process quick set creation
router.post(
  "/:id/quick-set",
  [body("songList").notEmpty().withMessage("Please provide a song list")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", "Please provide a song list");
        return res.redirect(`/bands/${req.params.id}`);
      }

      const bandId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const { songList } = req.body;

      // Check band membership
      const band = await prisma.band.findFirst({
        where: {
          id: bandId,
          members: {
            some: { userId: userId },
          },
        },
      });

      if (!band) {
        req.flash("error", "Band not found or you don't have permission");
        return res.redirect("/bands");
      }

      // Parse the song list
      console.log("=== PARSING DEBUG ===");
      console.log("Raw input:", songList);
      const parseResult = parseQuickSetInput(songList);
      console.log("Parse result:", {
        sets: parseResult.sets.length,
        songs: parseResult.songs.length,
        setlistTitle: parseResult.setlistTitle,
        errors: parseResult.errors,
      });

      if (parseResult.errors.length > 0) {
        req.flash("error", parseResult.errors.join(", "));
        return res.redirect(`/bands/${bandId}`);
      }

      // Create setlist with detected title or auto-generated name
      const currentDate = new Date();
      const setlistTitle =
        parseResult.setlistTitle ||
        `Quick Set - ${currentDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;

      console.log(`Creating setlist with title: "${setlistTitle}"`);

      const setlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          bandId: bandId,
          createdById: req.session.user.id,
          date: currentDate,
          shareTokens: generateShareTokens(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create empty sets for the setlist (use upsert to avoid duplicates)
      for (const set of parseResult.sets) {
        const setName =
          set.name === "Set 1"
            ? "Set_1"
            : set.name === "Set 2"
              ? "Set_2"
              : set.name === "Set 3"
                ? "Set_3"
                : set.name === "Set 4"
                  ? "Set_4"
                  : set.name === "Encore"
                    ? "Set_3"
                    : "Maybe";

        await prisma.setlistSet.upsert({
          where: {
            setlistId_name: {
              setlistId: setlist.id,
              name: setName,
            },
          },
          update: {
            order: set.setNumber === 999 ? 999 : set.setNumber,
            updatedAt: new Date(),
          },
          create: {
            setlistId: setlist.id,
            name: setName,
            order: set.setNumber === 999 ? 999 : set.setNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Store the parsed data and setlist ID in session for confirmation page
      req.session.quickSetData = {
        bandId: bandId,
        setlistId: setlist.id,
        sets: parseResult.sets,
        songs: parseResult.songs,
      };

      // Redirect to confirmation page
      res.redirect(`/bands/${bandId}/quick-set/confirm`);
    } catch (error) {
      console.error("Quick set creation error:", error);
      req.flash("error", "An error occurred processing your setlist");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// POST /bands/:id/quick-set/process-song - Process individual song via AJAX
router.post("/:id/quick-set/process-song", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const {
      songLine,
      selection,
      setlistId,
      editedTitle,
      newArtist,
      originalTitle,
      songId,
    } = req.body;

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId ||
      req.session.quickSetData.setlistId !== parseInt(setlistId)
    ) {
      return res.status(400).json({ error: "Invalid session data" });
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { sets, songs } = req.session.quickSetData;
    const originalSong = songs.find((s) => s.lineNumber === parseInt(songLine));

    if (!originalSong) {
      return res.status(400).json({ error: "Song not found" });
    }

    let processedSong;

    if (selection === "new") {
      // Create new song with edited title if provided
      const finalTitle = editedTitle || originalTitle || originalSong.title;
      const artistName = newArtist || originalSong.artist;

      // Create or find artist if provided
      let artistId = null;
      if (artistName && artistName.trim()) {
        const artist = await prisma.artist.upsert({
          where: { name: artistName.trim() },
          update: {},
          create: {
            name: artistName.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        artistId = artist.id;
      }

      // Check if song already exists (with privacy-aware duplicate detection)
      let existingSong = null;
      if (artistId) {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { some: { artistId: artistId } },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: userId }, // Only check same user's private songs
            ],
          },
        });
      } else {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { none: {} },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: userId }, // Only check same user's private songs
            ],
          },
        });
      }

      // Check if user wants to make this song private
      const isPrivate = req.body[`new_private_${songLine}`] === "true";
      console.log(
        `DEBUG AJAX: Line ${songLine} - isPrivate: ${isPrivate}, checkbox value: ${req.body[`new_private_${songLine}`]}`
      );

      // Use existing song if found, otherwise create new one
      processedSong =
        existingSong ||
        (await prisma.song.create({
          data: {
            title: finalTitle,
            createdById: userId,
            private: isPrivate,
            createdAt: new Date(),
            updatedAt: new Date(),
            artists: artistId
              ? {
                  create: {
                    artistId: artistId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                }
              : undefined,
          },
          include: {
            artists: { include: { artist: true } },
          },
        }));
    } else {
      // Use existing song
      processedSong = await prisma.song.findUnique({
        where: { id: parseInt(songId) },
        include: {
          artists: { include: { artist: true } },
        },
      });

      if (!processedSong) {
        return res.status(400).json({ error: "Selected song not found" });
      }

      // Add artist if provided for existing song
      if (newArtist && newArtist.trim()) {
        const artist = await prisma.artist.upsert({
          where: { name: newArtist.trim() },
          update: {},
          create: {
            name: newArtist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Add artist to song if not already associated
        await prisma.songArtist.upsert({
          where: {
            songId_artistId: {
              songId: processedSong.id,
              artistId: artist.id,
            },
          },
          update: {},
          create: {
            songId: processedSong.id,
            artistId: artist.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Add song to band
    await prisma.bandSong.upsert({
      where: {
        bandId_songId: {
          bandId: bandId,
          songId: processedSong.id,
        },
      },
      update: {},
      create: {
        bandId: bandId,
        songId: processedSong.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Find the appropriate set and add song to setlist
    const setData = sets.find((s) =>
      s.songs.some((song) => song.lineNumber === parseInt(songLine))
    );
    console.log(`Processing song ${songLine}, setData:`, setData);
    console.log("Session data structure:", {
      isGoogleDocImport: req.session.quickSetData.isGoogleDocImport,
      hasGoogleDocData: !!req.session.quickSetData.googleDocData,
      sets: req.session.quickSetData.sets.map((s) => ({
        name: s.name,
        songCount: s.songs.length,
      })),
      songs: req.session.quickSetData.songs.map((s) => ({
        lineNumber: s.lineNumber,
        title: s.title,
        hasProcessedContent: !!s.processedContent,
      })),
    });

    if (setData) {
      const setName =
        setData.name === "Google Doc Songs"
          ? "Set_1"
          : setData.name === "Set 1"
            ? "Set_1"
            : setData.name === "Set 2"
              ? "Set_2"
              : setData.name === "Set 3"
                ? "Set_3"
                : setData.name === "Set 4"
                  ? "Set_4"
                  : setData.name === "Encore"
                    ? "Set_3"
                    : "Set_1"; // Default to Set_1 for Google Doc imports

      console.log(
        `Looking for setlist set: setlistId=${setlistId}, name=${setName}`
      );

      // Find the setlist set
      const setlistSet = await prisma.setlistSet.findFirst({
        where: {
          setlistId: parseInt(setlistId),
          name: setName,
        },
      });

      console.log("Found setlistSet:", setlistSet);

      if (setlistSet) {
        // Count existing songs in this set for ordering
        const existingSongsCount = await prisma.setlistSong.count({
          where: { setlistSetId: setlistSet.id },
        });

        // Add song to setlist
        console.log(
          `Adding song to setlist: setlistSetId=${setlistSet.id}, songId=${processedSong.id}, order=${existingSongsCount + 1}`
        );
        await prisma.setlistSong.create({
          data: {
            setlistSetId: setlistSet.id,
            songId: processedSong.id,
            order: existingSongsCount + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`Successfully added song to setlist`);
      }
    }

    // If this is a Google Doc import and we have content, create a gig document and links
    if (
      req.session.quickSetData.isGoogleDocImport &&
      req.session.quickSetData.googleDocData &&
      originalSong.processedContent
    ) {
      try {
        console.log("Creating gig document for Google Doc import:");
        console.log("- Song title:", processedSong.title);
        console.log("- Song ID:", processedSong.id);
        console.log(
          "- Processed content length:",
          originalSong.processedContent?.length
        );
        console.log("- User ID:", userId);

        // Auto-increment version for Google Doc imports (same logic as gig-documents route)
        let docVersion = 1;
        const existingDocs = await prisma.gigDocument.findMany({
          where: { songId: processedSong.id, type: "chords" },
          orderBy: { version: "desc" },
          take: 1,
        });
        if (existingDocs.length > 0) {
          docVersion = existingDocs[0].version + 1;
        }
        console.log(`- Creating gig document version: ${docVersion}`);

        // Create a gig document from the processed Google Doc content (TinyMCE compatible)
        const gigDocument = await prisma.gigDocument.create({
          data: {
            content: originalSong.processedContent, // Use processed content for TinyMCE
            songId: processedSong.id,
            type: "chords", // Default type for Google Doc imports
            version: docVersion, // Use incremented version
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `Created gig document for Google Doc import: ${gigDocument.id}`
        );

        // Create links from extracted URLs if any
        if (originalSong.urls && originalSong.urls.length > 0) {
          let linksCreated = 0;
          for (const urlInfo of originalSong.urls) {
            // Skip font resources and other non-music links
            if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
              continue;
            }

            try {
              // Check if link already exists
              const existingLink = await prisma.link.findFirst({
                where: {
                  songId: processedSong.id,
                  url: urlInfo.url,
                },
              });

              if (!existingLink) {
                // Create new link
                await prisma.link.create({
                  data: {
                    songId: processedSong.id,
                    createdById: req.session.user.id,
                    type: urlInfo.type,
                    description: urlInfo.description || urlInfo.url,
                    url: urlInfo.url,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
                linksCreated++;
              }
            } catch (error) {
              console.error(`Error creating link: ${error.message}`);
            }
          }

          console.log(
            `Created ${linksCreated} links for Google Doc import song: ${processedSong.title}`
          );
        }
      } catch (error) {
        console.error(
          "Error creating gig document for Google Doc import:",
          error
        );
        // Don't fail the whole operation if gig document creation fails
      }
    }

    res.json({
      success: true,
      songTitle: processedSong.title,
      songId: processedSong.id,
    });
  } catch (error) {
    console.error("Process song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/quick-set/create - Create the setlist from confirmed selections
router.post("/:id/quick-set/create", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { setlistTitle, setlistDate, ...songSelections } = req.body;

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId
    ) {
      req.flash("error", "No setlist data found. Please try again.");
      return res.redirect(`/bands/${bandId}`);
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const { sets, songs } = req.session.quickSetData;
    const createSetlist = req.session.quickSetData.createSetlist !== false;

    // Process song selections and create new songs as needed
    const processedSongs = await Promise.all(
      songs.map(async (originalSong, index) => {
        const lineNumber = originalSong.lineNumber; // Use the actual line number from parsing
        const selection = songSelections[`song_${lineNumber}`];

        // Skip if no selection was made for this song
        if (!selection) {
          return null;
        }

        if (selection === "new") {
          // Create new song - use edited title if provided, otherwise original
          const finalTitle =
            songSelections[`edited_title_${lineNumber}`] || originalSong.title;
          const artistName =
            songSelections[`new_artist_${lineNumber}`] || originalSong.artist;

          // Create or find artist if provided
          let artistId = null;
          if (artistName && artistName.trim()) {
            const artist = await prisma.artist.upsert({
              where: { name: artistName.trim() },
              update: {},
              create: {
                name: artistName.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            artistId = artist.id;
          }

          // Check if song already exists with proper duplicate logic (case-insensitive)
          let existingSong = null;

          if (artistId) {
            // If artist is provided, check for same title AND same artist (both case-insensitive)
            existingSong = await prisma.song.findFirst({
              where: {
                title: {
                  equals: finalTitle.trim(),
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
                  { private: true, createdById: userId }, // Only check same user's private songs
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
                  equals: finalTitle.trim(),
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
                  { private: true, createdById: userId }, // Only check same user's private songs
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

          // Check if user wants to make this song private
          const isPrivate = req.body[`new_private_${lineNumber}`] === "true";
          console.log(
            `DEBUG: Line ${lineNumber} - isPrivate: ${isPrivate}, checkbox value: ${req.body[`new_private_${lineNumber}`]}`
          );

          // Use existing song if found, otherwise create new one
          const newSong =
            existingSong ||
            (await prisma.song.create({
              data: {
                title: finalTitle,
                createdById: userId,
                private: isPrivate,
                createdAt: new Date(),
                updatedAt: new Date(),
                artists: artistId
                  ? {
                      create: {
                        artistId: artistId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      },
                    }
                  : undefined,
              },
              include: {
                artists: {
                  include: { artist: true },
                },
              },
            }));

          // Add song to band
          await prisma.bandSong.upsert({
            where: {
              bandId_songId: {
                bandId: bandId,
                songId: newSong.id,
              },
            },
            update: {},
            create: {
              bandId: bandId,
              songId: newSong.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return newSong;
        } else if (selection.startsWith("existing_")) {
          // Use existing song
          const songId = parseInt(selection.replace("existing_", ""));
          const existingSong = await prisma.song.findUnique({
            where: { id: songId },
            include: {
              artists: {
                include: { artist: true },
              },
            },
          });

          if (existingSong) {
            // Check if an artist was provided for this existing song
            const artistFieldName = `existing_artist_${originalSong.lineNumber}_${songId}`;
            const providedArtist = req.body[artistFieldName];

            if (
              providedArtist &&
              providedArtist.trim() &&
              existingSong.artists.length === 0
            ) {
              // Add the artist to this existing song
              let artist = await prisma.artist.findFirst({
                where: { name: providedArtist.trim() },
              });

              if (!artist) {
                // Create new artist
                artist = await prisma.artist.create({
                  data: {
                    name: providedArtist.trim(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
              }

              // Add artist to song
              await prisma.songArtist.create({
                data: {
                  songId: songId,
                  artistId: artist.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });

              // Refresh the song with the new artist
              const updatedSong = await prisma.song.findUnique({
                where: { id: songId },
                include: {
                  artists: {
                    include: { artist: true },
                  },
                },
              });

              if (updatedSong) {
                existingSong.artists = updatedSong.artists;
              }
            }

            // Ensure song is added to band if not already
            try {
              await prisma.bandSong.upsert({
                where: {
                  bandId_songId: {
                    bandId: bandId,
                    songId: songId,
                  },
                },
                update: {},
                create: {
                  bandId: bandId,
                  songId: songId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            } catch (error) {
              // If unique constraint fails, the song is already associated with the band
              // This is fine, just continue
              console.log(
                `Song ${songId} already associated with band ${bandId}`
              );
            }
          }

          return existingSong;
        }

        return null;
      })
    );

    // Filter out any null songs
    const validSongs = processedSongs.filter((song) => song !== null);

    // Only create setlist if we're supposed to
    let setlist = null;
    if (createSetlist) {
      // Create the setlist
      setlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          date: setlistDate ? new Date(setlistDate) : new Date(),
          bandId: bandId,
          createdById: req.session.user.id,
          shareTokens: generateShareTokens(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create sets and add songs (only if creating a setlist)
    if (createSetlist) {
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];

        // Map set names to database enum values
        let dbSetName;
        if (set.setNumber === 1) {
          dbSetName = "Set_1";
        } else if (set.setNumber === 2) {
          dbSetName = "Set_2";
        } else if (set.setNumber === 3) {
          dbSetName = "Set_3";
        } else if (set.setNumber === 4) {
          dbSetName = "Set_4";
        } else {
          dbSetName = "Maybe";
        }

        const setlistSet = await prisma.setlistSet.create({
          data: {
            setlistId: setlist.id,
            name: dbSetName,
            order: i + 1, // Set order based on array index
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Find songs that belong to this set
        const setOriginalSongs = songs.filter(
          (song) => song.setNumber === set.setNumber
        );
        const setSongs = [];

        // Match processed songs to original songs by line number
        for (const originalSong of setOriginalSongs) {
          const processedSong = validSongs.find((ps) =>
            processedSongs.find(
              (procSong, idx) =>
                procSong === ps &&
                songs[idx].lineNumber === originalSong.lineNumber
            )
          );
          if (processedSong) {
            setSongs.push(processedSong);
          }
        }

        // Add songs to this set
        for (let j = 0; j < setSongs.length; j++) {
          const song = setSongs[j];
          await prisma.setlistSong.create({
            data: {
              setlistSetId: setlistSet.id,
              songId: song.id,
              order: j + 1, // Order within the set
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      }

      // Create gig documents for Google Doc imports in bulk processing
      if (
        req.session.quickSetData.isGoogleDocImport &&
        req.session.quickSetData.googleDocData
      ) {
        console.log(
          "Creating gig documents for Google Doc import in bulk processing..."
        );

        for (const originalSong of songs) {
          const processedSong = validSongs.find((ps) =>
            processedSongs.find(
              (procSong, idx) =>
                procSong === ps &&
                songs[idx].lineNumber === originalSong.lineNumber
            )
          );

          if (processedSong && originalSong.processedContent) {
            try {
              // Auto-increment version for Google Doc imports (same logic as individual processing)
              let docVersion = 1;
              const existingDocs = await prisma.gigDocument.findMany({
                where: { songId: processedSong.id, type: "chords" },
                orderBy: { version: "desc" },
                take: 1,
              });
              if (existingDocs.length > 0) {
                docVersion = existingDocs[0].version + 1;
              }

              console.log(
                `Creating gig document for ${processedSong.title} - version ${docVersion}`
              );
              console.log(
                `Content length: ${originalSong.processedContent?.length || 0}`
              );
              console.log(
                `Content preview: ${originalSong.processedContent?.substring(0, 200) || "NO CONTENT"}`
              );

              // Create gig document
              const gigDocument = await prisma.gigDocument.create({
                data: {
                  content: originalSong.processedContent,
                  songId: processedSong.id,
                  type: "chords",
                  version: docVersion,
                  createdById: userId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });

              console.log(
                `Created gig document ${gigDocument.id} for song ${processedSong.title}`
              );

              // Create links from extracted URLs if any
              if (originalSong.urls && originalSong.urls.length > 0) {
                let linksCreated = 0;
                for (const urlInfo of originalSong.urls) {
                  if (
                    urlInfo.type === "font_resource" ||
                    urlInfo.type === "other"
                  ) {
                    continue;
                  }

                  try {
                    const existingLink = await prisma.link.findFirst({
                      where: {
                        songId: processedSong.id,
                        url: urlInfo.url,
                      },
                    });

                    if (!existingLink) {
                      await prisma.link.create({
                        data: {
                          songId: processedSong.id,
                          createdById: req.session.user.id,
                          type: urlInfo.type,
                          description: urlInfo.description || urlInfo.url,
                          url: urlInfo.url,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        },
                      });
                      linksCreated++;
                    }
                  } catch (error) {
                    console.error(`Error creating link: ${error.message}`);
                  }
                }

                console.log(
                  `Created ${linksCreated} links for ${processedSong.title}`
                );
              }
            } catch (error) {
              console.error(
                `Error creating gig document for ${processedSong.title}:`,
                error
              );
              // Don't fail the whole operation if gig document creation fails
            }
          }
        }
      }
    } // End of createSetlist conditional

    // Clear session data
    const isNewList = req.session.quickSetData.isNewList;
    delete req.session.quickSetData;

    if (isNewList && !createSetlist) {
      // New list flow - just adding to band songs
      const newSongsCount = processedSongs.filter((s) => s.isNew).length;
      const existingSongsCount = processedSongs.filter((s) => !s.isNew).length;

      let successMessage = `Successfully added ${processedSongs.length} songs to your band's repertoire`;
      if (newSongsCount > 0) {
        successMessage += ` (${newSongsCount} new songs created)`;
      }
      if (existingSongsCount > 0) {
        successMessage += ` (${existingSongsCount} existing songs added)`;
      }

      req.flash("success", successMessage);
      res.redirect(`/bands/${bandId}`);
    } else {
      // Regular quickset flow - creating setlist
      req.flash("success", `Setlist "${setlistTitle}" created successfully!`);
      res.redirect(`/setlists/${setlist.id}`);
    }
  } catch (error) {
    console.error("Quick set creation error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      bandId: req.params.id,
      userId: req.session?.user?.id,
      setlistTitle: req.body.setlistTitle,
      sessionData: !!req.session.quickSetData,
      errorMessage: error.message,
      errorCode: error.code,
    });

    // Log to application logger if available
    try {
      const logger = require("../utils/logger");
      if (logger && typeof logger.error === "function") {
        logger.error(
          `Quick set creation failed for band ${req.params.id}: ${error.message}`,
          {
            userId: req.session?.user?.id,
            bandId: req.params.id,
            error: error.stack,
          }
        );
      }
    } catch (loggerError) {
      console.error(
        `Quick set creation failed for band ${req.params.id}: ${error.message}`
      );
    }

    req.flash(
      "error",
      "An error occurred creating the setlist. Please try again."
    );
    res.redirect(`/bands/${req.params.id}`);
  }
});

// GET /bands/:id/new-list - Show new list creation page
router.get("/:id/new-list", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    res.render("bands/new-list", {
      title: `Add a List - ${band.name}`,
      pageTitle: "Add a List of Songs For Your Band",
      band,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("New list page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// New Doc routes
router.get("/:id/new-doc", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    res.render("bands/new-doc", {
      pageTitle: "Add Your Google Doc",
      band,
      hasBandHeader: false,
    });
  } catch (error) {
    console.error("New doc page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/new-doc - Process new doc creation
router.post("/:id/new-doc", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { googleDocUrl, listType } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!googleDocUrl) {
      req.flash("error", "Google Doc URL is required");
      return res.redirect(`/bands/${bandId}/new-doc`);
    }

    // Render a page that auto-submits to the existing Google Doc processing route
    res.render("bands/google-doc-redirect", {
      title: "Processing Google Doc...",
      googleDocUrl: googleDocUrl,
      bandId: bandId,
      listType: listType,
    });
  } catch (error) {
    console.error("New doc processing error:", error);
    req.flash("error", "An error occurred processing the Google Doc");
    res.redirect(`/bands/${req.params.id}/new-doc`);
  }
});

// New Song routes
router.get("/:id/songs/new", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    // Get artists for datalist
    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
      take: 100, // Limit for performance
    });

    // Get vocalists for datalist
    const vocalists = await prisma.vocalist.findMany({
      orderBy: { name: "asc" },
      take: 100, // Limit for performance
    });

    res.render("bands/songs/new", {
      pageTitle: "Add Your New Single",
      band,
      hasBandHeader: false,
      artists,
      vocalists,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("New song page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// GET /bands/:id/songs/:songId - Show song in band context
router.get("/:id/songs/:songId", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    // Handle navigation context from query parameters
    const { from, setlistId, token, songId: querySongId } = req.query;
    const { setNavigationContext } = require("../middleware/navigationContext");

    if (from && setlistId) {
      // Set/update navigation context when coming from setlist/rehearsal
      setNavigationContext(
        req,
        from,
        parseInt(setlistId),
        bandId,
        token,
        querySongId ? parseInt(querySongId) : null
      );
    }
    // Note: We don't clear context when no query params - it persists in session

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    // Check if song is in band's repertoire
    const bandSong = await prisma.bandSong.findFirst({
      where: {
        bandId: bandId,
        songId: songId,
      },
    });

    if (!bandSong) {
      req.flash("error", "This song is not in your band's repertoire");
      return res.redirect(`/bands/${bandId}`);
    }

    // Get full song data
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        links: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        gigDocuments: {
          include: {
            creator: true,
          },
        },
      },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect(`/bands/${bandId}`);
    }

    // Helper functions (same as songs.js)
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
        midi: "music-note-beamed",
        pdf: "file-earmark-pdf",
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
        apple_music: "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        bass_tab: "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        guitar_tutorial: "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        bass_tutorial: "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        keyboard_tutorial: "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        sheet_music: "Sheet Music",
        "backing-track": "Backing Track",
        backing_track: "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        horn_chart: "Horn Chart",
        midi: "MIDI File",
        other: "Other",
      };

      const typeLabel = typeLabels[link.type] || "Link";
      return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
    };

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

    // Get navigation back button
    const {
      getBackToSetlistButton,
    } = require("../middleware/navigationContext");
    const backButton = getBackToSetlistButton(req);

    res.render("bands/songs/show", {
      title: song.title,
      pageTitle,
      marqueeTitle: song.title,
      band,
      song,
      hasBandHeader: false,
      loggedIn: true,
      currentUser: req.session.user,
      getLinkIcon,
      getLinkDisplayText,
      getTypeIcon,
      getTypeDisplayName,
      currentUrl: req.originalUrl,
      backToSetlistButton: backButton,
    });
  } catch (error) {
    logger.logError("Band song show error", error);
    req.flash("error", "Error loading song");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// Helper function to verify band membership and get band
async function verifyBandAccess(bandId, userId) {
  const band = await prisma.band.findFirst({
    where: {
      id: bandId,
      members: {
        some: { userId: userId },
      },
    },
  });
  return band;
}

// GET /bands/:id/songs/:songId/edit - Edit song in band context
router.get("/:id/songs/:songId/edit", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    // Navigation context persists from session (no query params needed)
    const {
      getBackToSetlistButton,
    } = require("../middleware/navigationContext");
    const backButton = getBackToSetlistButton(req);

    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
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
      return res.redirect(`/bands/${bandId}`);
    }

    // Check if user can create private songs (subscription-based)
    const { canCreatePrivateSongs } = require("../utils/subscriptionHelper");
    const privateCheck = await canCreatePrivateSongs(userId);

    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: { name: "asc" },
    });

    res.render("bands/songs/edit", {
      title: `Edit ${song.title}`,
      pageTitle: "Edit Song",
      marqueeTitle: song.title,
      band,
      song,
      artists,
      vocalists,
      canMakePrivate: privateCheck.allowed,
      currentUser: req.session.user,
      hasBandHeader: false,
      backToSetlistButton: backButton,
    });
  } catch (error) {
    logger.logError("Band song edit form error", error);
    req.flash("error", "Error loading edit form");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}`);
  }
});

// POST /bands/:id/songs/:songId/update - Update song in band context
router.post("/:id/songs/:songId/update", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        artists: { include: { artist: true } },
        vocalist: true,
      },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect(`/bands/${bandId}`);
    }

    const {
      artist,
      vocalist,
      key,
      minutes = 0,
      seconds = 0,
      bpm,
      style,
    } = req.body;

    // Calculate total time in seconds
    const totalTime = (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);

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
        "C#m": "C_m",
        Dm: "Dm",
        "D#m": "D_m",
        Ebm: "Ebm",
        Em: "Em",
        Fm: "Fm",
        "F#m": "F_m",
        Gm: "Gm",
        "G#m": "G_m",
        Am: "Am",
        "A#m": "A_m",
        Bbm: "Bbm",
        Bm: "Bm",
        Cm: "Cm",
      };
      enumKey = keyMap[key] || null;
    }

    // Handle artist
    let artistId = null;
    if (artist && artist.trim()) {
      let existingArtist = await prisma.artist.findFirst({
        where: { name: { equals: artist.trim(), mode: "insensitive" } },
      });

      if (!existingArtist) {
        existingArtist = await prisma.artist.create({
          data: {
            name: artist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      artistId = existingArtist.id;
    }

    // Handle vocalist
    let vocalistId = null;
    if (vocalist && vocalist.trim()) {
      let existingVocalist = await prisma.vocalist.findFirst({
        where: { name: { equals: vocalist.trim(), mode: "insensitive" } },
      });

      if (!existingVocalist) {
        existingVocalist = await prisma.vocalist.create({
          data: {
            name: vocalist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      vocalistId = existingVocalist.id;
    }

    const bpmValue = bpm && bpm.trim() ? parseInt(bpm) : null;

    const updateData = {
      key: enumKey,
      time: totalTime || null,
      bpm: bpmValue,
      style: style && style.trim() ? style.trim() : null,
      vocalistId: vocalistId,
      updatedAt: new Date(),
    };

    // Update artist if provided and song doesn't have one
    if (artistId && (!song.artists || song.artists.length === 0)) {
      await prisma.songArtist.create({
        data: {
          songId: song.id,
          artistId: artistId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Update song
    await prisma.song.update({
      where: { id: song.id },
      data: updateData,
    });

    req.flash("success", "Song updated successfully");
    res.redirect(`/bands/${bandId}/songs/${songId}`);
  } catch (error) {
    logger.logError("Band song update error", error);
    req.flash("error", "Error updating song");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}/edit`);
  }
});

// GET /bands/:id/songs/:songId/links/:linkId - Show link viewer in band context
router.get("/:id/songs/:songId/links/:linkId", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const linkId = parseInt(req.params.linkId);

    // Navigation context persists from session
    const {
      getBackToSetlistButton,
    } = require("../middleware/navigationContext");
    const backButton = getBackToSetlistButton(req);

    // Get band (no membership required for viewing)
    const band = await prisma.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Get the song and all its links
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        artists: {
          include: {
            artist: true,
          },
        },
        vocalist: true,
        links: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect(`/bands/${bandId}`);
    }

    // Find the specific link being viewed
    const link = song.links.find((l) => l.id === linkId);

    if (!link) {
      req.flash("error", "Link not found");
      return res.redirect(`/bands/${bandId}/songs/${songId}`);
    }

    // Helper function for link display text
    const getLinkDisplayText = (link) => {
      const typeLabels = {
        youtube: "YouTube",
        video: "Video",
        spotify: "Spotify",
        "apple-music": "Apple Music",
        apple_music: "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        bass_tab: "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        guitar_tutorial: "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        bass_tutorial: "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        keyboard_tutorial: "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        sheet_music: "Sheet Music",
        "backing-track": "Backing Track",
        backing_track: "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        horn_chart: "Horn Chart",
        midi: "MIDI File",
        pdf: "Lead Sheet",
        lead_sheet: "Lead Sheet",
        other: "Other",
      };

      const typeLabel = typeLabels[link.type] || "Link";
      return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
    };

    // Helper function to extract Spotify track ID from URL
    const extractSpotifyTrackId = (url) => {
      if (!url || link.type !== "spotify") return null;

      const patterns = [
        /spotify:track:([a-zA-Z0-9]+)/,
        /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
        /spotify\.com\/track\/([a-zA-Z0-9]+)/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }

      return null;
    };

    // Helper function to extract YouTube video ID from URL
    const extractYouTubeVideoId = (url) => {
      if (!url || link.type !== "youtube") return null;

      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }

      return null;
    };

    // Handle supported link types
    if (
      link.type !== "audio" &&
      link.type !== "spotify" &&
      link.type !== "youtube" &&
      link.type !== "midi" &&
      link.type !== "pdf"
    ) {
      req.flash("error", "Link viewer not available for this type");
      return res.redirect(`/bands/${bandId}/songs/${songId}`);
    }

    res.render("songs/link-viewer", {
      title: song.title,
      pageTitle: `${song.title} | The Band Plan`,
      marqueeTitle: song.title,
      song,
      link,
      band,
      getLinkDisplayText,
      extractSpotifyTrackId,
      extractYouTubeVideoId,
      hasBandHeader: false,
      backToSetlistButton: backButton,
    });
  } catch (error) {
    logger.logError("Band song link viewer error:", error);
    req.flash("error", "An error occurred loading the link viewer");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/songs/:songId/links - Add link in band context
router.post("/:id/songs/:songId/links", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect(`/bands/${bandId}`);
    }

    const { type, url, description } = req.body;

    // Map form values to enum values
    const typeMapping = {
      "guitar tutorial": "guitar_tutorial",
      "bass tutorial": "bass_tutorial",
      "keyboard tutorial": "keyboard_tutorial",
      "bass tab": "bass_tab",
      "horn chart": "horn_chart",
      "apple music": "apple_music",
      "sheet-music": "sheet_music",
      "backing-track": "backing_track",
    };
    const mappedType = typeMapping[type] || type;

    await prisma.link.create({
      data: {
        songId: song.id,
        createdById: userId,
        type: mappedType,
        url: url.trim(),
        description: description ? description.trim() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    req.flash("success", "Link added successfully");
    res.redirect(`/bands/${bandId}/songs/${songId}`);
  } catch (error) {
    logger.logError("Band song add link error", error);
    req.flash("error", "Error adding link");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}`);
  }
});

// GET /bands/:id/songs/:songId/docs/new - New gig doc in band context
router.get("/:id/songs/:songId/docs/new", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
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
      return res.redirect(`/bands/${bandId}`);
    }

    res.render("bands/songs/docs/new", {
      title: `New Music Stand Document - ${song.title}`,
      marqueeTitle: song.title,
      band,
      song,
      hasBandHeader: false,
    });
  } catch (error) {
    logger.logError("Band gig doc new form error", error);
    req.flash("error", "Error loading form");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}`);
  }
});

// POST /bands/:id/songs/:songId/docs - Create gig doc in band context
router.post("/:id/songs/:songId/docs", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const userId = req.session.user.id;

    const band = await verifyBandAccess(bandId, userId);
    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const song = await prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect(`/bands/${bandId}`);
    }

    const { type, content } = req.body;

    // Auto-increment version
    let docVersion = 1;
    const existingDocs = await prisma.gigDocument.findMany({
      where: { songId: songId, type: type },
      orderBy: { version: "desc" },
      take: 1,
    });
    if (existingDocs.length > 0) {
      docVersion = existingDocs[0].version + 1;
    }

    const typeLabels = {
      chords: "Chords",
      "bass-tab": "Bass Tab",
      "guitar-tab": "Guitar Tab",
      lyrics: "Lyrics",
    };

    await prisma.gigDocument.create({
      data: {
        songId: song.id,
        type,
        version: docVersion,
        content: content ? content.trim() : null,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    req.flash(
      "success",
      `Music Stand document created successfully: ${typeLabels[type]} - v${docVersion}`
    );
    res.redirect(`/bands/${bandId}/songs/${songId}`);
  } catch (error) {
    logger.logError("Band gig doc create error", error);
    req.flash("error", "Error creating document");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}/docs/new`);
  }
});

// GET /bands/:id/songs/:songId/docs/:docId - Show gig doc in band context
router.get("/:id/songs/:songId/docs/:docId", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const songId = parseInt(req.params.songId);
    const docId = parseInt(req.params.docId);
    const userId = req.session?.user?.id;

    // Handle navigation context from query parameters
    const { from, setlistId, token, songId: querySongId } = req.query;
    const {
      setNavigationContext,
      clearNavigationContext,
    } = require("../middleware/navigationContext");

    if (from && setlistId) {
      // Set new navigation context when coming from setlist/rehearsal
      setNavigationContext(
        req,
        from,
        parseInt(setlistId),
        bandId,
        token,
        querySongId ? parseInt(querySongId) : null
      );
    }

    // Get band - don't require membership for viewing
    const band = await prisma.band.findUnique({
      where: { id: bandId },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    const gigDocument = await prisma.gigDocument.findUnique({
      where: { id: docId },
      include: {
        song: {
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
            links: {
              include: {
                creator: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
        creator: true,
      },
    });

    if (!gigDocument || gigDocument.song.id !== songId) {
      req.flash("error", "Document not found");
      return res.redirect(`/bands/${bandId}/songs/${songId}`);
    }

    // Check if this is a print request
    const isPrintRequest = req.query.print === "true";

    // Get navigation back button from session context
    const {
      getBackToSetlistButton,
    } = require("../middleware/navigationContext");
    const backButton = getBackToSetlistButton(req);

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
        apple_music: "Apple Music",
        soundcloud: "SoundCloud",
        bandcamp: "Bandcamp",
        lyrics: "Lyrics",
        tab: "Tab",
        "bass tab": "Bass Tab",
        bass_tab: "Bass Tab",
        chords: "Chords",
        "guitar tutorial": "Guitar Tutorial",
        guitar_tutorial: "Guitar Tutorial",
        "bass tutorial": "Bass Tutorial",
        bass_tutorial: "Bass Tutorial",
        "keyboard tutorial": "Keyboard Tutorial",
        keyboard_tutorial: "Keyboard Tutorial",
        audio: "Audio File",
        "sheet-music": "Sheet Music",
        sheet_music: "Sheet Music",
        "backing-track": "Backing Track",
        backing_track: "Backing Track",
        karaoke: "Karaoke",
        "horn chart": "Horn Chart",
        horn_chart: "Horn Chart",
        other: "Other",
      };
      const typeLabel = typeLabels[link.type] || "Link";
      return link.description ? `${typeLabel}: ${link.description}` : typeLabel;
    };

    const extractSpotifyTrackId = (url) => {
      if (!url) return null;
      const patterns = [
        /spotify:track:([a-zA-Z0-9]+)/,
        /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
        /spotify\.com\/track\/([a-zA-Z0-9]+)/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    const extractYouTubeVideoId = (url) => {
      if (!url) return null;
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    };

    if (isPrintRequest) {
      // For print requests, render without any layout and with minimal content
      res.render("gig-documents/print", {
        title: `${getTypeDisplayName(gigDocument.type)} - v${gigDocument.version} - ${gigDocument.song.title}`,
        gigDocument,
        song: gigDocument.song,
        band,
        layout: false,
        getTypeIcon,
        getTypeDisplayName,
        backToSetlistButton: backButton,
      });
    } else {
      // For normal viewing, render with layout
      res.render("bands/songs/docs/show", {
        title: `${gigDocument.song.title} - ${getTypeDisplayName(gigDocument.type)}`,
        pageTitle: gigDocument.song.title,
        marqueeTitle: gigDocument.song.title,
        band,
        gigDocument,
        loggedIn: !!userId,
        currentUser: req.session?.user,
        user: req.session?.user,
        getTypeIcon,
        getTypeDisplayName,
        getLinkIcon,
        getLinkDisplayText,
        extractSpotifyTrackId,
        extractYouTubeVideoId,
        hasBandHeader: false,
        backToSetlistButton: backButton,
      });
    }
  } catch (error) {
    logger.logError("Band gig doc show error", error);
    req.flash("error", "Error loading document");
    res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}`);
  }
});

// GET /bands/:id/songs/:songId/docs/:docId/edit - Edit gig doc in band context
router.get(
  "/:id/songs/:songId/docs/:docId/edit",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.id);
      const songId = parseInt(req.params.songId);
      const docId = parseInt(req.params.docId);
      const userId = req.session.user.id;

      const band = await verifyBandAccess(bandId, userId);
      if (!band) {
        req.flash("error", "Band not found or you don't have permission");
        return res.redirect("/bands");
      }

      const gigDocument = await prisma.gigDocument.findUnique({
        where: { id: docId },
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
          creator: true,
        },
      });

      if (!gigDocument || gigDocument.song.id !== songId) {
        req.flash("error", "Document not found");
        return res.redirect(`/bands/${bandId}/songs/${songId}`);
      }

      // Check if user is the creator or has permission
      if (
        gigDocument.createdById !== userId &&
        req.session.user.role !== "admin" &&
        req.session.user.role !== "moderator"
      ) {
        req.flash("error", "You don't have permission to edit this document");
        return res.redirect(`/bands/${bandId}/songs/${songId}/docs/${docId}`);
      }

      const getTypeDisplayName = (type) => {
        const names = {
          chords: "Chords",
          "bass-tab": "Bass Tab",
          "guitar-tab": "Guitar Tab",
          lyrics: "Lyrics",
        };
        return names[type] || type;
      };

      res.render("bands/songs/docs/edit", {
        title: `Edit ${getTypeDisplayName(gigDocument.type)} - ${gigDocument.song.title}`,
        pageTitle: "Edit Music Stand Document",
        marqueeTitle: gigDocument.song.title,
        band,
        gigDocument,
        getTypeDisplayName,
        hasBandHeader: false,
      });
    } catch (error) {
      logger.logError("Band gig doc edit form error", error);
      req.flash("error", "Error loading edit form");
      res.redirect(`/bands/${req.params.id}/songs/${req.params.songId}`);
    }
  }
);

// POST /bands/:id/songs/:songId/docs/:docId/update - Update gig doc in band context
router.post(
  "/:id/songs/:songId/docs/:docId/update",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.id);
      const songId = parseInt(req.params.songId);
      const docId = parseInt(req.params.docId);
      const userId = req.session.user.id;

      const band = await verifyBandAccess(bandId, userId);
      if (!band) {
        req.flash("error", "Band not found or you don't have permission");
        return res.redirect("/bands");
      }

      const gigDocument = await prisma.gigDocument.findUnique({
        where: { id: docId },
        include: {
          song: true,
        },
      });

      if (!gigDocument || gigDocument.song.id !== songId) {
        req.flash("error", "Document not found");
        return res.redirect(`/bands/${bandId}/songs/${songId}`);
      }

      // Check if user is the creator or has permission
      if (
        gigDocument.createdById !== userId &&
        req.session.user.role !== "admin" &&
        req.session.user.role !== "moderator"
      ) {
        req.flash("error", "You don't have permission to edit this document");
        return res.redirect(`/bands/${bandId}/songs/${songId}/docs/${docId}`);
      }

      const { content } = req.body;

      await prisma.gigDocument.update({
        where: { id: docId },
        data: {
          content: content ? content.trim() : null,
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Music Stand document updated successfully");
      res.redirect(`/bands/${bandId}/songs/${songId}/docs/${docId}`);
    } catch (error) {
      logger.logError("Band gig doc update error", error);
      req.flash("error", "Error updating document");
      res.redirect(
        `/bands/${req.params.id}/songs/${req.params.songId}/docs/${req.params.docId}/edit`
      );
    }
  }
);

// DELETE /bands/:id/songs/:songId/docs/:docId - Delete gig doc in band context
router.delete(
  "/:id/songs/:songId/docs/:docId",
  requireAuth,
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.id);
      const songId = parseInt(req.params.songId);
      const docId = parseInt(req.params.docId);
      const userId = req.session.user.id;

      const band = await verifyBandAccess(bandId, userId);
      if (!band) {
        return res.status(403).json({
          success: false,
          error: "Band not found or you don't have permission",
        });
      }

      const gigDocument = await prisma.gigDocument.findUnique({
        where: { id: docId },
        include: {
          song: true,
        },
      });

      if (!gigDocument || gigDocument.song.id !== songId) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      // Check if user is the creator or has permission
      if (
        gigDocument.createdById !== userId &&
        req.session.user.role !== "admin" &&
        req.session.user.role !== "moderator"
      ) {
        return res.status(403).json({
          success: false,
          error: "You don't have permission to delete this document",
        });
      }

      // Before deleting, set all BandSong references to null
      await prisma.bandSong.updateMany({
        where: { gigDocumentId: docId },
        data: { gigDocumentId: null },
      });

      await prisma.gigDocument.delete({
        where: { id: docId },
      });

      res.json({ success: true });
    } catch (error) {
      logger.logError("Band gig doc delete error", error);
      res
        .status(500)
        .json({ success: false, error: "Error deleting document" });
    }
  }
);

// POST /bands/:id/new-list - Process new list creation
router.post("/:id/new-list", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { songList, listType } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!songList || !songList.trim()) {
      req.flash("error", "Please provide a song list");
      return res.redirect(`/bands/${bandId}/new-list`);
    }

    // Parse the song list
    console.log("Parsing song list...");
    const parseResult = parseQuickSetInput(songList);
    console.log("Parse result:", parseResult);

    if (!parseResult || !parseResult.songs || parseResult.songs.length === 0) {
      console.log("Parse failed: No songs found");
      req.flash(
        "error",
        "No songs found in your list. Please check the format and try again."
      );
      return res.redirect(`/bands/${bandId}/new-list`);
    }

    // Create a temporary setlist if creating a setlist
    let setlistId = null;
    if (listType === "setlist") {
      console.log("Creating temporary setlist...");
      const setlistTitle = parseResult.setlistTitle || "Untitled Setlist";
      console.log("Using setlist title:", setlistTitle);

      const tempSetlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          bandId: bandId,
          createdById: userId,
          isFinalized: false,
          shareTokens: generateShareTokens(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      setlistId = tempSetlist.id;
      console.log("Created setlist with ID:", setlistId);
    }

    // Store the data in session using the same structure as quickset
    console.log("Storing session data...");
    req.session.quickSetData = {
      bandId: bandId,
      setlistId: setlistId,
      sets: parseResult.sets,
      songs: parseResult.songs,
      isNewList: true, // Flag to indicate this is from new-list flow
      createSetlist: listType === "setlist",
    };
    console.log("Session data stored:", req.session.quickSetData);

    // Redirect to existing quickset confirmation page
    console.log(`Redirecting to: /bands/${bandId}/quick-set/confirm`);
    res.redirect(`/bands/${bandId}/quick-set/confirm`);
  } catch (error) {
    console.error("New list processing error:", error);
    req.flash("error", "An error occurred while processing your list");
    res.redirect(`/bands/${req.params.id}/new-list`);
  }
});

// GET /bands/:id/quick-set/confirm - Show confirmation page with song matching
router.get("/:id/quick-set/confirm", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Debug: Log session state
    console.log("=== QUICKSET CONFIRM PAGE ACCESSED ===");
    console.log("Band ID from URL:", bandId);
    console.log("Session has quickSetData:", !!req.session.quickSetData);
    console.log(
      "Session quickSetData bandId:",
      req.session.quickSetData?.bandId
    );
    console.log(
      "Session quickSetData keys:",
      req.session.quickSetData ? Object.keys(req.session.quickSetData) : "none"
    );
    console.log("=== END SESSION DEBUG ===");

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId
    ) {
      console.log("ERROR: Session data missing or bandId mismatch");
      req.flash("error", "No setlist data found. Please try again.");
      return res.redirect(`/bands/${bandId}`);
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const { sets, songs, setlistId, isNewList, createSetlist } =
      req.session.quickSetData;

    // Get the created setlist (only if we created one)
    let setlist = null;
    if (setlistId) {
      setlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
      });

      if (!setlist) {
        req.flash("error", "Setlist not found. Please try again.");
        return res.redirect(`/bands/${bandId}`);
      }
    }

    // Debug: Check what songs exist in the database
    const totalSongsInDb = await prisma.song.count();
    console.log(`Total songs in database: ${totalSongsInDb}`);

    // Find song matches for each song
    const songMatches = await Promise.all(
      songs.map(async (song) => {
        const allMatches = await findSongMatches(
          song.title,
          song.artist,
          userId
        );

        console.log(
          `Song: "${song.title}" by "${song.artist}" - Found ${allMatches.length} matches:`,
          allMatches.map((m) => ({
            title: m.title,
            matchType: m.matchType,
            confidence: m.confidence,
          }))
        );

        // Separate exact matches from other matches
        const exactMatches = allMatches.filter(
          (match) => match.matchType === "exact"
        );
        const otherMatches = allMatches.filter(
          (match) => match.matchType !== "exact"
        );

        // Only pre-select if we have a high-confidence match
        let selectedMatch = null;
        let shouldPreferExisting = false;

        if (allMatches.length > 0) {
          const bestMatch = allMatches[0];
          // Pre-select if exact match OR fuzzy match with high confidence (70%+)
          if (bestMatch.matchType === "exact" || bestMatch.confidence >= 0.7) {
            selectedMatch = bestMatch;
            shouldPreferExisting = true;
          }
        }

        return {
          ...song,
          matches: {
            exactMatches: exactMatches,
            otherMatches: otherMatches,
            allMatches: allMatches,
          },
          selectedMatch: selectedMatch,
          shouldPreferExisting: shouldPreferExisting, // Flag for frontend
          needsCreation: allMatches.length === 0,
        };
      })
    );

    // Check if user can create private songs (subscription-based)
    const { canCreatePrivateSongs } = require("../utils/subscriptionHelper");
    const privateCheck = await canCreatePrivateSongs(userId);

    // Calculate summary stats
    const matchedSongs = songMatches.filter(
      (s) => s.matches.exactMatches.length > 0
    ).length;
    const likelyNewSongs = songMatches.length - matchedSongs;

    res.render("bands/quick-set-confirm", {
      title: req.session.quickSetData.isNewList
        ? `Confirm List - ${band.name}`
        : `Confirm Setlist - ${band.name}`,
      band,
      hasBandHeader: true,
      setlist,
      sets,
      songMatches,
      totalSongs: songs.length,
      matchedSongs,
      likelyNewSongs,
      googleDocData: req.session.quickSetData.googleDocData || null,
      isGoogleDocImport: req.session.quickSetData.isGoogleDocImport || false,
      isNewList: req.session.quickSetData.isNewList || false,
      createSetlist: req.session.quickSetData.createSetlist !== false, // Default to true for existing quickset flow
      canMakePrivate: privateCheck.allowed,
    });
  } catch (error) {
    console.error("Quick set confirm error:", error);
    req.flash("error", "An error occurred loading the confirmation page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/google-doc-to-quickset - Process Google Doc and convert to quickset
router.post("/:id/google-doc-to-quickset", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Access denied");
      return res.redirect(`/bands/${bandId}`);
    }

    // Get Google Doc data from session (from the redirect) or from request body (direct submission)
    let parsedData;
    if (req.session.googleDocData) {
      // Data from session (redirected from Google Doc processing)
      parsedData = req.session.googleDocData;
      // Clear the session data after use
      delete req.session.googleDocData;
    } else {
      // Direct submission from frontend (fallback)
      const { googleDocData } = req.body;
      try {
        parsedData =
          typeof googleDocData === "string"
            ? JSON.parse(googleDocData)
            : googleDocData;
      } catch (error) {
        console.error("Error parsing Google Doc data:", error);
        req.flash("error", "Invalid Google Doc data");
        return res.redirect(`/bands/${bandId}`);
      }
    }

    // Import the sophisticated HTML processor
    const { processGoogleDocHtml } = require("../utils/googleDocHtmlProcessor");

    // Process each extracted song with the sophisticated HTML processor
    const processedSongs = parsedData.extractedSongs.map((song, index) => {
      console.log(`=== Processing song ${index + 1}: ${song.title} ===`);
      console.log(`- Has fullContent: ${!!song.fullContent}`);
      console.log(
        `- fullContent length: ${song.fullContent?.length || "undefined"}`
      );
      console.log(
        `- contentPreview length: ${song.contentPreview?.length || "undefined"}`
      );
      console.log(`- contentLength: ${song.contentLength}`);

      // Process the HTML content to make it TinyMCE compatible
      const contentToProcess =
        song.fullContent || song.contentPreview.replace(/\.\.\.$/, "");
      console.log(
        `- Content being sent to HTML processor: ${contentToProcess?.length || "undefined"} characters`
      );
      console.log(
        `- Content preview: ${contentToProcess?.substring(0, 100) || "NO CONTENT"}`
      );

      const { content: processedContent, urls } =
        processGoogleDocHtml(contentToProcess);

      return {
        lineNumber: index + 1,
        title: song.title,
        artist: "", // Will be filled in during matching
        originalContent: song.contentPreview, // Keep original for display
        processedContent: processedContent, // TinyMCE-compatible content
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: urls, // Extracted URLs for link creation
      };
    });

    // Create a quickset-compatible structure from Google Doc data
    const quicksetData = {
      sets: [
        {
          name: "Set_1", // Use the actual database set name
          songs: processedSongs.map((song) => ({
            lineNumber: song.lineNumber,
            title: song.title,
            artist: song.artist,
            originalContent: song.originalContent,
            processedContent: song.processedContent,
            contentLength: song.contentLength,
            originalIndex: song.originalIndex,
            urls: song.urls,
          })),
        },
      ],
      songs: processedSongs.map((song) => ({
        lineNumber: song.lineNumber,
        title: song.title,
        artist: song.artist,
        originalContent: song.originalContent,
        processedContent: song.processedContent,
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: song.urls,
      })),
    };

    // Create a temporary setlist for the quickset workflow
    // Use the Google Doc title if available, otherwise fall back to default
    console.log("Parsed data for setlist title:", {
      hasDocumentTitle: !!parsedData.documentTitle,
      documentTitle: parsedData.documentTitle,
      hasSetlistTitle: !!parsedData.setlistTitle,
      setlistTitle: parsedData.setlistTitle,
      dataKeys: Object.keys(parsedData),
    });

    // Priority: 1) Detected setlist title, 2) Google Doc title, 3) Default
    let titleToUse = null;
    if (parsedData.setlistTitle) {
      titleToUse = parsedData.setlistTitle;
    } else if (parsedData.documentTitle) {
      titleToUse = `${parsedData.documentTitle} - ${new Date().toLocaleDateString()}`;
    } else {
      titleToUse = `Google Doc Import - ${new Date().toLocaleDateString()}`;
    }

    const setlistTitle = titleToUse;

    console.log("Final setlist title:", setlistTitle);

    const setlist = await prisma.setlist.create({
      data: {
        title: setlistTitle,
        date: new Date(),
        bandId: bandId,
        shareTokens: generateShareTokens(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a default set for the Google Doc songs
    await prisma.setlistSet.create({
      data: {
        setlistId: setlist.id,
        name: "Set_1", // Default to Set 1
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Store the Google Doc data in session for quickset confirmation
    req.session.quickSetData = {
      bandId: bandId,
      setlistId: setlist.id,
      sets: quicksetData.sets,
      songs: quicksetData.songs,
      googleDocData: parsedData, // Store original Google Doc data
      isGoogleDocImport: true, // Flag to indicate this is from Google Doc
    };

    // Redirect to quickset confirmation page
    res.redirect(`/bands/${bandId}/quick-set/confirm`);
  } catch (error) {
    console.error("Google Doc to quickset error:", error);
    req.flash("error", "An error occurred processing the Google Doc");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// Helper function to extract keywords from song titles
function getKeywords(title) {
  const stopWords = [
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "and",
    "or",
    "but",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
  ];
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}

// Function to find keyword-based matches
function findKeywordMatches(searchTitle, searchArtist, allSongs) {
  const searchKeywords = getKeywords(searchTitle);
  if (searchKeywords.length === 0) return [];

  const keywordMatches = allSongs
    .map((song) => {
      const songKeywords = getKeywords(song.title);

      // Find intersecting keywords
      const intersection = searchKeywords.filter((keyword) =>
        songKeywords.some(
          (songKeyword) =>
            // Exact match or one contains the other (for roses/rose)
            keyword === songKeyword ||
            keyword.includes(songKeyword) ||
            songKeyword.includes(keyword)
        )
      );

      // Calculate keyword overlap percentage
      const overlapPercentage =
        intersection.length /
        Math.max(searchKeywords.length, songKeywords.length);

      // Boost score if artist also matches
      let artistBoost = 0;
      if (searchArtist && song.artists && song.artists.length > 0) {
        const searchArtistKeywords = getKeywords(searchArtist);
        const songArtistKeywords = getKeywords(song.artists[0].artist.name);
        const artistIntersection = searchArtistKeywords.filter((keyword) =>
          songArtistKeywords.some(
            (artistKeyword) =>
              keyword === artistKeyword ||
              keyword.includes(artistKeyword) ||
              artistKeyword.includes(keyword)
          )
        );
        if (artistIntersection.length > 0) {
          artistBoost = 0.2; // 20% boost for artist match
        }
      }

      const finalScore = overlapPercentage + artistBoost;

      return {
        ...song,
        matchType: "keyword",
        confidence: finalScore,
        matchedKeywords: intersection,
      };
    })
    .filter((song) => song.confidence >= 0.15) // At least 15% keyword overlap
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Top 5 matches

  return keywordMatches;
}

// Function to calculate string similarity (Levenshtein-based)
function calculateSimilarity(str1, str2) {
  // Normalize strings: lowercase, trim
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0; // Perfect match

  // Levenshtein distance calculation
  const matrix = [];
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLength = Math.max(len1, len2);

  // Convert to similarity percentage (0-1)
  return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
}

// Function to find song matches using JavaScript-based fuzzy matching
async function findSongMatches(title, artist = "", userId = null) {
  try {
    // First try exact matches
    let exactMatches = [];

    if (artist) {
      // Look for exact title + artist match
      exactMatches = await prisma.song.findMany({
        where: {
          title: { equals: title, mode: "insensitive" },
          artists: {
            some: {
              artist: {
                name: { equals: artist, mode: "insensitive" },
              },
            },
          },
          // Add private filtering
          OR: [
            { private: false }, // Show all public songs
            { private: true, createdById: userId }, // Show private songs only if user owns them
          ],
        },
        include: {
          artists: {
            include: { artist: true },
          },
          vocalist: true,
          creator: true,
        },
        take: 5,
      });
    } else {
      // Look for exact title match (no artist specified)
      exactMatches = await prisma.song.findMany({
        where: {
          title: { equals: title, mode: "insensitive" },
          // Add private filtering
          OR: [
            { private: false }, // Show all public songs
            { private: true, createdById: userId }, // Show private songs only if user owns them
          ],
        },
        include: {
          artists: {
            include: { artist: true },
          },
          vocalist: true,
          creator: true,
        },
        take: 5,
      });
    }

    // Convert exact matches to the standard format
    const formattedExactMatches = exactMatches.map((song) => ({
      ...song,
      matchType: "exact",
      confidence: 1.0,
    }));

    // Always get additional songs for keyword and fuzzy matching
    const allSongs = await prisma.song.findMany({
      where: {
        // Add private filtering
        OR: [
          { private: false }, // Show all public songs
          { private: true, createdById: userId }, // Show private songs only if user owns them
        ],
      },
      include: {
        artists: {
          include: { artist: true },
        },
        vocalist: true,
        creator: true,
      },
      take: 1000, // Limit to avoid performance issues
    });

    let allMatches = [...formattedExactMatches];

    if (allSongs.length > 0) {
      // Get keyword matches (but exclude songs we already have as exact matches)
      const exactMatchIds = formattedExactMatches.map((match) => match.id);
      const songsForKeywordMatching = allSongs.filter(
        (song) => !exactMatchIds.includes(song.id)
      );

      const keywordMatches = findKeywordMatches(
        title,
        artist,
        songsForKeywordMatching
      );
      allMatches = [...allMatches, ...keywordMatches];
    }

    // Add fuzzy matches if we don't have enough suggestions yet
    if (allMatches.length < 5 && allSongs.length > 0) {
      // Get existing match IDs to avoid duplicates
      const existingMatchIds = allMatches.map((match) => match.id);
      const songsForFuzzyMatching = allSongs.filter(
        (song) => !existingMatchIds.includes(song.id)
      );

      // Calculate similarity scores using JavaScript
      const scoredSongs = songsForFuzzyMatching.map((song) => {
        const titleSimilarity = calculateSimilarity(title, song.title);

        // If artist was provided, factor it into the score
        let artistSimilarity = 0;
        if (artist && song.artists && song.artists.length > 0) {
          artistSimilarity = Math.max(
            ...song.artists.map((sa) =>
              calculateSimilarity(artist, sa.artist.name)
            )
          );
        }

        // Combined score: title is more important (70%) than artist (30%)
        const combinedScore = artist
          ? titleSimilarity * 0.7 + artistSimilarity * 0.3
          : titleSimilarity;

        return {
          ...song,
          matchType: "fuzzy",
          confidence: combinedScore,
        };
      });

      // Filter and sort by similarity score
      const fuzzyMatches = scoredSongs
        .filter((song) => song.confidence > 0.3) // 30% similarity threshold
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5 - allMatches.length); // Fill remaining slots

      allMatches = [...allMatches, ...fuzzyMatches];
    }

    // Sort all matches by confidence (exact matches will be first due to 1.0 confidence)
    const finalMatches = allMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Maximum 5 suggestions

    return finalMatches;
  } catch (error) {
    console.error("Error finding song matches:", error);
    return [];
  }
}

// Helper function to convert Roman numerals to numbers
function romanToNumber(roman) {
  const romanNumerals = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
  };
  return romanNumerals[roman.toUpperCase()] || null;
}

// Function to parse blank-line-separated format (no set headers)
function parseBlankLineSeparatedFormat(input) {
  const result = {
    sets: [],
    songs: [],
    errors: [],
    setlistTitle: null, // Add setlist title field
  };

  // Check if first line is followed by two line breaks (indicating it's a title)
  // Normalize line endings first (handle both \r\n and \n)
  const normalizedInput = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedInput.trim().split("\n");
  let startIndex = 0;

  console.log("=== BLANK LINE PARSING DEBUG ===");
  console.log("Total lines:", lines.length);
  console.log("Line 0:", JSON.stringify(lines[0]));
  console.log("Line 1:", JSON.stringify(lines[1]));
  console.log("Line 2:", JSON.stringify(lines[2]));

  if (lines.length >= 3 && lines[1].trim() === "" && lines[2].trim() !== "") {
    // First line is title, followed by one blank line, then first song
    result.setlistTitle = lines[0].trim();
    startIndex = 2; // Skip title and one blank line
    console.log(`Detected setlist title: "${result.setlistTitle}"`);
  } else {
    console.log("No setlist title detected - conditions not met");
  }

  // Split remaining input into groups separated by blank lines
  const remainingInput = lines.slice(startIndex).join("\n");
  const groups = remainingInput.trim().split(/\n\s*\n/);
  let lineNumber = startIndex;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex].trim();
    if (!group) continue;

    const setNumber = groupIndex + 1;
    const setName = setNumber <= 4 ? `Set ${setNumber}` : "Maybe";

    const currentSet = {
      name: setName,
      setNumber: setNumber <= 4 ? setNumber : 999,
      songs: [],
    };

    // Parse songs in this group
    const songLines = group
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    for (const songLine of songLines) {
      lineNumber++;

      // Parse song line - format: "Song Title, Artist" or just "Song Title"
      const parts = songLine.split(",").map((part) => part.trim());

      if (parts.length > 2) {
        result.errors.push(
          `Line ${lineNumber}: Too many commas. Format should be "Song Title, Artist" or just "Song Title"`
        );
        continue;
      }

      if (parts[0] === "") {
        result.errors.push(`Line ${lineNumber}: Empty song title`);
        continue;
      }

      // Trim '>' and '->' from song titles (common in jam band setlists)
      let songTitle = parts[0].trim();
      if (songTitle.endsWith("->")) {
        songTitle = songTitle.slice(0, -2).trim();
      } else if (songTitle.endsWith(">")) {
        songTitle = songTitle.slice(0, -1).trim();
      }

      const song = {
        title: songTitle,
        artist: parts.length > 1 ? parts[1] : "",
        setNumber: currentSet.setNumber,
        lineNumber: lineNumber,
      };

      currentSet.songs.push(song);
      result.songs.push(song);
    }

    if (currentSet.songs.length > 0) {
      result.sets.push(currentSet);
    }
  }

  return result;
}

// Function to parse quick set input
function parseQuickSetInput(input) {
  // First, split the input into raw lines (including empty ones)
  const rawLines = input.trim().split("\n");

  // Check if this looks like a blank-line-separated format
  const hasSetHeaders = rawLines.some((line) => {
    const trimmed = line.trim();
    return (
      /^Set\s+(\d+|[IVX]+)[\s:]*$/i.test(trimmed) ||
      /^Encore[\s:]*$/i.test(trimmed) ||
      /^E[\s:]*$/i.test(trimmed)
    );
  });

  // If no set headers found, use blank-line-separated format
  if (!hasSetHeaders) {
    const blankLineResult = parseBlankLineSeparatedFormat(input);

    // Check if we detected a setlist title in the blank-line format
    if (blankLineResult.setlistTitle) {
      console.log(
        `Detected setlist title from blank-line format: "${blankLineResult.setlistTitle}"`
      );
      // Add the setlist title to the main result
      blankLineResult.setlistTitle = blankLineResult.setlistTitle;
    }

    return blankLineResult;
  }

  // Otherwise, use the existing header-based format
  const lines = rawLines.map((line) => line.trim()).filter((line) => line);

  const result = {
    sets: [],
    songs: [],
    errors: [],
    setlistTitle: null, // Add setlist title field
  };

  let currentSet = null;
  let useColonFormat = true; // Default to colon format
  let setCounter = 0; // Track how many sets we've created

  // Check first line to determine format
  if (lines.length > 0) {
    const firstLine = lines[0];
    const colonFormat =
      /^Set\s+(\d+|[IVX]+):\s*$/i.test(firstLine) ||
      /^Encore:\s*$/i.test(firstLine) ||
      /^E:\s*$/i.test(firstLine);
    const noColonFormat =
      /^Set\s+(\d+|[IVX]+)\s*$/i.test(firstLine) ||
      /^Encore\s*$/i.test(firstLine) ||
      /^E\s*$/i.test(firstLine);

    if (noColonFormat && !colonFormat) {
      useColonFormat = false;
    }
  }

  // Check if first line is a setlist title (followed by two blank lines in original input)
  const originalLines = input.trim().split("\n");
  if (
    originalLines.length >= 3 &&
    originalLines[1].trim() === "" &&
    originalLines[2].trim() === "" &&
    !/^Set\s+(\d+|[IVX]+)[\s:]*$/i.test(originalLines[0]) &&
    !/^Encore[\s:]*$/i.test(originalLines[0]) &&
    !/^E[\s:]*$/i.test(originalLines[0])
  ) {
    result.setlistTitle = originalLines[0].trim();
    console.log(
      `Detected setlist title from header format: "${result.setlistTitle}"`
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let setMatch = null;
    let setNumber = null;
    let setName = line;

    // Always check for both colon and no-colon formats
    // Check for set headers with colon first
    setMatch = line.match(/^Set\s+(\d+|[IVX]+):\s*$/i);
    if (!setMatch) {
      setMatch = line.match(/^Encore:\s*$/i);
      if (setMatch) {
        setNumber = Math.min(setCounter + 1, 4); // Encore becomes next available set (max 4)
      }
    }
    if (!setMatch) {
      setMatch = line.match(/^E:\s*$/i);
      if (setMatch) {
        setNumber = Math.min(setCounter + 1, 4); // E: becomes next available set (max 4)
      }
    }

    // If no colon format matched, try no-colon format
    if (!setMatch) {
      setMatch = line.match(/^Set\s+(\d+|[IVX]+)\s*$/i);
      if (!setMatch) {
        setMatch = line.match(/^Encore\s*$/i);
        if (setMatch) {
          setNumber = Math.min(setCounter + 1, 4); // Encore becomes next available set (max 4)
        }
      }
      if (!setMatch) {
        setMatch = line.match(/^E\s*$/i);
        if (setMatch) {
          setNumber = Math.min(setCounter + 1, 4); // E becomes next available set (max 4)
        }
      }
    }

    if (setMatch) {
      // Parse set number
      if (setNumber === null) {
        const setIdentifier = setMatch[1];
        if (/^\d+$/.test(setIdentifier)) {
          // Regular number
          setNumber = parseInt(setIdentifier);
        } else {
          // Roman numeral
          setNumber = romanToNumber(setIdentifier);
        }
      }

      // Handle set limits: max 4 numbered sets, everything else goes to MAYBE
      if (setNumber && setNumber <= 4) {
        setCounter = Math.max(setCounter, setNumber);
        currentSet = {
          name: setName,
          setNumber: setNumber,
          songs: [],
        };
      } else {
        // Beyond 4 sets goes to Maybe
        currentSet = {
          name: "Maybe",
          setNumber: 999, // Special number for Maybe set
          songs: [],
        };
      }

      // Check if we already have this set
      const existingSet = result.sets.find(
        (s) => s.setNumber === currentSet.setNumber
      );
      if (!existingSet) {
        result.sets.push(currentSet);
      } else {
        currentSet = existingSet; // Use existing set
      }
      continue;
    }

    // If we don't have a current set, create a default one
    if (!currentSet) {
      currentSet = {
        name: "Set 1",
        setNumber: 1,
        songs: [],
      };
      result.sets.push(currentSet);
    }

    // Parse song line - format: "Song Title, Artist" or just "Song Title"
    const parts = line.split(",").map((part) => part.trim());

    if (parts.length > 2) {
      result.errors.push(
        `Line ${i + 1}: Too many commas. Format should be "Song Title, Artist" or just "Song Title"`
      );
      continue;
    }

    if (parts[0] === "") {
      result.errors.push(`Line ${i + 1}: Empty song title`);
      continue;
    }

    // Trim '>' and '->' from song titles (common in jam band setlists)
    // Example: "The Music Never Stopped >" or "The Music Never Stopped ->" becomes "The Music Never Stopped"
    let songTitle = parts[0].trim();
    if (songTitle.endsWith("->")) {
      songTitle = songTitle.slice(0, -2).trim(); // Remove '->' and trim again
    } else if (songTitle.endsWith(">")) {
      songTitle = songTitle.slice(0, -1).trim(); // Remove '>' and trim again
    }

    const song = {
      title: songTitle,
      artist: parts.length > 1 ? parts[1] : "",
      setNumber: currentSet.setNumber,
      lineNumber: i + 1,
    };

    currentSet.songs.push(song);
    result.songs.push(song);
  }

  if (result.songs.length === 0) {
    result.errors.push("No songs found. Please enter at least one song.");
  }

  // Handle duplicate song titles by adding "Reprise" to subsequent occurrences
  const songTitleCounts = {};

  result.songs.forEach((song) => {
    const normalizedTitle = song.title.toLowerCase().trim();

    if (songTitleCounts[normalizedTitle]) {
      // This is a duplicate - add "Reprise" to the title
      song.title = `${song.title} Reprise`;
      songTitleCounts[normalizedTitle]++;
    } else {
      // First occurrence - just track it
      songTitleCounts[normalizedTitle] = 1;
    }
  });

  return result;
}

// GET /bands/:id/venues/:venueId - Show a specific venue in the context of a band, with opportunities
router.get("/:id/venues/:venueId", requireAuth, async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(venueId) },
      include: {
        venueType: true,
        contacts: {
          include: {
            contactType: true,
          },
        },
        socials: {
          include: {
            socialType: true,
          },
        },
      },
    });

    if (!band || !venue) {
      req.flash("error", "Band or Venue not found");
      return res.redirect("/bands");
    }

    const opportunities = await prisma.opportunity.findMany({
      where: {
        bandId: parseInt(bandId),
        venueId: parseInt(venueId),
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get gig history for this band at this venue
    const gigs = await prisma.gig.findMany({
      where: {
        bandId: parseInt(bandId),
        venueId: parseInt(venueId),
      },
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        gigDate: "desc",
      },
    });

    // Get venue contact types that this venue actually has
    const venueContactTypes = await prisma.venueContactType.findMany({
      where: {
        isActive: true,
        contacts: {
          some: {
            venueId: parseInt(venueId),
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    res.render("bands/venue-opportunity", {
      pageTitle: `${band.name} @ ${venue.name}`,
      hasBandHeader: false,
      band,
      venue,
      opportunities,
      gigs,
      venueContactTypes,
    });
  } catch (error) {
    logger.logError("Band venue opportunity page error:", error);
    req.flash("error", "An error occurred loading the venue page");
    res.redirect(`/bands/${req.params.bandId}/venues`);
  }
});

// GET /bands/:id/venues - Show band's venues
router.get("/:id/venues", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get band details
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Get band's venues
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
            contacts: {
              include: {
                contactType: true,
              },
            },
            socials: {
              include: {
                socialType: true,
              },
            },
            opportunities: {
              where: {
                bandId: parseInt(bandId),
                status: {
                  not: "ARCHIVED",
                },
              },
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.render("bands/venues", {
      pageTitle: "Get Booked",
      band,
      hasBandHeader: false,
      bandVenues,
    });
  } catch (error) {
    logger.logError("Band venues error:", error);
    req.flash("error", "An error occurred loading band venues");
    res.redirect("/bands");
  }
});

// GET /bands/:id/gigs - Show band's gigs
router.get("/:id/gigs", requireAuth, async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get band with gigs
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        gigs: {
          include: {
            venue: true,
            opportunity: true,
          },
          orderBy: {
            gigDate: "asc",
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    res.render("bands/gigs", {
      pageTitle: `${band.name} Gigs`,
      band,
      hasBandHeader: false,
    });
  } catch (error) {
    logger.logError("Band gigs error:", error);
    req.flash("error", "An error occurred loading band gigs");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// GET /bands/:id/gigs/new - Show new gig form
router.get("/:id/gigs/new", requireAuth, async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get band with venues
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        venues: {
          include: {
            venue: true,
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    res.render("bands/gig-new", {
      pageTitle: `New Gig - ${band.name}`,
      band,
      hasBandHeader: false,
    });
  } catch (error) {
    logger.logError("New gig form error:", error);
    req.flash("error", "An error occurred loading the new gig form");
    res.redirect(`/bands/${req.params.id}/gigs`);
  }
});

// GET /bands/:id/gigs/:gigId - Show individual gig
router.get("/:id/gigs/:gigId", requireAuth, async (req, res) => {
  try {
    const { id: bandId, gigId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get gig with all details
    const gig = await prisma.gig.findFirst({
      where: {
        id: parseInt(gigId),
        bandId: parseInt(bandId),
      },
      include: {
        venue: {
          include: {
            venueType: true,
            contacts: {
              include: {
                contactType: true,
              },
            },
          },
        },
        band: true,
        opportunity: {
          include: {
            interactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
              orderBy: {
                interactionDate: "desc",
              },
              take: 5, // Show latest 5 interactions
            },
          },
        },
      },
    });

    if (!gig) {
      req.flash("error", "Gig not found");
      return res.redirect(`/bands/${bandId}/gigs`);
    }

    res.render("bands/gig-detail", {
      pageTitle: gig.name,
      band: gig.band,
      gig,
      hasBandHeader: false,
    });
  } catch (error) {
    logger.logError("Gig detail error:", error);
    req.flash("error", "An error occurred loading the gig");
    res.redirect(`/bands/${req.params.id}/gigs`);
  }
});

// GET /bands/:id/gigs/:gigId/edit - Show gig edit form
router.get("/:id/gigs/:gigId/edit", requireAuth, async (req, res) => {
  try {
    const { id: bandId, gigId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get gig with venues
    const gig = await prisma.gig.findFirst({
      where: {
        id: parseInt(gigId),
        bandId: parseInt(bandId),
      },
      include: {
        venue: true,
        band: {
          include: {
            venues: {
              include: {
                venue: true,
              },
            },
          },
        },
      },
    });

    if (!gig) {
      req.flash("error", "Gig not found");
      return res.redirect(`/bands/${bandId}/gigs`);
    }

    res.render("bands/gig-edit", {
      pageTitle: `Edit ${gig.name}`,
      band: gig.band,
      gig,
      hasBandHeader: false,
    });
  } catch (error) {
    logger.logError("Gig edit form error:", error);
    req.flash("error", "An error occurred loading the gig edit form");
    res.redirect(`/bands/${req.params.id}/gigs/${req.params.gigId}`);
  }
});

// POST /bands/:id/gigs/:gigId - Update gig
router.post(
  "/:id/gigs/:gigId",
  requireAuth,
  [
    body("name").notEmpty().withMessage("Gig name is required"),
    body("gigDate")
      .notEmpty()
      .withMessage("Gig date is required")
      .isISO8601()
      .withMessage("Invalid date format"),
    body("venueId")
      .notEmpty()
      .withMessage("Venue is required")
      .isInt()
      .withMessage("Invalid venue"),
    body("fee")
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage("Fee must be a positive number"),
    body("loadInTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid load-in time format"),
    body("soundCheckTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid sound check time format"),
    body("startTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid start time format"),
    body("endTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid end time format"),
  ],
  async (req, res) => {
    try {
      const { id: bandId, gigId } = req.params;
      const userId = req.session.user.id;

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/bands/${bandId}/gigs/${gigId}/edit`);
      }

      // Check if user is a member
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId },
      });

      if (!membership) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      // Verify gig exists and belongs to band
      const existingGig = await prisma.gig.findFirst({
        where: {
          id: parseInt(gigId),
          bandId: parseInt(bandId),
        },
      });

      if (!existingGig) {
        req.flash("error", "Gig not found");
        return res.redirect(`/bands/${bandId}/gigs`);
      }

      const {
        name,
        gigDate,
        venueId,
        fee,
        loadInTime,
        soundCheckTime,
        startTime,
        endTime,
        notes,
        status,
        ticketLink,
        facebookEventLink,
      } = req.body;

      // Convert time strings to DateTime objects if provided
      const gigDateTime = new Date(gigDate);
      const loadInDateTime = loadInTime
        ? new Date(`${gigDate}T${loadInTime}:00`)
        : null;
      const soundCheckDateTime = soundCheckTime
        ? new Date(`${gigDate}T${soundCheckTime}:00`)
        : null;
      const startDateTime = startTime
        ? new Date(`${gigDate}T${startTime}:00`)
        : null;
      const endDateTime = endTime ? new Date(`${gigDate}T${endTime}:00`) : null;

      // Update the gig
      await prisma.gig.update({
        where: { id: parseInt(gigId) },
        data: {
          name,
          gigDate: gigDateTime,
          venueId: parseInt(venueId),
          fee: fee ? parseFloat(fee) : null,
          loadInTime: loadInDateTime,
          soundCheckTime: soundCheckDateTime,
          startTime: startDateTime,
          endTime: endDateTime,
          notes: notes || null,
          ticketLink: ticketLink || null,
          facebookEventLink: facebookEventLink || null,
          status: status || "CONFIRMED",
        },
      });

      req.flash("success", "Gig updated successfully!");
      res.redirect(`/bands/${bandId}/gigs/${gigId}`);
    } catch (error) {
      logger.logError("Update gig error:", error);
      req.flash("error", "An error occurred while updating the gig");
      res.redirect(`/bands/${req.params.id}/gigs/${req.params.gigId}/edit`);
    }
  }
);

// DELETE /bands/:id/gigs/:gigId - Delete gig
router.delete("/:id/gigs/:gigId", requireAuth, async (req, res) => {
  try {
    const { id: bandId, gigId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Verify gig exists and belongs to band
    const gig = await prisma.gig.findFirst({
      where: {
        id: parseInt(gigId),
        bandId: parseInt(bandId),
      },
    });

    if (!gig) {
      req.flash("error", "Gig not found");
      return res.redirect(`/bands/${bandId}/gigs`);
    }

    // Delete the gig
    await prisma.gig.delete({
      where: { id: parseInt(gigId) },
    });

    req.flash("success", "Gig deleted successfully!");
    res.redirect(`/bands/${bandId}/gigs`);
  } catch (error) {
    logger.logError("Delete gig error:", error);
    req.flash("error", "An error occurred while deleting the gig");
    res.redirect(`/bands/${req.params.id}/gigs/${req.params.gigId}`);
  }
});

// POST /bands/:id/gigs/:gigId/delete - Workaround for DELETE requests (form compatibility)
router.post("/:id/gigs/:gigId/delete", requireAuth, async (req, res) => {
  try {
    const { id: bandId, gigId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Verify gig exists and belongs to band
    const gig = await prisma.gig.findFirst({
      where: {
        id: parseInt(gigId),
        bandId: parseInt(bandId),
      },
    });

    if (!gig) {
      req.flash("error", "Gig not found");
      return res.redirect(`/bands/${bandId}/gigs`);
    }

    // Delete the gig
    await prisma.gig.delete({
      where: { id: parseInt(gigId) },
    });

    req.flash("success", "Gig deleted successfully!");
    res.redirect(`/bands/${bandId}/gigs`);
  } catch (error) {
    logger.logError("Delete gig error:", error);
    req.flash("error", "An error occurred while deleting the gig");
    res.redirect(`/bands/${req.params.id}/gigs/${req.params.gigId}`);
  }
});

// POST /bands/:id/gigs - Create new gig
router.post(
  "/:id/gigs",
  requireAuth,
  [
    body("name").notEmpty().withMessage("Gig name is required"),
    body("gigDate")
      .notEmpty()
      .withMessage("Gig date is required")
      .isISO8601()
      .withMessage("Invalid date format"),
    body("venueId")
      .notEmpty()
      .withMessage("Venue is required")
      .isInt()
      .withMessage("Invalid venue"),
    body("fee")
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage("Fee must be a positive number"),
    body("loadInTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid load-in time format"),
    body("soundCheckTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid sound check time format"),
    body("startTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid start time format"),
    body("endTime")
      .optional({ checkFalsy: true })
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid end time format"),
  ],
  async (req, res) => {
    try {
      const bandId = req.params.id;
      const userId = req.session.user.id;

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash(
          "error",
          errors
            .array()
            .map((error) => error.msg)
            .join(", ")
        );
        return res.redirect(`/bands/${bandId}/gigs/new`);
      }

      // Check if user is a member
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId },
      });

      if (!membership) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const {
        name,
        gigDate,
        venueId,
        fee,
        loadInTime,
        soundCheckTime,
        startTime,
        endTime,
        notes,
        ticketLink,
        facebookEventLink,
      } = req.body;

      // Verify venue belongs to band
      const bandVenue = await prisma.bandVenue.findFirst({
        where: {
          bandId: parseInt(bandId),
          venueId: parseInt(venueId),
        },
      });

      if (!bandVenue) {
        req.flash("error", "Selected venue is not associated with this band");
        return res.redirect(`/bands/${bandId}/gigs/new`);
      }

      // Helper function to combine date with time
      const combineDateTime = (dateString, timeString) => {
        if (!timeString) return null;
        const date = new Date(dateString);
        const [hours, minutes] = timeString.split(":");
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return date;
      };

      // Create the gig
      const gig = await prisma.gig.create({
        data: {
          name: name.trim(),
          gigDate: new Date(gigDate),
          loadInTime: combineDateTime(gigDate, loadInTime),
          soundCheckTime: combineDateTime(gigDate, soundCheckTime),
          startTime: combineDateTime(gigDate, startTime),
          endTime: combineDateTime(gigDate, endTime),
          fee: fee ? parseFloat(fee) : null,
          notes: notes ? notes.trim() : null,
          ticketLink: ticketLink ? ticketLink.trim() : null,
          facebookEventLink: facebookEventLink
            ? facebookEventLink.trim()
            : null,
          status: "CONFIRMED",
          bandId: parseInt(bandId),
          venueId: parseInt(venueId),
        },
      });

      logger.logInfo(`Created gig ${gig.id} for band ${bandId}`);
      req.flash("success", "Gig created successfully!");
      res.redirect(`/bands/${bandId}/gigs`);
    } catch (error) {
      logger.logError("Create gig error:", error);
      req.flash("error", "An error occurred creating the gig");
      res.redirect(`/bands/${req.params.id}/gigs/new`);
    }
  }
);

// GET /bands/:id/venue-picker - Show band's venue picker
router.get("/:id/venue-picker", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    // Get all venues
    const allVenues = await prisma.venue.findMany({
      include: {
        venueType: true,
      },
      orderBy: { name: "asc" },
    });

    // Get band's current venues
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
          },
        },
      },
    });

    const bandVenueIds = bandVenues.map((bv) => bv.venueId);

    res.render("bands/venue-picker", {
      pageTitle: `${band.name} Venue Picker`,
      band,
      hasBandHeader: false,
      allVenues,
      bandVenueIds,
    });
  } catch (error) {
    logger.logError("Band venue picker error:", error);
    req.flash("error", "An error occurred loading band venues");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/venues/:venueId - Add venue to band
router.post("/:id/venues/:venueId", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already added
    const existing = await prisma.bandVenue.findFirst({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    if (existing) {
      return res.status(400).json({ error: "Venue already in band" });
    }

    await prisma.bandVenue.create({
      data: {
        bandId: parseInt(bandId),
        venueId: parseInt(venueId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Add band venue error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/venues/:venueId - Remove venue from band
router.delete("/:id/venues/:venueId", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandVenue.deleteMany({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band venue error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/venues/:venueId/remove - Workaround for DELETE requests
router.post("/:id/venues/:venueId/remove", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandVenue.deleteMany({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band venue error (POST):", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:bandId/venues/:venueId/opportunities - Create a new opportunity
router.post(
  "/:bandId/venues/:venueId/opportunities",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, venueId } = req.params;
      const { name, interactionType, notes } = req.body;
      const userId = req.session.user.id;

      // Map form values to InteractionType enum values
      const interactionTypeMap = {
        email: "EMAIL",
        phone: "PHONE_CALL",
        text: "TEXT",
        in_person: "IN_PERSON",
        note: "NOTE",
      };

      const mappedInteractionType =
        interactionTypeMap[interactionType] || "NOTE";

      const opportunity = await prisma.opportunity.create({
        data: {
          name,
          notes: notes || null,
          band: { connect: { id: parseInt(bandId) } },
          venue: { connect: { id: parseInt(venueId) } },
          creator: { connect: { id: userId } },
        },
      });

      // Redirect to interaction form with the interaction type as a parameter
      req.flash(
        "success",
        "New opportunity started! Now let's log your first interaction."
      );
      res.redirect(
        `/bands/${bandId}/opportunities/${opportunity.id}/interactions/new?type=${encodeURIComponent(interactionType)}`
      );
    } catch (error) {
      logger.logError("Create opportunity error:", error);
      req.flash("error", "An error occurred while starting a new opportunity");
      res.redirect(`/bands/${req.params.bandId}/venues/${req.params.venueId}`);
    }
  }
);

// GET /bands/:id/opportunities - List all opportunities for a band
router.get("/:id/opportunities", requireAuth, async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Get band with members to check access
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Check if user is a member of the band
    const isMember = band.members.some((member) => member.user.id === userId);
    if (!isMember) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get all opportunities for this band with related data
    const opportunities = await prisma.opportunity.findMany({
      where: {
        bandId: parseInt(bandId),
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            address: true,
            zipCode: true,
          },
        },
        interactions: {
          select: {
            id: true,
            interactionDate: true,
            type: true,
          },
          orderBy: {
            interactionDate: "desc",
          },
          take: 1, // Get the most recent interaction
        },
        creator: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.render("bands/opportunities", {
      pageTitle: `${band.name} - Opportunities`,
      hasBandHeader: false,
      band,
      opportunities,
    });
  } catch (error) {
    logger.logError("List opportunities error:", error);
    req.flash("error", "An error occurred while loading opportunities");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:bandId/opportunities/:opportunityId/delete - Delete an opportunity
router.post(
  "/:bandId/opportunities/:opportunityId/delete",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const userId = req.session.user.id;

      // Get band with members to check access
      const band = await prisma.band.findUnique({
        where: { id: parseInt(bandId) },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
      });

      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      // Check if user is a member of the band
      const isMember = band.members.some((member) => member.user.id === userId);
      if (!isMember) {
        req.flash("error", "You don't have permission to access this band");
        return res.redirect("/bands");
      }

      // Get the opportunity to verify it belongs to this band
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          venue: {
            select: { name: true },
          },
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/opportunities`);
      }

      if (opportunity.bandId !== parseInt(bandId)) {
        req.flash("error", "Opportunity does not belong to this band");
        return res.redirect(`/bands/${bandId}/opportunities`);
      }

      // Delete the opportunity (this will cascade delete related interactions)
      await prisma.opportunity.delete({
        where: { id: parseInt(opportunityId) },
      });

      req.flash(
        "success",
        `Opportunity for "${opportunity.venue.name}" has been deleted`
      );
      res.redirect(`/bands/${bandId}/opportunities`);
    } catch (error) {
      logger.logError("Delete opportunity error:", error);
      req.flash("error", "An error occurred while deleting the opportunity");
      res.redirect(`/bands/${req.params.bandId}/opportunities`);
    }
  }
);

// GET /bands/:bandId/opportunities/:opportunityId - Show individual opportunity detail
router.get(
  "/:bandId/opportunities/:opportunityId",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const userId = req.session.user.id;

      // Get opportunity with all related data
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          band: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, username: true },
                  },
                },
              },
            },
          },
          venue: {
            include: {
              venueType: true,
              contacts: {
                include: {
                  contactType: true,
                },
              },
              socials: {
                include: {
                  socialType: true,
                },
              },
            },
          },
          interactions: {
            include: {
              user: {
                select: { username: true },
              },
            },
            orderBy: {
              interactionDate: "desc",
            },
          },
          creator: {
            select: { username: true },
          },
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/venues`);
      }

      // Check if user is a member of the band
      const isMember = opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      res.render("bands/opportunity-detail", {
        pageTitle: `${opportunity.name} - ${opportunity.venue.name}`,
        hasBandHeader: false,
        opportunity,
        bandId,
      });
    } catch (error) {
      logger.logError("Opportunity detail error:", error);
      req.flash("error", "An error occurred loading the opportunity");
      res.redirect(`/bands/${req.params.bandId}/venues`);
    }
  }
);

// GET /bands/:bandId/opportunities/:opportunityId/edit - Show edit opportunity form
router.get(
  "/:bandId/opportunities/:opportunityId/edit",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const userId = req.session.user.id;

      // Get opportunity with basic data
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          band: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true },
                  },
                },
              },
            },
          },
          venue: true,
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/venues`);
      }

      // Check if user is a member of the band
      const isMember = opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      res.render("bands/opportunity-edit", {
        pageTitle: `${opportunity.band.name} @ ${opportunity.venue.name}`,
        hasBandHeader: false,
        opportunity,
        bandId,
      });
    } catch (error) {
      logger.logError("Edit opportunity form error:", error);
      req.flash("error", "An error occurred loading the edit form");
      res.redirect(
        `/bands/${req.params.bandId}/opportunities/${req.params.opportunityId}`
      );
    }
  }
);

// POST /bands/:bandId/opportunities/:opportunityId/update - Update opportunity
router.post(
  "/:bandId/opportunities/:opportunityId/update",
  requireAuth,
  [
    body("name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Opportunity name is required"),
    body("status")
      .isIn(["PROSPECTING", "CONTACTED", "NEGOTIATING", "BOOKED", "ARCHIVED"])
      .withMessage("Invalid status"),
    body("gigDate")
      .optional({ checkFalsy: true })
      .isISO8601()
      .withMessage("Invalid gig date format"),
    body("offerValue")
      .optional({ checkFalsy: true })
      .isFloat({ min: 0 })
      .withMessage("Offer value must be a positive number"),
  ],
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const { name, status, gigDate, offerValue, notes } = req.body;
      const userId = req.session.user.id;

      // Verify opportunity exists and user has access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          band: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true },
                  },
                },
              },
            },
          },
          venue: true,
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/venues`);
      }

      // Check if user is a member of the band
      const isMember = opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("bands/opportunity-edit", {
          pageTitle: `${opportunity.band.name} @ ${opportunity.venue.name}`,
          hasBandHeader: false,
          opportunity,
          bandId,
          errors: errors.array(),
          name: req.body.name,
          status: req.body.status,
          gigDate: req.body.gigDate,
          offerValue: req.body.offerValue,
          notes: req.body.notes,
        });
      }

      // Update the opportunity
      await prisma.opportunity.update({
        where: { id: parseInt(opportunityId) },
        data: {
          name: name.trim(),
          notes: notes || null,
          status: status,
          gigDate: gigDate ? new Date(gigDate) : null,
          offerValue: offerValue ? parseFloat(offerValue) : null,
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Opportunity updated successfully!");
      res.redirect(`/bands/${bandId}/opportunities/${opportunityId}`);
    } catch (error) {
      logger.logError("Update opportunity error:", error);
      req.flash("error", "An error occurred updating the opportunity");
      res.redirect(
        `/bands/${req.params.bandId}/opportunities/${req.params.opportunityId}/edit`
      );
    }
  }
);

// GET /bands/:bandId/opportunities/:opportunityId/interactions/new - Show new interaction form
router.get(
  "/:bandId/opportunities/:opportunityId/interactions/new",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const interactionType = req.query.type;
      const userId = req.session.user.id;

      // Verify opportunity exists and user has access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          band: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true },
                  },
                },
              },
            },
          },
          venue: {
            include: {
              contacts: {
                include: {
                  contactType: true,
                },
              },
            },
          },
          interactions: {
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
            orderBy: {
              interactionDate: "desc",
            },
          },
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/venues`);
      }

      // Check if user is a member of the band
      const isMember = opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      res.render("bands/interaction-new", {
        pageTitle: `${opportunity.band.name} @ ${opportunity.venue.name}`,
        hasBandHeader: false,
        opportunity,
        interactionType,
        bandId,
        currentUser: req.session.user,
      });
    } catch (error) {
      logger.logError("Interaction form error:", error);
      req.flash("error", "An error occurred loading the interaction form");
      res.redirect(`/bands/${req.params.bandId}/venues`);
    }
  }
);

// Get individual interaction detail
router.get(
  "/:bandId/opportunities/:opportunityId/interactions/:interactionId",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId, interactionId } = req.params;
      const userId = req.session.user.id;

      // Validate interactionId
      if (!interactionId || isNaN(parseInt(interactionId))) {
        req.flash("error", "Invalid interaction ID");
        return res.redirect(`/bands/${bandId}/opportunities/${opportunityId}`);
      }

      // Get interaction with all related data
      const interaction = await prisma.interaction.findUnique({
        where: { id: parseInt(interactionId) },
        include: {
          opportunity: {
            include: {
              band: {
                include: {
                  members: {
                    include: {
                      user: {
                        select: { id: true },
                      },
                    },
                  },
                },
              },
              venue: true,
            },
          },
          user: {
            select: { id: true, username: true },
          },
        },
      });

      if (!interaction) {
        req.flash("error", "Interaction not found");
        return res.redirect(`/bands/${bandId}/opportunities/${opportunityId}`);
      }

      // Check if user is a member of the band
      const isMember = interaction.opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      res.render("bands/interaction-detail", {
        pageTitle: `${interaction.opportunity.band.name} @ ${interaction.opportunity.venue.name}`,
        hasBandHeader: false,
        interaction,
        bandId,
        opportunityId,
      });
    } catch (error) {
      logger.logError("Get interaction detail error:", error);
      req.flash("error", "An error occurred while loading the interaction");
      res.redirect(
        `/bands/${req.params.bandId}/opportunities/${req.params.opportunityId}`
      );
    }
  }
);

// POST /bands/:bandId/opportunities/:opportunityId/interactions - Create new interaction
router.post(
  "/:bandId/opportunities/:opportunityId/interactions",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const {
        type,
        interactionDate,
        notes,
        outcome,
        nextSteps,
        messageContent,
        previousResponse,
        gigDate,
      } = req.body;
      const userId = req.session.user.id;

      // Verify opportunity exists and user has access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: parseInt(opportunityId) },
        include: {
          band: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!opportunity) {
        req.flash("error", "Opportunity not found");
        return res.redirect(`/bands/${bandId}/venues`);
      }

      // Check if user is a member of the band
      const isMember = opportunity.band.members.some(
        (member) => member.user.id === userId
      );
      if (!isMember) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      // Use the type directly (should match venue_contact_types.name)
      const interactionType = type || "NOTE";

      // Create the interaction
      const interaction = await prisma.interaction.create({
        data: {
          type: interactionType,
          notes: notes.trim(),
          messageContent: messageContent?.trim() || null,
          previousResponse: previousResponse?.trim() || null,
          outcome: outcome || null,
          nextSteps: nextSteps?.trim() || null,
          interactionDate: new Date(interactionDate),
          opportunity: { connect: { id: parseInt(opportunityId) } },
          user: { connect: { id: userId } },
          createdAt: new Date(),
        },
      });

      // Update opportunity status based on interaction outcome
      if (outcome) {
        const newOpportunityStatus = mapOutcomeToOpportunityStatus(outcome);
        const updateData = {};

        if (
          newOpportunityStatus &&
          newOpportunityStatus !== opportunity.status
        ) {
          updateData.status = newOpportunityStatus;
        }

        // If outcome is BOOKED and gigDate is provided, save it to the opportunity
        if (outcome === "BOOKED" && gigDate) {
          updateData.gigDate = new Date(gigDate);
          logger.logInfo(
            `Setting gig date for opportunity ${opportunityId}: ${gigDate}`
          );
        }

        // Only update if there's something to update
        if (Object.keys(updateData).length > 0) {
          const updatedOpportunity = await prisma.opportunity.update({
            where: { id: parseInt(opportunityId) },
            data: updateData,
            include: {
              band: true,
              venue: true,
              gig: true,
            },
          });
          logger.logInfo(
            `Updated opportunity ${opportunityId} - Status: ${updateData.status || "unchanged"}, Gig Date: ${updateData.gigDate || "unchanged"}`
          );

          // Create gig record if status is BOOKED and gigDate is set, and no gig exists yet
          if (
            updatedOpportunity.status === "BOOKED" &&
            updatedOpportunity.gigDate &&
            !updatedOpportunity.gig
          ) {
            const gig = await prisma.gig.create({
              data: {
                name: updatedOpportunity.name,
                gigDate: updatedOpportunity.gigDate,
                bandId: updatedOpportunity.bandId,
                venueId: updatedOpportunity.venueId,
                opportunityId: updatedOpportunity.id,
                fee: updatedOpportunity.offerValue,
                status: "CONFIRMED",
              },
            });
            logger.logInfo(
              `Created gig ${gig.id} for opportunity ${opportunityId}`
            );
          }
        }
      }

      req.flash("success", "Interaction logged successfully!");
      res.redirect(`/bands/${bandId}/venues/${opportunity.venueId}`);
    } catch (error) {
      logger.logError("Create interaction error:", error);
      req.flash("error", "An error occurred while logging the interaction");
      res.redirect(
        `/bands/${req.params.bandId}/opportunities/${req.params.opportunityId}/interactions/new?type=${encodeURIComponent(req.body.type)}`
      );
    }
  }
);

// POST /bands/:bandId/opportunities/:opportunityId/ai-suggestions - Generate AI suggestions
router.post(
  "/:bandId/opportunities/:opportunityId/ai-suggestions",
  requireAuth,
  async (req, res) => {
    try {
      const { bandId, opportunityId } = req.params;
      const {
        previousResponse,
        currentMessage,
        interactionType,
        contactType,
        bandName,
        venueName,
        bandInfo,
        userInfo,
        contactInfo,
        additionalInstructions,
      } = req.body;

      // Verify access and get opportunity with interaction history
      const opportunity = await prisma.opportunity.findFirst({
        where: {
          id: parseInt(opportunityId),
          band: {
            id: parseInt(bandId),
            members: {
              some: {
                userId: req.session.user.id,
              },
            },
          },
        },
        include: {
          venue: true,
          band: true,
          interactions: {
            orderBy: {
              interactionDate: "asc",
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!opportunity) {
        return res
          .status(404)
          .json({ success: false, error: "Opportunity not found" });
      }

      // Generate AI suggestion using Gemini
      const suggestion = await generateAISuggestion({
        previousResponse,
        currentMessage,
        interactionType,
        contactType,
        bandName,
        venueName,
        bandInfo,
        userInfo,
        contactInfo,
        additionalInstructions,
        opportunity,
        interactionHistory: opportunity.interactions,
      });

      res.json({ success: true, suggestion });
    } catch (error) {
      logger.logError("AI suggestion error", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to generate AI suggestion" });
    }
  }
);

// Function to map interaction outcomes to opportunity statuses
function mapOutcomeToOpportunityStatus(outcome) {
  const outcomeMapping = {
    // Initial contact outcomes
    CONTACTED: "CONTACTED",
    POSITIVE: "NEGOTIATING",
    INTERESTED: "NEGOTIATING",

    // Negotiation outcomes
    FOLLOW_UP: "NEGOTIATING",
    COUNTER_OFFER: "NEGOTIATING",
    SCHEDULING: "NEGOTIATING",
    NO_RESPONSE: "NEGOTIATING",

    // Awaiting confirmation
    NEED_CONFIRMATION: "NEED_CONFIRMATION",
    PENDING_CONFIRMATION: "NEED_CONFIRMATION",
    AWAITING_CONFIRMATION: "NEED_CONFIRMATION",

    // Success outcomes
    BOOKED: "BOOKED",
    CONFIRMED: "BOOKED",
    ACCEPTED: "BOOKED",

    // Closure outcomes
    DECLINED: "ARCHIVED",
    REJECTED: "ARCHIVED",
    CANCELLED: "ARCHIVED",
    NOT_INTERESTED: "ARCHIVED",
  };

  return outcomeMapping[outcome] || null;
}

// Function to generate AI suggestions using Gemini
async function generateAISuggestion(context) {
  const { GoogleGenerativeAI } = require("@google/generative-ai");

  // Initialize Gemini
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  // Build the prompt based on interaction type
  let prompt;

  // Build interaction history for context
  let interactionHistoryText = "No previous interactions";
  if (context.interactionHistory && context.interactionHistory.length > 0) {
    interactionHistoryText = context.interactionHistory
      .map((interaction, index) => {
        const date = new Date(interaction.interactionDate).toLocaleDateString();
        return `${index + 1}. ${date} - ${interaction.outcome} - ${interaction.notes || "No notes"}`;
      })
      .join("\n");
  }

  // Get communication method specific guidance
  const getCommMethodGuidance = (contactType) => {
    // Check if we have platform-specific hints in the contact info
    const venue = context.opportunity?.venue?.name || "";
    const previousResponse = context.previousResponse || "";
    const platformHints = {
      instagram: /@\w+|instagram\.com|insta/i.test(previousResponse + venue),
      twitter: /twitter\.com|tweet|@\w+/i.test(previousResponse + venue),
      facebook: /facebook\.com|fb\.com/i.test(previousResponse + venue),
    };

    switch (contactType) {
      case "TEXT":
      case "TEXT_MESSAGE":
      case "WHATSAPP":
      case "TELEGRAM":
        return "TEXT/SMS - Keep concise, friendly, under 160 characters if possible. Use casual but professional tone.";
      case "FACEBOOK_MESSAGE":
        return "FACEBOOK MESSENGER - Conversational and friendly tone, moderate length, can use emojis.";
      case "INSTAGRAM_MESSAGE":
        return platformHints.instagram
          ? "INSTAGRAM DM (detected @ handle) - Visual-focused, casual tone, use relevant emojis, mention their content if appropriate."
          : "INSTAGRAM MESSAGE - Conversational and friendly tone, moderate length, emoji-friendly.";
      case "TWITTER_MESSAGE":
        return platformHints.twitter
          ? "TWITTER DM (detected @ handle) - Concise, engaging, can reference their tweets, use relevant hashtags/emojis."
          : "TWITTER MESSAGE - Conversational and friendly tone, moderate length, emoji-friendly.";
      case "DISCORD":
      case "WEBSITE_LIVE_CHAT":
        return "CHAT PLATFORM - Very casual and conversational, brief exchanges, can be informal.";
      case "EMAIL":
      case "WEBSITE_CONTACT_FORM":
        return "EMAIL/FORMAL - Can be detailed and formal. Include proper greeting and closing.";
      case "PHONE_CALL":
        return "PHONE CALL - Provide talking points and key messages for the conversation.";
      case "IN_PERSON":
        return "IN-PERSON MEETING - Provide conversation starters and key points to discuss.";
      default:
        return "GENERAL COMMUNICATION - Use appropriate professional tone.";
    }
  };

  // Build personalized salutation
  const getSalutation = () => {
    if (context.contactInfo?.name && context.contactInfo.name.trim()) {
      return `Hi ${context.contactInfo.name}`;
    }
    return `Dear ${context.venueName} Team`;
  };

  const baseContext = `
CONTEXT:
- Band: ${context.bandName}
- Venue: ${context.venueName}
- Current Interaction Type: ${context.interactionType}
- Communication Method: ${getCommMethodGuidance(context.contactType)}
- Contact Person: ${context.contactInfo?.name || "Not specified"}
- Contact Type: ${context.contactInfo?.type || "General"}
- Band's Booking Pitch: ${context.bandInfo.bookingPitch || "Not provided"}
- Band Website: ${context.bandInfo.websiteUrl || "Not provided"}
- Band Contact Name: ${context.bandInfo.contactName || "Not provided"}
- Your Name: ${context.userInfo?.name || "Not provided"}
- Your Email: ${context.userInfo?.email || "Not provided"}
- Salutation to use: ${getSalutation()}

INTERACTION HISTORY (chronological order):
${interactionHistoryText}

VENUE'S LATEST MESSAGE:
"${context.previousResponse}"

CURRENT DRAFT MESSAGE (if any):
"${context.currentMessage || "None provided"}"

ADDITIONAL REFINEMENT INSTRUCTIONS:
"${context.additionalInstructions || "None provided"}"`;

  switch (context.interactionType) {
    case "FIRST_CONTACT":
      prompt = `You are helping a band manager make an initial contact with a venue for booking a gig.
${baseContext}

Please generate a professional, engaging initial outreach message that:
1. Starts with the exact salutation provided above (e.g., "Hi Rodney" or "Dear Woodcellar Team")
2. Introduces the band professionally and warmly
3. Expresses genuine interest in performing at their venue
4. Includes key band information (genre, experience, draw)
5. Mentions specific reasons why this venue is a good fit
6. Suggests next steps (send EPK, schedule call, etc.)
7. Keeps it concise but compelling
8. Avoids specific dates or rates in initial contact
9. ADAPTS LENGTH AND TONE to the communication method specified above
10. Ends with proper signature: "Best regards, [Your Name]" followed by "[Band Name]" on the next line
11. If additional refinement instructions are provided above, incorporate them into the message

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "FOLLOWING_UP":
      prompt = `You are helping a band manager follow up on a previous inquiry with a venue.
${baseContext}

Please generate a professional, polite follow-up message that:
1. References the previous interactions from the history above appropriately
2. Shows awareness of how much time has passed since last contact
3. Gently reminds them of the band's interest without repeating previous information
4. Provides any additional information that might be helpful
5. Shows understanding that venues are busy
6. Suggests easy next steps for them
7. Maintains enthusiasm while respecting their time
8. ADAPTS LENGTH AND TONE to the communication method specified above

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "SCHEDULING":
      prompt = `You are helping a band manager work out scheduling details with a venue.
${baseContext}

Please generate a professional response focused on scheduling that:
1. Responds to their scheduling preferences or constraints
2. Offers specific date options or availability windows
3. Shows flexibility while protecting the band's interests
4. Asks about their preferred lead times and booking process
5. Mentions any scheduling considerations (load-in, sound check, etc.)
6. Keeps the momentum moving toward confirmation
7. Suggests next steps in the booking process

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "NEGOTIATING":
      prompt = `You are helping a band manager negotiate terms with a venue for a gig.
${baseContext}

Please generate a professional negotiation response that:
1. References previous discussions from the interaction history to show continuity
2. Addresses their terms or proposals constructively
3. Presents the band's position clearly but diplomatically
4. Finds common ground and win-win solutions based on what's been discussed
5. Shows appreciation for their business considerations
6. Maintains a collaborative rather than adversarial tone
7. Keeps the focus on mutual benefit and a successful show

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "AWAITING_CONFIRMATION":
      prompt = `You are helping a band manager handle the confirmation phase with a venue.
${baseContext}

Please generate a professional message for the confirmation stage that:
1. Acknowledges where things stand in the process
2. Gently seeks clarity on timeline for final confirmation
3. Confirms the band's continued interest and availability
4. Offers to provide any additional information needed
5. Shows understanding of their decision-making process
6. Maintains enthusiasm while being patient
7. Suggests clear next steps or timeline

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "BOOKED":
      prompt = `You are helping a band manager confirm and accept a gig booking with a venue.
${baseContext}

Please generate a professional booking confirmation message that:
1. Clearly confirms acceptance of the gig offer
2. Expresses genuine excitement and gratitude for the opportunity
3. Confirms all band members are available for the date
4. Acknowledges any key terms that were discussed (fee, set times, etc.)
5. Shows professionalism and reliability
6. Sets a positive tone for the working relationship
7. Indicates readiness to move forward with planning
8. ADAPTS LENGTH AND TONE to the communication method specified above

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "DETAILS":
      prompt = `You are helping a band manager work out production and logistical details for a confirmed gig.
${baseContext}

Please generate a professional message focused on gig details that:
1. Addresses specific production or logistical questions
2. Provides clear, organized information about band requirements
3. Asks relevant questions about their venue and setup
4. Shows preparation and professionalism
5. Confirms understanding of their procedures
6. Offers solutions to any potential challenges
7. Maintains focus on delivering a great show

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "THANKING":
      prompt = `You are helping a band manager send a thoughtful thank you message to a venue.
${baseContext}

Please generate a warm, genuine thank you message that:
1. Expresses sincere gratitude for their time/opportunity/help
2. Acknowledges any specific positive aspects of the interaction
3. Reinforces the band's professionalism and appreciation
4. Keeps the door open for future opportunities
5. Is personal and specific, not generic
6. Shows we value the relationship beyond just this interaction
7. Ends on a positive, forward-looking note
8. ADAPTS LENGTH AND TONE to the communication method specified above

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "REBOOKING":
      prompt = `You are helping a band manager reach out to a venue for a repeat booking.
${baseContext}

Please generate a professional rebooking request that:
1. Starts with the exact salutation provided above (e.g., "Hi Rodney" or "Dear Woodcellar Team")
2. References the positive experience from the previous gig(s)
3. Expresses enthusiasm about returning to perform
4. Mentions any improvements or new material since the last show
5. Suggests potential dates or asks about availability
6. Highlights what made the previous experience successful
7. Shows respect for their booking process and timeline
8. Demonstrates the band's continued professionalism and reliability
9. ADAPTS LENGTH AND TONE to the communication method specified above

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "DECLINED":
      prompt = `You are helping a band manager respond professionally to a venue's decline.
${baseContext}

Please generate a gracious response to their decline that:
1. Thanks them for their time and consideration
2. Accepts their decision professionally and positively
3. Leaves the door open for future opportunities
4. Asks if there might be better timing in the future
5. Maintains the relationship for potential referrals
6. Shows maturity and understanding of business realities
7. Keeps it brief but warm

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    case "NO_RESPONSE":
      prompt = `You are helping a band manager craft a final follow-up to a venue that hasn't responded.
${baseContext}

Please generate a professional final follow-up that:
1. Acknowledges they may be busy or the timing might not be right
2. Briefly restates the band's interest and value proposition
3. Gives them an easy out while leaving the door open
4. Shows understanding and professionalism
5. Includes contact information for future reference
6. Ends on a positive note about potential future opportunities
7. Keeps it concise and non-pressuring

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;

    default:
      // Fallback to original generic prompt for any other cases
      prompt = `You are helping a band manager craft a professional response to a venue for booking a gig.
${baseContext}

Please generate a professional, friendly response that:
1. Responds appropriately to the venue's message
2. Maintains a professional but personable tone
3. Includes relevant band information when appropriate
4. Is concise but informative
5. Moves the conversation toward booking a gig
6. Avoids making specific commitments about dates or rates without band confirmation
7. Ends with proper signature: "Best regards, [Your Name]" followed by "[Band Name]" on the next line
8. If additional refinement instructions are provided above, incorporate them into the message

Generate only the suggested response text, no additional commentary. DO NOT include placeholder text, brackets, or suggestions for customization. Write a complete, ready-to-send message.`;
      break;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.logError("Gemini API error", error);
    throw new Error("Failed to generate AI suggestion");
  }
}

// GET /bands/:bandId/setlists/:setlistId - Show setlist details
router.get("/:bandId/setlists/:setlistId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const userId = req.session.user.id;

    // Clear navigation context when viewing setlist (navigation complete)
    const {
      clearNavigationContext,
    } = require("../middleware/navigationContext");
    clearNavigationContext(req);

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

    // Verify the setlist belongs to the specified band
    if (setlist.band.id !== bandId) {
      req.flash("error", "Setlist not found or access denied");
      return res.redirect("/bands");
    }

    // Check if user is a member of this band
    if (setlist.band.members.length === 0) {
      req.flash("error", "Access denied");
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

    // Get all song IDs from the setlist
    const songIds = [];
    setlist.sets.forEach((set) => {
      if (set.songs) {
        set.songs.forEach((setlistSong) => {
          songIds.push(setlistSong.song.id);
        });
      }
    });

    // Get ALL gig documents for songs in this setlist
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
          }

          // Auto-assign YouTube link if none is set and there's exactly one available
          if (
            !bandSong?.youtube &&
            availableYoutubeLinks.length === 1 &&
            availableYoutubeLinks[0].url
          ) {
            bandSongsToUpdate.push({
              songId: songId,
              youtube: availableYoutubeLinks[0].url,
            });
            autoAssignedCount++;
          }
        });
      }
    });

    // Auto-assign YouTube links if needed
    if (bandSongsToUpdate.length > 0) {
      try {
        await Promise.all(
          bandSongsToUpdate.map((bandSongData) =>
            prisma.bandSong.upsert({
              where: {
                bandId_songId: {
                  bandId: setlist.band.id,
                  songId: bandSongData.songId,
                },
              },
              update: {
                youtube: bandSongData.youtube,
              },
              create: {
                bandId: setlist.band.id,
                songId: bandSongData.songId,
                youtube: bandSongData.youtube,
                createdAt: new Date(),
                updatedAt: new Date(),
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

    // Check if user is over quota (to disable buttons)
    const {
      isUserOverQuota,
      getBandStorageInfo,
      findBestMemberForAttribution,
    } = require("../utils/storageCalculator");

    const userQuotaStatus = await isUserOverQuota(req.session.user.id);

    // Special logic for setlist detail page: if band is over free pool,
    // check if any Pro/Premium members have space and allow recording via their quota
    let quotaStatus = userQuotaStatus;
    let bestMember = null;

    const bandStorageInfo = await getBandStorageInfo(bandId);
    const BAND_FREE_POOL_GB = 2;
    const isBandOverFreePool = bandStorageInfo.usedGB >= BAND_FREE_POOL_GB;

    // Only on setlist detail page: if band is over free pool and user is over quota,
    // check if we can use a member's quota instead
    if (isBandOverFreePool && userQuotaStatus.isOverQuota) {
      bestMember = await findBestMemberForAttribution(bandId);
      if (bestMember && bestMember.remainingGB > 0) {
        // Allow recording, but it will be attributed to bestMember
        quotaStatus = {
          isOverQuota: false,
          canRecordViaMember: true,
          bestMemberId: bestMember.userId,
          bestMemberName: bestMember.username,
          bestMemberPlan: bestMember.planName,
        };
      }
    }

    res.render("setlists/show", {
      title: `${setlist.title} - ${setlist.band.name}`,
      setlist,
      bandSongMap,
      gigDocumentsBySong,
      youtubeLinksBySong,
      songLinkCounts,
      isEditable,
      hasBandHeader: true,
      band: setlist.band,
      getTypeIcon,
      quotaStatus,
      getTypeDisplayName,
    });
  } catch (error) {
    logger.logError("Setlist show error", error);
    req.flash("error", "Error loading setlist");
    res.redirect("/bands");
  }
});

// GET /bands/:bandId/setlists/:setlistId/versions - Get version history
router.get("/:bandId/setlists/:setlistId/versions", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const setlistId = parseInt(req.params.setlistId);
    const userId = req.session.user.id;

    // Verify the setlist belongs to the specified band
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

    if (setlist.band.id !== bandId) {
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

// GET /bands/:bandId/setlists/:setlistId/versions/:versionId/view - View specific version
router.get(
  "/:bandId/setlists/:setlistId/versions/:versionId/view",
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const versionId = parseInt(req.params.versionId);
      const userId = req.session.user.id;

      // Verify the setlist belongs to the specified band
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

      if (setlist.band.id !== bandId) {
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
        pageTitle: `Version ${version.versionNumber} - ${setlist.title}`,
        setlist: setlist,
        version: version,
        versionId: versionId,
        previousVersion: previousVersion,
        nextVersion: nextVersion,
        bandId: bandId,
      });
    } catch (error) {
      logger.logError("View setlist version error", error);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// POST /bands/:bandId/setlists/:setlistId/versions/:versionId/restore - Restore to specific version
router.post(
  "/:bandId/setlists/:setlistId/versions/:versionId/restore",
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.bandId);
      const setlistId = parseInt(req.params.setlistId);
      const versionId = parseInt(req.params.versionId);
      const userId = req.session.user.id;

      // Verify the setlist belongs to the specified band
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

      if (setlist.band.id !== bandId) {
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
  }
);

// POST /bands/:id/start-meeting - Start an instant band meeting
router.post("/:id/start-meeting", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check if user is a member of the band
    const band = await prisma.band.findFirst({
      where: { id: bandId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!band) {
      return res.status(404).json({ error: "Band not found" });
    }

    const isMember = band.members.some((member) => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Not a member of this band" });
    }

    // Create Google Meet meeting
    let meetingData;
    try {
      // Try to create real Google Meet meeting using Google Calendar API
      const { createGoogleMeetMeeting } = require("./google-doc-processing");
      meetingData = await createGoogleMeetMeeting(band.name);
    } catch (meetError) {
      console.error("Google Meet API error:", meetError);

      // Fallback: Use Google Meet's instant meeting feature
      // This redirects to Google Meet where users can start a new meeting
      const { v4: uuidv4 } = require("uuid");
      const meetingId = uuidv4().replace(/-/g, "").substring(0, 8);

      meetingData = {
        meetingLink: `https://meet.google.com/new`,
        meetingId: meetingId,
        hangoutLink: `https://meet.google.com/new`,
      };
    }

    res.json({
      success: true,
      meetingLink: meetingData.meetingLink,
      meetingId: meetingData.meetingId,
      hangoutLink: meetingData.hangoutLink,
    });
  } catch (error) {
    console.error("Start meeting error:", error);
    res.status(500).json({ error: "Failed to start meeting" });
  }
});

// POST /bands/:id/notify-meeting - Send meeting notifications to band members
router.post("/:id/notify-meeting", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { meetingLink } = req.body;

    // Check if user is a member of the band
    const band = await prisma.band.findFirst({
      where: { id: bandId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!band) {
      return res.status(404).json({ error: "Band not found" });
    }

    const isMember = band.members.some((member) => member.userId === userId);
    if (!isMember) {
      return res.status(403).json({ error: "Not a member of this band" });
    }

    // Send email notifications to all band members
    const { sendEmail } = require("../utils/emailService");

    console.log(
      `Sending meeting notifications to ${band.members.length} band members`
    );
    console.log(
      `Band members:`,
      band.members.map((m) => ({
        username: m.user.username,
        email: m.user.email,
      }))
    );

    for (const member of band.members) {
      if (member.user.email) {
        console.log(`Sending notification to ${member.user.email}`);
        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">🎵 Band Meeting Starting!</h2>
            
            <p><strong>${req.session.user.username}</strong> has started an instant meeting for <strong>${band.name}</strong>.</p>
            
            <div style="margin: 30px 0;">
              <a href="${meetingLink}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Join Meeting Now
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${meetingLink}">${meetingLink}</a>
            </p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4 style="margin-top: 0;">Meeting Features:</h4>
              <ul>
                <li>🎥 Video chat with all band members</li>
                <li>📱 Share your screen for sheet music</li>
                <li>🎵 Collaborate on setlists in real-time</li>
                <li>📞 Works on desktop, mobile, and tablet</li>
              </ul>
            </div>
            
            <p style="font-size: 12px; color: #999;">
              This meeting link will remain active until everyone leaves.
            </p>
          </div>
        `;

        try {
          await sendEmail(
            member.user.email,
            `🎵 ${band.name} Band Meeting Starting!`,
            emailContent
          );
          console.log(`Successfully sent notification to ${member.user.email}`);
        } catch (emailError) {
          console.error(
            `Failed to send meeting notification to ${member.user.email}:`,
            emailError
          );
        }
      } else {
        console.log(`Skipping ${member.user.username} - no email address`);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Notify meeting error:", error);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// DELETE /bands/:id - Delete a band
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Get band and verify ownership
    const band = await prisma.band.findUnique({
      where: { id: bandId },
      include: {
        members: true,
      },
    });

    if (!band) {
      return res.status(404).json({ error: "Band not found" });
    }

    // Only band owner can delete
    const isOwner = band.members.some(
      (m) => m.userId === userId && m.role === "owner"
    );

    if (!isOwner) {
      return res
        .status(403)
        .json({ error: "Only the band owner can delete the band" });
    }

    // Delete all associated files first
    console.log(`Deleting files for band ${band.name}...`);
    const { deleted, errors, total } = await deleteBandFiles(bandId);
    console.log(`Deleted ${deleted}/${total} files, ${errors} errors`);

    // Delete band from database (cascades to setlists, albums, etc.)
    await prisma.band.delete({
      where: { id: bandId },
    });

    req.flash(
      "success",
      `Band "${band.name}" and all associated files have been deleted`
    );
    res.json({ success: true, filesDeleted: deleted });
  } catch (error) {
    logger.logError("Delete band error", error);
    res.status(500).json({ error: "Failed to delete band" });
  }
});

// POST /api/client-log - Receive client-side logs (for debugging Safari reloads)
router.post("/api/client-log", express.json(), async (req, res) => {
  try {
    // Handle both JSON body and Blob (from sendBeacon)
    let logPayload;
    if (typeof req.body === "string") {
      // sendBeacon sends as Blob/text
      try {
        logPayload = JSON.parse(req.body);
      } catch (e) {
        logPayload = req.body;
      }
    } else {
      logPayload = req.body;
    }

    const { level, message, data, url, timestamp, userAgent } = logPayload;
    const userId = req.session?.user?.id || null;

    const logMessage = `[CLIENT LOG ${level.toUpperCase()}] ${message}`;
    const logData = {
      url,
      timestamp,
      userAgent,
      data,
      userId,
    };

    if (level === "error") {
      logger.logError(logMessage, JSON.stringify(logData), userId);
    } else if (level === "warn") {
      logger.logWarn(logMessage, userId);
      logger.logInfo(`  Details: ${JSON.stringify(logData)}`, userId);
    } else {
      logger.logInfo(logMessage, userId);
      if (data) {
        logger.logInfo(`  Details: ${JSON.stringify(logData)}`, userId);
      }
    }

    res.json({ success: true });
  } catch (error) {
    logger.logError("Error receiving client log", error);
    res.status(500).json({ error: "Failed to log" });
  }
});

module.exports = router;
