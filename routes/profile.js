const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const router = express.Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userId = req.session.user.id;
    const uploadDir = path.join(__dirname, "../uploads/users", userId.toString());
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "photo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, jpg, png, webp) are allowed"));
    }
  },
});

// GET /profile - View current user's profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        bands: {
          include: {
            band: true,
          },
        },
      },
    });

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }

    // Auto-generate slug if user doesn't have one (hybrid approach)
    if (!user.slug) {
      const { generateSlug } = require("../utils/slugify");
      let slug = generateSlug(user.username);
      let counter = 1;
      let isUnique = false;

      // Check uniqueness
      while (!isUnique) {
        const existingUser = await prisma.user.findFirst({
          where: {
            slug,
            NOT: { id: user.id },
          },
        });

        if (!existingUser) {
          isUnique = true;
        } else {
          counter++;
          slug = `${generateSlug(user.username)}-${counter}`;
        }
      }
      
      await prisma.user.update({
        where: { id: user.id },
        data: { slug },
      });
      
      user.slug = slug; // Update the object for rendering
    }

    res.render("profile/index", {
      title: `${user.username}'s Profile`,
      profile: user,
    });
  } catch (error) {
    console.error("Profile view error:", error);
    req.flash("error", "An error occurred loading your profile");
    res.redirect("/");
  }
});

// GET /profile/edit - Edit profile form
router.get("/edit", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
    });

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/");
    }

    res.render("profile/edit", {
      title: "Edit Profile",
      profile: user,
    });
  } catch (error) {
    console.error("Profile edit error:", error);
    req.flash("error", "An error occurred loading your profile");
    res.redirect("/profile");
  }
});

// POST /profile/update - Update profile
router.post(
  "/update",
  requireAuth,
  [
    body("username").trim().isLength({ min: 3 }).withMessage("Username must be at least 3 characters"),
    body("bio").optional().trim(),
    body("location").optional().trim(),
    body("instruments").optional().trim(),
    body("website").optional().isURL().withMessage("Website must be a valid URL"),
    body("slug").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const user = await prisma.user.findUnique({
          where: { id: req.session.user.id },
          include: { photos: true },
        });
        
        return res.render("profile/edit", {
          title: "Edit Profile",
          profile: user,
          errors: errors.array(),
          username: req.body.username,
          bio: req.body.bio,
          location: req.body.location,
          instruments: req.body.instruments,
          website: req.body.website,
          slug: req.body.slug,
        });
      }

      const userId = req.session.user.id;
      const { username, bio, location, instruments, website, slug, isPublic, openToOpportunities } = req.body;

      // Check if username is being changed and if it's unique
      if (username) {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        
        if (username !== currentUser.username) {
          const existingUser = await prisma.user.findFirst({
            where: {
              username,
              NOT: { id: userId },
            },
          });

          if (existingUser) {
            req.flash("error", "This username is already taken");
            return res.redirect("/profile/edit");
          }
        }
      }

      // Validate slug if provided
      if (slug) {
        const { validateSlug } = require("../utils/slugify");
        const validation = validateSlug(slug);
        
        if (!validation.valid) {
          req.flash("error", validation.error);
          return res.redirect("/profile/edit");
        }

        // Check if slug is already taken by another user
        const existingUser = await prisma.user.findFirst({
          where: {
            slug,
            NOT: { id: userId },
          },
        });

        if (existingUser) {
          req.flash("error", "This URL is already taken by another user");
          return res.redirect("/profile/edit");
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          username: username || null,
          bio: bio || null,
          location: location || null,
          instruments: instruments || null,
          website: website || null,
          slug: slug || null,
          isPublic: isPublic === 'on', // Checkbox value
          openToOpportunities: openToOpportunities === 'on', // Checkbox value
        },
      });

      // Update session if username changed
      if (username && username !== req.session.user.username) {
        req.session.user.username = username;
      }

      req.flash("success", "Profile updated successfully");
      res.redirect("/profile");
    } catch (error) {
      console.error("Profile update error:", error);
      req.flash("error", "An error occurred updating your profile");
      res.redirect("/profile/edit");
    }
  }
);

// POST /profile/photo/upload - Upload profile photo
router.post("/photo/upload", requireAuth, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      req.flash("error", "No photo file provided");
      return res.redirect("/profile/edit");
    }

    const userId = req.session.user.id;
    const { caption } = req.body;
    
    // Create relative path for database
    const filePath = `/uploads/users/${userId}/` + path.basename(req.file.path);

    // Get current photo count for sort order
    const photoCount = await prisma.userPhoto.count({
      where: { userId },
    });

    // If this is the first photo, make it primary
    const isPrimary = photoCount === 0;

    await prisma.userPhoto.create({
      data: {
        userId,
        filePath,
        caption: caption || null,
        isPrimary,
        sortOrder: photoCount,
      },
    });

    req.flash("success", "Photo uploaded successfully");
    res.redirect("/profile/edit");
  } catch (error) {
    console.error("Photo upload error:", error);
    req.flash("error", "An error occurred uploading the photo");
    res.redirect("/profile/edit");
  }
});

