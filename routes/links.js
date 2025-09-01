const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

// Dynamic whitelist validation using database
async function getWhitelistValidation(linkType) {
  try {
    const whitelistDomains = await prisma.whitelistDomain.findMany({
      where: {
        linkType,
        isActive: true,
      },
    });

    if (whitelistDomains.length === 0) {
      // Fallback for 'other' type or if no whitelist exists
      return {
        pattern: /^https?:\/\/.+/,
        message: "Please enter a valid URL",
      };
    }

    // Build regex pattern from whitelisted domains
    const domainPatterns = whitelistDomains.map((wd) => {
      // Escape special regex characters in domain names
      const escapedDomain = wd.domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return `(www\\.)?${escapedDomain}`;
    });

    const pattern = new RegExp(
      `^https?:\\/\\/(${domainPatterns.join("|")})\\/.*$`
    );

    // Create helpful message listing the allowed domains
    const domainList = whitelistDomains.map((wd) => wd.domain).join(", ");
    const message = `Please enter a valid URL from one of these domains: ${domainList}. If you need to add a different domain, please visit /whitelist-request to request a domain whitelist.`;

    return { pattern, message };
  } catch (error) {
    console.error(`Error getting whitelist for ${linkType}:`, error);
    // Fallback to basic URL validation
    return {
      pattern: /^https?:\/\/.+/,
      message: "Please enter a valid URL",
    };
  }
}

// Custom validation function for link URLs
const validateLinkUrl = async (value, { req }) => {
  const linkType = req.body.type;

  try {
    const validation = await getWhitelistValidation(linkType);

    if (!validation.pattern.test(value)) {
      return Promise.reject(validation.message);
    }

    return Promise.resolve();
  } catch (error) {
    console.error(`Validation error for ${linkType}:`, error);
    return Promise.reject("Error validating URL. Please try again.");
  }
};

// POST /songs/:songId/links - Add a new link to a song
router.post(
  "/:songId/links",
  requireAuth,
  [
    body("type")
      .isIn([
        "youtube",
        "video",
        "spotify",
        "apple-music",
        "soundcloud",
        "bandcamp",
        "lyrics",
        "tab",
        "bass tab",
        "chords",
        "guitar tutorial",
        "bass tutorial",
        "keyboard tutorial",
        "audio",
        "sheet-music",
        "backing-track",
        "karaoke",
        "horn chart",
        "other",
      ])
      .withMessage("Please select a valid link type"),
    body("url")
      .isURL()
      .withMessage("Please enter a valid URL")
      .custom(validateLinkUrl),
    body("description")
      .optional()
      .isLength({ max: 255 })
      .withMessage("Description must be less than 255 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Use the error message as-is
        const errorMsg = errors.array()[0].msg;
        req.flash("error", errorMsg);
        return res.redirect(`/songs/${req.params.songId}`);
      }

      const song = await prisma.song.findUnique({
        where: { id: parseInt(req.params.songId) },
      });
      if (!song) {
        req.flash("error", "Song not found");
        return res.redirect("/songs");
      }

      const { type, url, description } = req.body;

      await prisma.link.create({
        data: {
          songId: song.id,
          createdById: req.session.user.id,
          type,
          url: url.trim(),
          description: description ? description.trim() : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Link added successfully");
      res.redirect(`/songs/${song.id}`);
    } catch (error) {
      console.error("Add link error:", error);
      req.flash("error", "Error adding link");
      res.redirect(`/songs/${song.id}`);
    }
  }
);

// DELETE /songs/:songId/links/:linkId - Delete a link
router.delete("/:songId/links/:linkId", requireAuth, async (req, res) => {
  try {
    const link = await prisma.link.findUnique({
      where: { id: parseInt(req.params.linkId) },
    });
    if (!link) {
      req.flash("error", "Link not found");
      return res.redirect(`/songs/${req.params.songId}`);
    }

    // Verify the link belongs to the specified song
    if (link.songId != parseInt(req.params.songId)) {
      req.flash("error", "Link not found");
      return res.redirect(`/songs/${req.params.songId}`);
    }

    await prisma.link.delete({
      where: { id: parseInt(req.params.linkId) },
    });
    req.flash("success", "Link deleted successfully");
    res.redirect(`/songs/${req.params.songId}`);
  } catch (error) {
    console.error("Delete link error:", error);
    req.flash("error", "Error deleting link");
    res.redirect(`/songs/${req.params.songId}`);
  }
});

module.exports = router;
