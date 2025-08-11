const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const { GigDocument, Song, BandSong } = require("../models");
const { requireAuth } = require("./auth");

// GET /songs/:songId/docs - List all gig documents for a song (public)
router.get("/:songId/docs", async (req, res) => {
  try {
    const songId = req.params.songId;
    const song = await Song.findByPk(songId, {
      include: ["Artists", "Vocalist"],
    });

    if (!song) {
      req.flash("error", "Song not found");
      return res.redirect("/songs");
    }

    const gigDocuments = await GigDocument.findAll({
      where: { songId: songId },
      order: [
        ["version", "DESC"],
        ["createdAt", "DESC"],
      ],
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
    const song = await Song.findByPk(songId, {
      include: ["Artists", "Vocalist"],
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
      const song = await Song.findByPk(songId, {
        include: ["Artists", "Vocalist"],
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
      const existingDocs = await GigDocument.findAll({
        where: { songId: songId, type: type },
        order: [["version", "DESC"]],
        limit: 1,
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

      const gigDocument = await GigDocument.create({
        songId: song.id,
        title: autoTitle,
        type,
        version: docVersion,
        content: content ? content.trim() : null,
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

    const gigDocument = await GigDocument.findOne({
      where: { id: id, songId: songId },
      include: [{ model: Song, as: "Song" }],
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    // Check if this is a print request
    const isPrintRequest = req.query.print === "true";

    if (isPrintRequest) {
      // For print requests, render without any layout and with minimal content
      res.render("gig-documents/print", {
        title: `${gigDocument.title} - ${gigDocument.Song.title}`,
        gigDocument,
        song: gigDocument.Song,
        layout: false,
      });
    } else {
      // For normal viewing, render with layout
      res.render("gig-documents/show", {
        title: `${gigDocument.title} - ${gigDocument.Song.title}`,
        gigDocument,
        song: gigDocument.Song,
        loggedIn: !!req.session.user,
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

    const gigDocument = await GigDocument.findOne({
      where: { id: id, songId: songId },
      include: [{ model: Song, as: "Song" }],
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    res.render("gig-documents/edit", {
      title: `Edit ${gigDocument.title} - ${gigDocument.Song.title}`,
      gigDocument,
      song: gigDocument.Song,
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

      // Debug logging
      console.log("=== UPDATE GIG DOCUMENT DEBUG ===");
      console.log("Request body:", req.body);
      console.log("Content:", content);
      console.log("Content length:", content ? content.length : 0);
      console.log("Content type:", typeof content);

      const gigDocument = await GigDocument.findOne({
        where: { id: id, songId: songId },
      });

      if (!gigDocument) {
        req.flash("error", "Gig document not found");
        return res.redirect(`/songs/${songId}/docs`);
      }

      await gigDocument.update({
        content: content ? content.trim() : null,
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

    const gigDocument = await GigDocument.findOne({
      where: { id: id, songId: songId },
    });

    if (!gigDocument) {
      req.flash("error", "Gig document not found");
      return res.redirect(`/songs/${songId}/docs`);
    }

    await gigDocument.destroy();
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
      const bandSong = await BandSong.findOne({
        where: { bandId: bandId, songId: songId },
      });

      if (!bandSong) {
        req.flash("error", "Song not found in this band");
        return res.redirect(`/songs/${songId}/docs/${id}`);
      }

      await bandSong.update({ gigDocumentId: id });
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