// POST /profile/photo/:photoId/set-primary - Set photo as primary
router.post("/photo/:photoId/set-primary", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const photoId = parseInt(req.params.photoId);

    // Verify photo belongs to user
    const photo = await prisma.userPhoto.findFirst({
      where: {
        id: photoId,
        userId,
      },
    });

    if (!photo) {
      req.flash("error", "Photo not found");
      return res.redirect("/profile/edit");
    }

    // Unset all other photos as primary
    await prisma.userPhoto.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    // Set this photo as primary
    await prisma.userPhoto.update({
      where: { id: photoId },
      data: { isPrimary: true },
    });

    req.flash("success", "Primary photo updated");
    res.redirect("/profile/edit");
  } catch (error) {
    console.error("Set primary photo error:", error);
    req.flash("error", "An error occurred updating primary photo");
    res.redirect("/profile/edit");
  }
});

// DELETE /profile/photo/:photoId - Delete photo
router.delete("/photo/:photoId", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const photoId = parseInt(req.params.photoId);

    const photo = await prisma.userPhoto.findFirst({
      where: {
        id: photoId,
        userId,
      },
    });

    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Delete file from disk
    const fullPath = path.join(__dirname, "..", photo.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
      // Continue anyway, delete from database
    }

    // Delete from database
    await prisma.userPhoto.delete({
      where: { id: photoId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete photo error:", error);
    res.status(500).json({ error: "An error occurred deleting the photo" });
  }
});

// POST /profile/photo/:photoId/delete - Delete photo (form POST version)
router.post("/photo/:photoId/delete", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const photoId = parseInt(req.params.photoId);

    const photo = await prisma.userPhoto.findFirst({
      where: {
        id: photoId,
        userId,
      },
    });

    if (!photo) {
      req.flash("error", "Photo not found");
      return res.redirect("/profile/edit");
    }

    // Delete file from disk
    const fullPath = path.join(__dirname, "..", photo.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
    }

    // Delete from database
    await prisma.userPhoto.delete({
      where: { id: photoId },
    });

    req.flash("success", "Photo deleted successfully");
    res.redirect("/profile/edit");
  } catch (error) {
    console.error("Delete photo error:", error);
    req.flash("error", "An error occurred deleting the photo");
    res.redirect("/profile/edit");
  }
});

/**
 * GET /profile/subscription - View and manage subscription
 */
router.get("/subscription", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { calculateUserStorageUsage } = require("../utils/storageCalculator");

    // Get user's subscription
    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        plan: true,
      },
    });

    // Get all available plans
    const allPlans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    // Calculate storage usage
    const storageInfo = await calculateUserStorageUsage(userId);

    res.render("profile/subscription", {
      title: "My Subscription",
      user: req.session.user,
      subscription,
      currentPlan: subscription?.plan || null,
      allPlans,
      storageInfo,
    });
  } catch (error) {
    console.error("Subscription page error:", error);
    req.flash("error", "Failed to load subscription information");
    res.redirect("/profile");
  }
});

/**
 * POST /profile/subscription/change - Change subscription plan
 * NOTE: This is a placeholder until Stripe is integrated
 */
router.post("/subscription/change", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { planId } = req.body;

    if (!planId) {
      req.flash("error", "Please select a plan");
      return res.redirect("/profile/subscription");
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: parseInt(planId) },
    });

    if (!newPlan) {
      req.flash("error", "Invalid plan selected");
      return res.redirect("/profile/subscription");
    }

    // Check if user has existing subscription
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      // Update existing
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          planId: newPlan.id,
          status: 'active',
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new
      await prisma.userSubscription.create({
        data: {
          userId,
          planId: newPlan.id,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        },
      });
    }

    req.flash("success", `Successfully switched to ${newPlan.name} plan!`);
    res.redirect("/profile/subscription");
  } catch (error) {
    console.error("Change plan error:", error);
    req.flash("error", "Failed to change plan");
    res.redirect("/profile/subscription");
  }
});

/**
 * POST /profile/subscription/cancel - Cancel subscription
 */
router.post("/subscription/cancel", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      req.flash("error", "You don't have an active subscription");
      return res.redirect("/profile/subscription");
    }

    await prisma.userSubscription.update({
      where: { userId },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    req.flash("success", "Subscription canceled. You'll keep access until the end of your billing period.");
    res.redirect("/profile/subscription");
  } catch (error) {
    console.error("Cancel subscription error:", error);
    req.flash("error", "Failed to cancel subscription");
    res.redirect("/profile/subscription");
  }
});

module.exports = router;

