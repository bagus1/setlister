const express = require("express");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// GET / - Dashboard (different for logged in vs logged out)
router.get("/", async (req, res) => {
  try {
    if (req.session.user) {
      // Logged in dashboard
      const userId = req.session.user.id;

      // Get user's bands
      const userBands = await prisma.band.findMany({
        where: {
          members: {
            some: { userId: userId },
          },
        },
        include: {
          members: {
            where: { userId: userId },
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
        take: 15,
        orderBy: { updatedAt: "desc" },
      });

      // Get latest band songs from user's bands
      const latestBandSongs = await prisma.bandSong.findMany({
        where: {
          band: {
            members: {
              some: { userId: userId },
            },
          },
        },
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
          band: {
            include: {
              members: {
                where: { userId: userId },
                include: {
                  user: {
                    select: { id: true, username: true },
                  },
                },
              },
            },
          },
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      });

      // Get recent medleys
      const recentMedleys = await prisma.medley.findMany({
        include: {
          vocalist: true,
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      });

      // Get artists
      const artists = await prisma.artist.findMany({
        include: {
          songs: {
            include: {
              song: {
                select: {
                  private: true,
                },
              },
            },
          },
        },
        take: 13,
        orderBy: { updatedAt: "desc" },
      });

      res.render("dashboard/index", {
        title: "",
        pageTitle: `Welcome, ${req.session.user.username}`,
        loggedIn: true,
        user: req.session.user,
        userBands,
        latestBandSongs,
        recentMedleys,
        artists,
      });
    } else {
      // Logged out dashboard
      const bands = await prisma.band.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          slug: true,
          isPublic: true,
          updatedAt: true,
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
      });

      // Only show public songs for logged out users
      const songs = await prisma.song.findMany({
        where: {
          private: false, // Only show public songs
        },
        include: {
          vocalist: true,
          artists: {
            include: {
              artist: true,
            },
          },
        },
        take: 10,
        orderBy: { updatedAt: "desc" },
      });

      const artists = await prisma.artist.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
      });

      res.render("dashboard/index", {
        title: "The Band Plan",
        pageTitle: "The Band Plan",
        loggedIn: false,
        bands,
        songs,
        artists,
      });
    }
  } catch (error) {
    logger.logError("Dashboard error", error);
    req.flash("error", "An error occurred loading the dashboard");
    res.render("dashboard/index", {
      title: "Dashboard",
      pageTitle: "Dashboard",
      loggedIn: !!req.session.user,
      userBands: [],
      latestBandSongs: [],
      recentMedleys: [],
      artists: [],
      bands: [],
      songs: [],
    });
  }
});

module.exports = router;
