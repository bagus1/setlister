const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

const router = express.Router();

// GET /musicians/:slug/contact - Contact form for musician
router.get("/:slug/contact", requireAuth, async (req, res) => {
  try {
    const { slug } = req.params;

    const musician = await prisma.user.findFirst({
      where: {
        slug,
        isPublic: true,
        openToOpportunities: true,
      },
      select: {
        id: true,
        username: true,
        slug: true,
        instruments: true,
        location: true,
      },
    });

    if (!musician) {
      req.flash("error", "This musician is not available for contact");
      return res.redirect("/");
    }

    // Don't let users contact themselves
    if (musician.id === req.session.user.id) {
      req.flash("error", "You cannot contact yourself");
      return res.redirect(`/musicians/${slug}`);
    }

    res.render("profile/contact", {
      title: `Contact ${musician.username}`,
      musician,
    });
  } catch (error) {
    console.error("Contact form error:", error);
    req.flash("error", "An error occurred");
    res.redirect("/");
  }
});

// POST /musicians/:slug/contact - Send contact message
router.post("/:slug/contact", requireAuth, [
  body("subject").trim().isLength({ min: 5 }).withMessage("Subject must be at least 5 characters"),
  body("message").trim().isLength({ min: 20 }).withMessage("Message must be at least 20 characters"),
], async (req, res) => {
  try {
    const { slug } = req.params;
    const senderId = req.session.user.id;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const musician = await prisma.user.findFirst({
        where: { slug, isPublic: true, openToOpportunities: true },
        select: { id: true, username: true, slug: true },
      });

      return res.render("profile/contact", {
        title: `Contact ${musician.username}`,
        musician,
        errors: errors.array(),
        subject: req.body.subject,
        message: req.body.message,
      });
    }

    const musician = await prisma.user.findFirst({
      where: {
        slug,
        isPublic: true,
        openToOpportunities: true,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!musician) {
      req.flash("error", "This musician is not available for contact");
      return res.redirect("/");
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { username: true, email: true },
    });

    const { subject, message } = req.body;

    // Send email
    const { sendEmail } = require("../utils/emailService");
    
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #333;">New Opportunity Inquiry from The Band Plan</h3>
        <p><strong>From:</strong> ${sender.username} (${sender.email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 5px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <hr>
        <p style="color: #666; font-size: 14px;">
          This message was sent via The Band Plan's musician contact system.<br>
          Reply directly to this email to respond to ${sender.username}.
        </p>
      </div>
    `;

    try {
      await sendEmail(
        musician.email,
        `[The Band Plan] ${subject}`,
        emailContent,
        { replyTo: sender.email }
      );

      req.flash("success", `Your message has been sent to ${musician.username}!`);
      res.redirect(`/musicians/${slug}`);
    } catch (emailError) {
      console.error("Email send error:", emailError);
      req.flash("error", "Message could not be sent. Please try again later.");
      res.redirect(`/musicians/${slug}/contact`);
    }
  } catch (error) {
    console.error("Contact submission error:", error);
    req.flash("error", "An error occurred sending your message");
    res.redirect("/");
  }
});

// GET /musicians/:slug - Public musician profile
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const user = await prisma.user.findFirst({
      where: { 
        slug,
        isPublic: true,
      },
      include: {
        photos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        bands: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
                slug: true,
                isPublic: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      return res.status(404).render("error", {
        title: "Profile Not Found",
        message: "This musician profile doesn't exist or isn't available yet.",
      });
    }

    const publicProfile = {
      ...user,
      email: undefined,
      password: undefined,
      role: undefined,
    };

    res.render("profile/public", {
      title: user.username,
      profile: publicProfile,
      marqueeTitle: user.username,
      layout: 'layout',
      loggedIn: !!req.session.user,
      currentUserId: req.session.user?.id,
    });
  } catch (error) {
    console.error("Public musician profile error:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "An error occurred loading this profile.",
    });
  }
});

module.exports = router;

