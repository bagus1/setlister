const express = require("express");
const { prisma } = require("../lib/prisma");

const router = express.Router();

// GET /artists - List all artists
router.get("/", async (req, res) => {
  try {
    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
    });

    // Get song counts for each artist using a separate query
    const artistsWithCounts = await Promise.all(
      artists.map(async (artist) => {
        const songCount = await prisma.songArtist.count({
          where: { artistId: artist.id },
        });
        return {
          ...artist,
          songCount,
        };
      })
    );

    console.log(
      "Artists with counts:",
      artistsWithCounts.map((a) => ({ name: a.name, songCount: a.songCount }))
    );

    // Debug first artist structure
    if (artistsWithCounts.length > 0) {
      const firstArtist = artistsWithCounts[0];
      console.log("First artist structure:", {
        id: firstArtist.id,
        name: firstArtist.name,
        songCount: firstArtist.songCount,
      });
    }

    res.render("artists/index", {
      title: "Artists",
      pageTitle: "Artists",
      artists: artistsWithCounts,
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
          where: {
            song: {
              OR: [
                { private: false }, // Show all public songs
                { private: true, createdById: req.session.user?.id }, // Show private songs only if user owns them
              ],
            },
          },
          include: {
            song: {
              include: {
                vocalist: true,
                creator: true, // Include creator info for display
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
