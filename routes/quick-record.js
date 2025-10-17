const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

const router = express.Router();

// GET /quick-record - Quick record wizard
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get user's bands
    const userBands = await prisma.band.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        setlists: {
          orderBy: { updatedAt: 'desc' },
          take: 10, // Recent setlists
        },
      },
      orderBy: { name: 'asc' },
    });

    // If user has no bands, require band creation
    if (userBands.length === 0) {
      return res.render("quick-record/create-band", {
        title: "Quick Record - Create Your Band",
      });
    }

    // If user has exactly one band, skip to setlist selection
    if (userBands.length === 1) {
      return res.redirect(`/quick-record/band/${userBands[0].id}`);
    }

    // Multiple bands - show band selector
    res.render("quick-record/select-band", {
      title: "Quick Record - Select Band",
      bands: userBands,
    });
  } catch (error) {
    console.error("Quick record error:", error);
    req.flash("error", "An error occurred");
    res.redirect("/");
  }
});

// POST /quick-record/create-band - Create band for new user
router.post("/create-band", requireAuth, [
  body("bandName").trim().isLength({ min: 1 }).withMessage("Band name is required"),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("quick-record/create-band", {
        title: "Quick Record - Create Your Band",
        errors: errors.array(),
        bandName: req.body.bandName,
      });
    }

    const { bandName } = req.body;
    const userId = req.session.user.id;
    const { generateUniqueSlug } = require("../utils/slugify");

    // Create band in transaction
    const band = await prisma.$transaction(async (tx) => {
      const slug = await generateUniqueSlug(tx, bandName);

      const newBand = await tx.band.create({
        data: {
          name: bandName,
          slug,
          isPublic: false,
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.bandMember.create({
        data: {
          bandId: newBand.id,
          userId,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return newBand;
    });

    // Redirect to setlist selection for this new band
    res.redirect(`/quick-record/band/${band.id}`);
  } catch (error) {
    console.error("Create band error:", error);
    req.flash("error", "An error occurred creating your band");
    res.redirect("/quick-record");
  }
});

// GET /quick-record/band/:bandId - Select or create setlist
router.get("/band/:bandId", requireAuth, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const userId = req.session.user.id;

    // Verify user is member
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId },
        },
      },
      include: {
        setlists: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you're not a member");
      return res.redirect("/quick-record");
    }

    res.render("quick-record/select-setlist", {
      title: `Quick Record - ${band.name}`,
      band,
    });
  } catch (error) {
    console.error("Select setlist error:", error);
    req.flash("error", "An error occurred");
    res.redirect("/quick-record");
  }
});

// POST /quick-record/band/:bandId - Create setlist and go to recording
router.post("/band/:bandId", requireAuth, [
  body("action").isIn(['existing', 'new']).withMessage("Invalid action"),
  body("setlistId").optional().isInt(),
  body("setlistTitle").optional().trim(),
], async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const userId = req.session.user.id;
    const { action, setlistId, setlistTitle } = req.body;

    // Verify user is member
    const isMember = await prisma.bandMember.findFirst({
      where: { bandId, userId },
    });

    if (!isMember) {
      req.flash("error", "You're not a member of this band");
      return res.redirect("/quick-record");
    }

    let targetSetlistId;

    if (action === 'existing' && setlistId) {
      // Use existing setlist
      targetSetlistId = parseInt(setlistId);
    } else {
      // Create new setlist
      const title = setlistTitle || `Rehearsal - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      
      const setlist = await prisma.setlist.create({
        data: {
          title,
          bandId,
          createdById: userId,
          isFinalized: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      targetSetlistId = setlist.id;
    }

    // Redirect to setlist page where they can record
    req.flash("success", "Ready to record! Click the Record button below.");
    res.redirect(`/bands/${bandId}/setlists/${targetSetlistId}`);
  } catch (error) {
    console.error("Quick record create setlist error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/quick-record/band/${req.params.bandId}`);
  }
});

module.exports = router;

