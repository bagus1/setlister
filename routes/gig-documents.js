const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

// GET /songs/:songId/docs - List all gig documents for a song (public)
router.get("/:songId/docs", async (req, res) => {
  try {
    const songId = req.params.songId;
    const song = await prisma.song.findUnique({
      where: { id: parseInt(songId) },
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

    const gigDocuments = await prisma.gigDocument.findMany({
      where: { songId: parseInt(songId) },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

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

    res.render("gig-documents/index", {
      title: `Gig Documents - ${song.title}`,
      song,
      gigDocuments,
      getTypeIcon,
      getTypeDisplayName,
      currentUrl: req.originalUrl,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("List gig documents error:", error);
    req.flash("error", "Error loading gig documents");
    res.redirect(`/songs/${req.params.songId}`);
  }
});

// GET /songs/:songId/docs/new - Show form to create new gig document
router.get("/:songId/docs/new", requireAuth, async (req, res) => {
  try {
    const songId = req.params.songId;
    const song = await prisma.song.findUnique({
      where: { id: parseInt(songId) },
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

    res.render("gig-documents/new", {
      title: `New Gig Document - ${song.title}`,
      song,
    });
  } catch (error) {
    console.error("New gig document form error:", error);
    req.flash("error", "Error loading form");
    res.redirect(`/songs/${req.params.songId}`);
  }
});

// POST /songs/:songId/docs - Create new gig document
router.post(
  "/:songId/docs",
  requireAuth,
  [
    body("type")
      .isIn(["chords", "bass-tab", "guitar-tab", "lyrics"])
      .withMessage("Please select a valid document type"),
    body("content")
      .optional()
      .isLength({ max: 10000 })
      .withMessage("Content must be less than 10,000 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/songs/${req.params.songId}/docs/new`);
      }

      const songId = req.params.songId;
      const userId = req.session.user.id;
      const song = await prisma.song.findUnique({
        where: { id: parseInt(songId) },
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

      const { type, content } = req.body;

      // Debug logging
      console.log("=== CREATE GIG DOCUMENT DEBUG ===");
      console.log("Request body:", req.body);
      console.log("Type:", type);
      console.log("Content:", content);
      console.log("Content length:", content ? content.length : 0);
      console.log("Content type:", typeof content);

      // Auto-increment version if not provided
      let docVersion = 1;
      const existingDocs = await prisma.gigDocument.findMany({
        where: { songId: parseInt(songId), type: type },
        orderBy: { version: "desc" },
        take: 1,
      });
      if (existingDocs.length > 0) {
        docVersion = existingDocs[0].version + 1;
      }

      // Auto-generate title from type and version
      const typeLabels = {
        chords: "Chords",
        "bass-tab": "Bass Tab",
        "guitar-tab": "Guitar Tab",
        lyrics: "Lyrics",
      };
      const autoTitle = `${typeLabels[type]} - v${docVersion}`;

      const gigDocument = await prisma.gigDocument.create({
        data: {
          songId: song.id,
          title: autoTitle,
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
        `Gig document created successfully: ${gigDocument.title} - v${gigDocument.version}`
      );
      res.redirect(`/songs/${song.id}/docs/${gigDocument.id}`);
    } catch (error) {
      console.error("Create gig document error:", error);
      req.flash("error", "Error creating gig document");
      res.redirect(`/songs/${req.params.songId}/docs/new`);
    }
  }
);

// GET /songs/:songId/docs/:id - Show specific gig document (public)
router.get("/:songId/docs/:id", async (req, res) => {
  try {
    const { songId, id } = req.params;

    const gigDocument = await prisma.gigDocument.findFirst({
      where: { id: parseInt(id), songId: parseInt(songId) },
      include: { song: true },
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    // Check if this is a print request
    const isPrintRequest = req.query.print === "true";

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

    if (isPrintRequest) {
      // For print requests, render without any layout and with minimal content
      res.render("gig-documents/print", {
        title: `${getTypeDisplayName(gigDocument.type)} - v${gigDocument.version} - ${gigDocument.song.title}`,
        gigDocument,
        song: gigDocument.song,
        layout: false,
        getTypeIcon,
        getTypeDisplayName,
      });
    } else {
      // For normal viewing, render with layout
      res.render("gig-documents/show", {
        title: `${getTypeDisplayName(gigDocument.type)} - v${gigDocument.version} - ${gigDocument.song.title}`,
        gigDocument,
        song: gigDocument.song,
        loggedIn: !!req.session.user,
        success: req.flash("success"),
        error: req.flash("error"),
        currentUrl: req.originalUrl,
        user: req.session.user,
        getTypeIcon,
        getTypeDisplayName,
      });
    }
  } catch (error) {
    console.error("Show gig document error:", error);
    req.flash("error", "Error loading gig document");
    res.redirect(`/songs/${req.params.songId}/docs`);
  }
});

// GET /songs/:songId/docs/:id/edit - Show edit form
router.get("/:songId/docs/:id/edit", requireAuth, async (req, res) => {
  try {
    const { songId, id } = req.params;
    const userId = req.session.user.id;

    const gigDocument = await prisma.gigDocument.findFirst({
      where: { id: parseInt(id), songId: parseInt(songId) },
      include: { song: true },
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    // Check if current user is the creator of this document
    if (gigDocument.createdById !== userId) {
      req.flash(
        "error",
        `You can only edit gig documents that you created, but you can create a new better one! <a href="/songs/${songId}/docs/new" class="alert-link">Create a new better one</a>`
      );
      return res.redirect(`/songs/${songId}/docs/${id}`);
    }

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

    res.render("gig-documents/edit", {
      title: `Edit ${getTypeDisplayName(gigDocument.type)} - v${gigDocument.version} - ${gigDocument.song.title}`,
      gigDocument,
      song: gigDocument.song,
      getTypeIcon,
      getTypeDisplayName,
    });
  } catch (error) {
    console.error("Edit gig document form error:", error);
    req.flash("error", "Error loading edit form");
    res.redirect(`/songs/${req.params.songId}/docs`);
  }
});

// PUT /songs/:songId/docs/:id - Update gig document
router.put(
  "/:songId/docs/:id",
  requireAuth,
  [
    body("content")
      .optional()
      .isLength({ max: 10000 })
      .withMessage("Content must be less than 10,000 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(
          `/songs/${req.params.songId}/docs/${req.params.id}/edit`
        );
      }

      const { songId, id } = req.params;
      const { content } = req.body;
      const userId = req.session.user.id;

      // Debug logging
      // console.log("=== UPDATE GIG DOCUMENT DEBUG ===");
      // console.log("Request body:", req.body);
      // console.log("Content:", content);
      // console.log("Content length:", content ? content.length : 0);
      // console.log("Content type:", typeof content);

      const gigDocument = await prisma.gigDocument.findFirst({
        where: { id: parseInt(id), songId: parseInt(songId) },
      });

      if (!gigDocument) {
        req.flash("error", "Gig document not found");
        return res.redirect(`/songs/${songId}/docs`);
      }

      // Check if current user is the creator of this document
      if (gigDocument.createdById !== userId) {
        req.flash(
          "error",
          `You can only delete gig documents that you created, but you can create a new better one! <a href="/songs/${songId}/docs/new" class="alert-link">Create a new better one</a>`
        );
        return res.redirect(`/songs/${songId}/docs/${id}`);
      }

      await prisma.gigDocument.update({
        where: { id: parseInt(id) },
        data: {
          content: content ? content.trim() : null,
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Gig document updated successfully");
      res.redirect(`/songs/${songId}/docs/${gigDocument.id}`);
    } catch (error) {
      console.error("Update gig document error:", error);
      req.flash("error", "Error updating gig document");
      res.redirect(`/songs/${req.params.songId}/docs/${req.params.id}/edit`);
    }
  }
);

// DELETE /songs/:songId/docs/:id - Delete gig document
router.delete("/:songId/docs/:id", requireAuth, async (req, res) => {
  try {
    const { songId, id } = req.params;
    const userId = req.session.user.id;

    const gigDocument = await prisma.gigDocument.findFirst({
      where: { id: parseInt(id), songId: parseInt(songId) },
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    // Check if current user is the creator of this document
    if (gigDocument.createdById !== userId) {
      req.flash(
        "error",
        `You can only edit gig documents that you created, but you can create a new better one! <a href="/songs/${songId}/docs/new" class="alert-link">Create a new better one</a>`
      );
      return res.redirect(`/songs/${songId}/docs/${id}`);
    }

    await prisma.gigDocument.delete({
      where: { id: parseInt(id) },
    });
    req.flash("success", "Gig document deleted successfully");
    res.redirect(`/songs/${songId}/docs`);
  } catch (error) {
    console.error("Delete gig document error:", error);
    req.flash("error", "Error deleting gig document");
    res.redirect(`/songs/${req.params.songId}/docs`);
  }
});

// POST /songs/:songId/docs/:id/set-preferred - Set as preferred document for band
router.post(
  "/:songId/docs/:id/set-preferred",
  requireAuth,
  async (req, res) => {
    try {
      const { songId, id } = req.params;
      const { bandId } = req.body;

      if (!bandId) {
        req.flash("error", "Band ID is required");
        return res.redirect(`/songs/${songId}/docs/${id}`);
      }

      // Find the BandSong record and update its preferred gig document
      const bandSong = await prisma.bandSong.findFirst({
        where: { bandId: parseInt(bandId), songId: parseInt(songId) },
      });

      if (!bandSong) {
        req.flash("error", "Song not found in this band");
        return res.redirect(`/songs/${songId}/docs/${id}`);
      }

      await prisma.bandSong.update({
        where: { id: bandSong.id },
        data: { gigDocumentId: parseInt(id) },
      });
      req.flash("success", "Preferred gig document updated");
      res.redirect(`/songs/${songId}/docs/${id}`);
    } catch (error) {
      console.error("Set preferred gig document error:", error);
      req.flash("error", "Error setting preferred gig document");
      res.redirect(`/songs/${req.params.songId}/docs/${req.params.id}`);
    }
  }
);

module.exports = router;
