const express = require("express");
const {
  User,
  Band,
  Song,
  Artist,
  Medley,
  BandMember,
  BandSong,
} = require("../models");
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
      const userBands = await Band.findAll({
        include: [
          {
            model: User,
            where: { id: userId },
            through: { attributes: [] },
          },
        ],
        limit: 5,
        order: [["updated_at", "DESC"]],
      });

      // Get latest band songs from user's bands
      const latestBandSongs = await BandSong.findAll({
        include: [
          {
            model: Song,
            include: ["Vocalist", "Artists"],
          },
          {
            model: Band,
            include: [
              {
                model: User,
                where: { id: userId },
                through: { attributes: [] },
              },
            ],
          },
        ],
        limit: 8,
        order: [["updated_at", "DESC"]],
      });

      // Get recent medleys
      const recentMedleys = await Medley.findAll({
        include: ["Vocalist"],
        limit: 5,
        order: [["updated_at", "DESC"]],
      });

      // Get artists
      const artists = await Artist.findAll({
        limit: 13,
        order: [["updated_at", "DESC"]],
      });

      res.render("dashboard/index", {
        title: "Dashboard",
        loggedIn: true,
        userBands,
        latestBandSongs,
        recentMedleys,
        artists,
      });
    } else {
      // Logged out dashboard
      const bands = await Band.findAll({
        limit: 10,
        order: [["updated_at", "DESC"]],
      });

      const songs = await Song.findAll({
        include: ["Vocalist", "Artists"],
        limit: 10,
        order: [["updated_at", "DESC"]],
      });

      const artists = await Artist.findAll({
        limit: 10,
        order: [["updated_at", "DESC"]],
      });

      res.render("dashboard/index", {
        title: "Setlist Manager",
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
