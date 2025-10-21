const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");
const { generateShareTokens, getViewTypeFromToken } = require("../utils/shareTokens");
const { generateUniqueSlug } = require("../utils/slugify");
const { deleteFile, deleteAlbumFiles } = require("../utils/fileCleanup");
const { updateBandStorageUsage } = require("../utils/storageCalculator");
const { checkStorageQuota } = require("../middleware/checkStorageQuota");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Configure multer for album audio uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads/albums");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'track-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Helper function to validate token for public album access
async function validateAlbumToken(albumId, token) {
  if (!token) {
    return false;
  }
  
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { shareTokens: true },
  });
  
  if (!album) {
    return false;
  }
  
  // For albums, we just need to check if the token exists in shareTokens
  // Albums use a single 'player' view type
  const viewType = getViewTypeFromToken(album.shareTokens, token);
  return viewType === 'player';
}

// POST /bands/:id/albums - Create a new album for the band
router.post(
  "/:id/albums",
  requireAuth,
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Album title is required"),
    body("releaseDate")
      .optional()
      .custom((value) => {
        if (value === "" || value === null || value === undefined) {
          return true;
        }
        const date = new Date(value);
        return !isNaN(date.getTime());
      })
      .withMessage("Invalid date format"),
  ],
  async (req, res) => {
    try {
      const bandId = parseInt(req.params.id);
      const userId = req.session.user.id;

      // Verify user is a member of this band
      const band = await prisma.band.findUnique({
        where: { id: bandId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      if (band.members.length === 0) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/bands/${bandId}`);
      }

      // Check if user can create more albums (based on published limit)
      const { canPublishAlbum } = require("../utils/subscriptionHelper");
      const albumCheck = await canPublishAlbum(userId, bandId);
      
      if (!albumCheck.allowed) {
        req.flash("error", albumCheck.message + ' <a href="/pricing">View Plans</a>');
        return res.redirect(`/bands/${bandId}`);
      }

      const { title, releaseDate } = req.body;

      // Create album in transaction
      const album = await prisma.$transaction(async (tx) => {
        const slug = await generateUniqueSlug(tx, title, 'album');

        const newAlbum = await tx.album.create({
          data: {
            title,
            slug,
            bandId,
            createdById: userId,
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            shareTokens: generateShareTokens(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return newAlbum;
      });

      req.flash("success", "Album created successfully!");
      res.redirect(`/bands/${bandId}/albums/${album.id}/edit`);
    } catch (error) {
      logger.logError("Create album error", error);
      req.flash("error", "An error occurred creating the album");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// GET /bands/:bandId/albums/:albumId - View album (main page with track management)
router.get("/:bandId/albums/:albumId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        tracks: {
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
                  where: { type: 'audio' },
                },
                recordingSplits: {
                  include: {
                    recording: {
                      select: {
                        id: true,
                        createdAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!album) {
      req.flash("error", "Album not found");
      return res.redirect("/bands");
    }

    if (album.bandId !== bandId) {
      req.flash("error", "Album not found");
      return res.redirect("/bands");
    }

    if (album.band.members.length === 0) {
      req.flash("error", "Access denied");
      return res.redirect("/bands");
    }

    res.render("albums/show", {
      title: `${album.title} - ${album.band.name}`,
      album,
      hasBandHeader: true,
      band: album.band,
    });
  } catch (error) {
    logger.logError("View album error", error);
    req.flash("error", "Error loading album");
    res.redirect("/bands");
  }
});

// GET /bands/:bandId/albums/:albumId/edit - Edit album (drag/drop track editor)
router.get("/:bandId/albums/:albumId/edit", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
        tracks: {
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
            order: 'asc',
          },
        },
      },
    });

    if (!album) {
      req.flash("error", "Album not found");
      return res.redirect("/bands");
    }

    if (album.bandId !== bandId) {
      req.flash("error", "Album not found");
      return res.redirect("/bands");
    }

    if (album.band.members.length === 0) {
      req.flash("error", "Access denied");
      return res.redirect("/bands");
    }

    // Get all band songs for adding to album (alphabetically)
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId },
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
        song: {
          title: 'asc',
        },
      },
    });

    res.render("albums/edit", {
      title: `Edit ${album.title}`,
      album,
      bandSongs,
      hasBandHeader: true,
      band: album.band,
    });
  } catch (error) {
    logger.logError("Edit album error", error);
    req.flash("error", "Error loading album editor");
    res.redirect("/bands");
  }
});

// PUT /bands/:bandId/albums/:albumId - Update album metadata
router.put("/:bandId/albums/:albumId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;

    // Verify user is a member of this band
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { title, releaseDate, description, credits, artwork, headerImage, isPublished, rightsConfirmed } = req.body;

    // Validate rights confirmation if publishing
    if (isPublished && !rightsConfirmed) {
      return res.status(400).json({ error: "Rights confirmation required to publish album" });
    }

    // Check album publishing limits if publishing (and wasn't published before)
    if (isPublished && !album.isPublished) {
      const { canPublishAlbum } = require("../utils/subscriptionHelper");
      const publishCheck = await canPublishAlbum(userId, bandId);
      
      if (!publishCheck.allowed) {
        return res.status(403).json({ 
          error: publishCheck.message,
          upgradeRequired: true,
          upgradeUrl: '/pricing',
          currentCount: publishCheck.currentCount,
          limit: publishCheck.limit,
        });
      }
    }

    // Generate new slug if title changed
    let updateData = {
      title,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      description,
      credits,
      artwork,
      headerImage,
      isPublished,
      updatedAt: new Date(),
    };
    
    // Set rights confirmation timestamp if confirmed and publishing
    if (isPublished && rightsConfirmed) {
      updateData.rightsConfirmedAt = new Date();
    } else if (!isPublished) {
      // Clear timestamp if unpublishing
      updateData.rightsConfirmedAt = null;
    }

    if (title !== album.title) {
      updateData.slug = await generateUniqueSlug(prisma, title, 'album', albumId);
    }

    await prisma.album.update({
      where: { id: albumId },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    logger.logError("Update album error", error);
    res.status(500).json({ error: "Failed to update album" });
  }
});

// POST /bands/:bandId/albums/:albumId/tracks - Add track to album
router.post("/:bandId/albums/:albumId/tracks", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;
    const { songId } = req.body;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
        tracks: true,
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get next order number
    const maxOrder = album.tracks.length > 0
      ? Math.max(...album.tracks.map(t => t.order))
      : 0;

    await prisma.albumTrack.create({
      data: {
        albumId,
        songId: parseInt(songId),
        order: maxOrder + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.logError("Add track error", error);
    res.status(500).json({ error: "Failed to add track" });
  }
});

// DELETE /bands/:bandId/albums/:albumId/tracks/:trackId - Remove track
router.delete("/:bandId/albums/:albumId/tracks/:trackId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const trackId = parseInt(req.params.trackId);
    const userId = req.session.user.id;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get track audio file before deleting
    const track = await prisma.albumTrack.findUnique({
      where: { id: trackId },
      select: { audioUrl: true },
    });

    // Delete from database
    await prisma.albumTrack.delete({
      where: { id: trackId },
    });

    // Delete audio file if it exists
    if (track?.audioUrl) {
      await deleteFile(track.audioUrl);
    }

    // Recalculate band storage
    await updateBandStorageUsage(bandId);

    res.json({ success: true });
  } catch (error) {
    logger.logError("Remove track error", error);
    res.status(500).json({ error: "Failed to remove track" });
  }
});

// POST /bands/:bandId/albums/:albumId/tracks/reorder - Reorder tracks
router.post("/:bandId/albums/:albumId/tracks/reorder", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;
    const { trackOrder } = req.body;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update each track's order
    await Promise.all(
      trackOrder.map(({ trackId, order }) =>
        prisma.albumTrack.update({
          where: { id: trackId },
          data: { order, updatedAt: new Date() },
        })
      )
    );

    res.json({ success: true });
  } catch (error) {
    logger.logError("Reorder tracks error", error);
    res.status(500).json({ error: "Failed to reorder tracks" });
  }
});

// POST /bands/:bandId/albums/:albumId/tracks/:trackId/audio - Update track audio
router.post("/:bandId/albums/:albumId/tracks/:trackId/audio", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const trackId = parseInt(req.params.trackId);
    const userId = req.session.user.id;
    const { audioUrl } = req.body;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.albumTrack.update({
      where: { id: trackId },
      data: {
        audioUrl,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.logError("Update track audio error", error);
    res.status(500).json({ error: "Failed to update track audio" });
  }
});

// POST /bands/:bandId/albums/:albumId/images - Upload album images (artwork and/or header)
router.post("/:bandId/albums/:albumId/images", requireAuth, checkStorageQuota, upload.fields([
  { name: 'artwork', maxCount: 1 },
  { name: 'headerImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updateData = {};
    
    if (req.files.artwork && req.files.artwork[0]) {
      updateData.artwork = `/uploads/albums/${req.files.artwork[0].filename}`;
    }
    
    if (req.files.headerImage && req.files.headerImage[0]) {
      updateData.headerImage = `/uploads/albums/${req.files.headerImage[0].filename}`;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      
      await prisma.album.update({
        where: { id: albumId },
        data: updateData,
      });

      // Recalculate band storage after successful upload
      await updateBandStorageUsage(bandId);
    }

    res.json({ success: true, ...updateData });
  } catch (error) {
    logger.logError("Upload album images error", error);
    res.status(500).json({ error: "Failed to upload images" });
  }
});

// POST /bands/:bandId/albums/:albumId/tracks/:trackId/upload - Upload audio file for track
router.post("/:bandId/albums/:albumId/tracks/:trackId/upload", requireAuth, checkStorageQuota, upload.single('audioFile'), async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const trackId = parseInt(req.params.trackId);
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const audioUrl = `/uploads/albums/${req.file.filename}`;

    await prisma.albumTrack.update({
      where: { id: trackId },
      data: {
        audioUrl,
        updatedAt: new Date(),
      },
    });

    // Recalculate band storage after successful upload
    await updateBandStorageUsage(bandId);

    res.json({ success: true, audioUrl });
  } catch (error) {
    logger.logError("Upload track audio error", error);
    res.status(500).json({ error: "Failed to upload audio" });
  }
});

// GET /bands/:bandId/albums/:albumId/player - Public album player (requires token)
router.get("/:bandId/albums/:albumId/player", async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const token = req.query.t;

    // Validate token for public access
    const isValidToken = await validateAlbumToken(albumId, token);
    if (!isValidToken) {
      return res.status(403).send("Access denied. Valid token required.");
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: {
          include: {
            photos: {
              orderBy: {
                sortOrder: 'asc',
              },
            },
            socialLinks: true,
          },
        },
        tracks: {
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
            order: 'asc',
          },
        },
      },
    });

    if (!album) {
      return res.status(404).send("Album not found");
    }

    if (album.bandId !== bandId) {
      return res.status(404).send("Album not found");
    }

    // Check if album has been released yet
    if (album.releaseDate) {
      const now = new Date();
      const releaseDate = new Date(album.releaseDate);
      if (releaseDate > now) {
        const timeDiff = releaseDate - now;
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        return res.status(403).send(`
          <html>
            <head>
              <title>Album Not Yet Released</title>
              <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body class="bg-dark text-white d-flex align-items-center justify-content-center" style="min-height: 100vh;">
              <div class="text-center">
                <i class="bi bi-clock-history display-1"></i>
                <h1 class="mt-4">Album Not Yet Released</h1>
                <p class="lead">${album.title} by ${album.band.name}</p>
                <p class="text-muted">
                  This album will be released on<br>
                  <strong>${releaseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} 
                  at ${releaseDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong>
                </p>
                <p class="text-info">
                  ${days > 0 ? `${days} day${days !== 1 ? 's' : ''}, ` : ''}${hours} hour${hours !== 1 ? 's' : ''} remaining
                </p>
                <a href="/${album.band.slug}" class="btn btn-primary mt-3">Back to Band Page</a>
              </div>
            </body>
          </html>
        `);
      }
    }

    res.render("albums/player", {
      title: `${album.title} - ${album.band.name}`,
      marqueeTitle: album.band.name,
      album,
      layout: "layout",
    });
  } catch (error) {
    logger.logError("Album player error", error);
    res.status(500).send("Error loading album");
  }
});

// DELETE /bands/:bandId/albums/:albumId - Delete an album
router.delete("/:bandId/albums/:albumId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const albumId = parseInt(req.params.albumId);
    const userId = req.session.user.id;

    // Verify access
    const album = await prisma.album.findUnique({
      where: { id: albumId },
      include: {
        band: { include: { members: { where: { userId } } } },
      },
    });

    if (!album || album.bandId !== bandId || album.band.members.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete all album files first
    const { deleted, errors } = await deleteAlbumFiles(albumId);
    console.log(`Deleted ${deleted} files for album ${albumId}, ${errors} errors`);

    // Delete from database (cascade deletes tracks)
    await prisma.album.delete({
      where: { id: albumId },
    });

    // Recalculate band storage
    await updateBandStorageUsage(bandId);

    res.json({ success: true, filesDeleted: deleted });
  } catch (error) {
    logger.logError("Delete album error", error);
    res.status(500).json({ error: "Failed to delete album" });
  }
});

module.exports = router;

