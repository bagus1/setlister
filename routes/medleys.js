const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// GET /medleys - List all medleys
router.get("/", async (req, res) => {
  try {
    const medleys = await prisma.medley.findMany({
      include: {
        vocalist: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.render("medleys/index", {
      title: "Medleys",
      medleys,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    logger.logError("Medleys index error", error);
    req.flash("error", "An error occurred loading medleys");
    res.redirect("/");
  }
});

// GET /medleys/new - Show create medley form (requires auth)
router.get("/new", requireAuth, async (req, res) => {
  try {
    const songs = await prisma.song.findMany({
      include: {
        vocalist: true,
        artists: {
          include: {
            artist: true,
          },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.render("medleys/new", {
      title: "Create Medley",
      songs,
      vocalists,
    });
  } catch (error) {
    logger.logError("New medley error", error);
    req.flash("error", "An error occurred loading the form");
    res.redirect("/medleys");
  }
});

// POST /medleys - Create a new medley (requires auth)
router.post(
  "/",
  requireAuth,
  [
    body("name").optional().trim(),
    body("key")
      .optional()
      .isIn([
        "C",
        "C#",
        "Db",
        "D",
        "D#",
        "Eb",
        "E",
        "F",
        "F#",
        "Gb",
        "G",
        "G#",
        "Ab",
        "A",
        "A#",
        "Bb",
        "B",
        "Cm",
        "C#m",
        "Dbm",
        "Dm",
        "D#m",
        "Ebm",
        "Em",
        "Fm",
        "F#m",
        "Gbm",
        "Gm",
        "G#m",
        "Abm",
        "Am",
        "A#m",
        "Bbm",
        "Bm",
      ])
      .withMessage("Invalid key"),
    body("vocalistId").optional().isInt().withMessage("Invalid vocalist"),
    body("songIds")
      .custom((value) => {
        if (!Array.isArray(value) || value.length < 2) {
          throw new Error("At least 2 songs are required for a medley");
        }
        return true;
      })
      .withMessage("At least 2 songs are required for a medley"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const songs = await prisma.song.findMany({
          include: {
            vocalist: true,
            artists: {
              include: {
                artist: true,
              },
            },
          },
          orderBy: {
            title: "asc",
          },
        });

        const vocalists = await prisma.vocalist.findMany({
          orderBy: {
            name: "asc",
          },
        });

        return res.render("medleys/new", {
          title: "Create Medley",
          errors: errors.array(),
          songs,
          vocalists,
          formData: req.body,
        });
      }

      const { name, key, vocalistId, songIds } = req.body;

      // Generate name if not provided (first two words of first two songs + "Medley")
      let medleyName = name;
      if (!medleyName) {
        const firstTwoSongs = await prisma.song.findMany({
          where: {
            id: {
              in: songIds.slice(0, 2).map((id) => parseInt(id)),
            },
          },
          orderBy: {
            title: "asc",
          },
        });

        const words = [];
        firstTwoSongs.forEach((song) => {
          const songWords = song.title.split(" ").slice(0, 2);
          words.push(...songWords);
        });

        medleyName = words.slice(0, 4).join(" ") + " Medley";
      }

      // Convert key to Prisma enum format
      let prismaKey = null;
      if (key) {
        // Map the display keys to Prisma enum values
        const keyMap = {
          "C#": "C_",
          "D#": "D_",
          "F#": "F_",
          "G#": "G_",
          "A#": "A_",
          "C#m": "C_m",
          "D#m": "D_m",
          "F#m": "F_m",
          "G#m": "G_m",
          "A#m": "A_m",
        };
        prismaKey = keyMap[key] || key;
      }

      // Create medley and songs in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create medley
        const medley = await tx.medley.create({
          data: {
            name: medleyName,
            key: prismaKey,
            vocalistId: vocalistId ? parseInt(vocalistId) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Add songs to medley
        const medleySongs = songIds.map((songId, index) => ({
          medleyId: medley.id,
          songId: parseInt(songId),
          order: index + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        await tx.medleySong.createMany({
          data: medleySongs,
        });

        return medley;
      });

      req.flash("success", "Medley created successfully!");
      res.redirect(`/medleys/${result.id}`);
    } catch (error) {
      logger.logError("Create medley error", error);
      req.flash("error", "An error occurred creating the medley");
      res.redirect("/medleys/new");
    }
  }
);

// GET /medleys/:id - Show medley details
router.get("/:id", async (req, res) => {
  try {
    const medley = await prisma.medley.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        vocalist: true,
        songs: {
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
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!medley) {
      req.flash("error", "Medley not found");
      return res.redirect("/medleys");
    }

    res.render("medleys/show", {
      title: medley.name,
      medley,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    logger.logError("Show medley error", error);
    req.flash("error", "An error occurred loading the medley");
    res.redirect("/medleys");
  }
});

// GET /medleys/:id/edit - Show edit medley form (requires auth)
router.get("/:id/edit", requireAuth, async (req, res) => {
  try {
    const medley = await prisma.medley.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        vocalist: true,
        songs: {
          include: {
            song: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!medley) {
      req.flash("error", "Medley not found");
      return res.redirect("/medleys");
    }

    const allSongs = await prisma.song.findMany({
      include: {
        vocalist: true,
        artists: {
          include: {
            artist: true,
          },
        },
      },
      orderBy: {
        title: "asc",
      },
    });

    const vocalists = await prisma.vocalist.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.render("medleys/edit", {
      title: `Edit ${medley.name}`,
      medley,
      allSongs,
      vocalists,
    });
  } catch (error) {
    logger.logError("Edit medley error", error);
    req.flash("error", "An error occurred loading the edit form");
    res.redirect("/medleys");
  }
});

// PUT /medleys/:id - Update medley (requires auth)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, key, vocalistId } = req.body;
    const medleyId = parseInt(req.params.id);

    // Convert key to Prisma enum format
    let prismaKey = null;
    if (key) {
      // Map the display keys to Prisma enum values
      const keyMap = {
        "C#": "C_",
        "D#": "D_",
        "F#": "F_",
        "G#": "G_",
        "A#": "A_",
        "C#m": "C_m",
        "D#m": "D_m",
        "F#m": "F_m",
        "G#m": "G_m",
        "A#m": "A_m",
      };
      prismaKey = keyMap[key] || key;
    }

    const updatedMedley = await prisma.medley.update({
      where: { id: medleyId },
      data: {
        name,
        key: prismaKey,
        vocalistId: vocalistId ? parseInt(vocalistId) : null,
        updatedAt: new Date(),
      },
    });

    req.flash("success", "Medley updated successfully!");
    res.redirect(`/medleys/${updatedMedley.id}`);
  } catch (error) {
    logger.logError("Update medley error", error);
    req.flash("error", "An error occurred updating the medley");
    res.redirect(`/medleys/${req.params.id}/edit`);
  }
});

module.exports = router;
