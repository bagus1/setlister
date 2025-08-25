const express = require("express");
const { prisma } = require("../lib/prisma");

const router = express.Router();

// GET /artists - List all artists
router.get("/", async (req, res) => {
  try {
    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    res.render("artists/index", {
      title: "Artists",
      artists,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    console.error("Artists index error:", error);
    req.flash("error", "An error occurred loading artists");
    res.redirect("/");
  }
});

// GET /artists/:id - Show artist and their songs
router.get("/:id", async (req, res) => {
  try {
    const artist = await prisma.artist.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        songs: {
          include: {
            song: {
              include: {
                vocalist: true,
              },
            },
          },
        },
      },
    });

    if (!artist) {
      req.flash("error", "Artist not found");
      return res.redirect("/artists");
    }

    res.render("artists/show", {
      title: artist.name,
      artist,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    console.error("Show artist error:", error);
    req.flash("error", "An error occurred loading the artist");
    res.redirect("/artists");
  }
});

module.exports = router;
