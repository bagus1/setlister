const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

// GET /whitelist-request - Show the whitelist request form
router.get("/", (req, res) => {
  res.render("whitelist-request/index", {
    title: "Request Domain Whitelist",
    currentUrl: req.originalUrl,
  });
});

// POST /whitelist-request - Submit a whitelist request
router.post(
  "/",
  [
    body("linkType")
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
    body("domain")
      .isURL({ require_protocol: false, require_host: true })
      .withMessage("Please enter a valid domain (e.g., example.com)"),
    body("reason")
      .isLength({ min: 10, max: 500 })
      .withMessage("Please provide a reason (10-500 characters)"),
    body("exampleUrl")
      .isURL()
      .withMessage("Please provide a valid example URL from this domain"),
    body("contactEmail")
      .isEmail()
      .withMessage("Please provide a valid email address"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect("/whitelist-request");
      }

      const { linkType, domain, reason, exampleUrl, contactEmail } = req.body;

      // Extract just the domain name (remove protocol and path)
      const domainName = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

      // Store the request in the database
      await prisma.whitelistRequest.create({
        data: {
          linkType,
          domain: domainName,
          reason,
          exampleUrl,
          contactEmail,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Send email notification to admin (you)
      // TODO: Implement email sending logic here
      console.log(`Whitelist request received for ${domainName} as ${linkType}`);

      req.flash(
        "success",
        "Your whitelist request has been submitted successfully. We'll review it and get back to you soon!"
      );
      res.redirect("/whitelist-request");
    } catch (error) {
      console.error("Whitelist request error:", error);
      req.flash("error", "Error submitting whitelist request. Please try again.");
      res.redirect("/whitelist-request");
    }
  }
);

module.exports = router;
