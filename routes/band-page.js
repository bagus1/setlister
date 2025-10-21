const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const { checkStorageQuota } = require("../middleware/checkStorageQuota");
const { updateBandStorageUsage } = require("../utils/storageCalculator");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

const router = express.Router();

// Configure multer for band media uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const bandId = req.params.bandId;
    const uploadDir = path.join(__dirname, "../uploads/bands", bandId.toString());
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const prefix = req.body.fileType || 'file';
    cb(null, prefix + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedImages = /jpeg|jpg|png|webp|gif|svg|ai|pdf/;
    const allowedVideos = /mp4|webm|mov/;
    const allowedAudio = /mp3|wav|ogg|m4a/;
    
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (allowedImages.test(ext) || allowedVideos.test(ext) || allowedAudio.test(ext)) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Middleware to check if user is band member
async function isBandMember(req, res, next) {
  const bandId = parseInt(req.params.bandId);
  const userId = req.session.user.id;

  const membership = await prisma.bandMember.findFirst({
    where: {
      bandId,
      userId,
    },
  });

  if (!membership) {
    req.flash("error", "You are not a member of this band");
    return res.redirect("/bands");
  }

  next();
}

// POST /:bandId/photo/upload - Upload band photo
router.post("/:bandId/photo/upload", requireAuth, isBandMember, checkStorageQuota, upload.single("photo"), async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    
    if (!req.file) {
      req.flash("error", "No photo file provided");
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const { caption, category } = req.body;
    const filePath = `/uploads/bands/${bandId}/` + path.basename(req.file.path);

    const photoCount = await prisma.bandPhoto.count({ where: { bandId } });
    const isPrimary = photoCount === 0;

    await prisma.bandPhoto.create({
      data: {
        bandId,
        filePath,
        caption: caption || null,
        category: category || null,
        isPrimary,
        sortOrder: photoCount,
      },
    });

    // Recalculate band storage after successful upload
    await updateBandStorageUsage(bandId);

    req.flash("success", "Photo uploaded successfully");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Band photo upload error:", error);
    req.flash("error", "An error occurred uploading the photo");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/photo/:photoId/set-primary
router.post("/:bandId/photo/:photoId/set-primary", requireAuth, isBandMember, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const photoId = parseInt(req.params.photoId);

    await prisma.bandPhoto.updateMany({
      where: { bandId },
      data: { isPrimary: false },
    });

    await prisma.bandPhoto.update({
      where: { id: photoId },
      data: { isPrimary: true },
    });

    req.flash("success", "Primary photo updated");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Set primary photo error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/photo/:photoId/delete
router.post("/:bandId/photo/:photoId/delete", requireAuth, isBandMember, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const photoId = parseInt(req.params.photoId);

    const photo = await prisma.bandPhoto.findFirst({
      where: { id: photoId, bandId },
    });

    if (!photo) {
      req.flash("error", "Photo not found");
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const fullPath = path.join(__dirname, "..", photo.filePath);
    try {
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.error("Error deleting file:", fileError);
    }

    await prisma.bandPhoto.delete({ where: { id: photoId } });

    req.flash("success", "Photo deleted");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Delete photo error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/update-public-info - Update band public page info
router.post("/:bandId/update-public-info", requireAuth, isBandMember, [
  body("slug").optional().trim(),
  body("bio").optional().trim(),
  body("tagline").optional().trim(),
  body("genres").optional().trim(),
  body("hometown").optional().trim(),
  body("formedYear").optional().isInt({ min: 1900, max: new Date().getFullYear() }).withMessage("Invalid year"),
], async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const { slug, isPublic, bio, tagline, genres, hometown, formedYear } = req.body;

    // Validate slug if provided
    if (slug) {
      const { validateSlug } = require("../utils/slugify");
      const validation = validateSlug(slug);
      
      if (!validation.valid) {
        req.flash("error", validation.error);
        return res.redirect(`/bands/${bandId}/edit#public-page`);
      }

      const existingBand = await prisma.band.findFirst({
        where: {
          slug,
          NOT: { id: bandId },
        },
      });

      if (existingBand) {
        req.flash("error", "This URL is already taken");
        return res.redirect(`/bands/${bandId}/edit#public-page`);
      }
    }

    await prisma.band.update({
      where: { id: bandId },
      data: {
        slug: slug || null,
        isPublic: isPublic === 'on',
        bio: bio || null,
        tagline: tagline || null,
        genres: genres || null,
        hometown: hometown || null,
        formedYear: formedYear ? parseInt(formedYear) : null,
      },
    });

    req.flash("success", "Public page info updated");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Update public info error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/video/add - Add video link
router.post("/:bandId/video/add", requireAuth, isBandMember, [
  body("title").trim().isLength({ min: 1 }).withMessage("Title is required"),
  body("youtubeUrl").trim().isURL().withMessage("Valid URL required"),
  body("description").optional().trim(),
], async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const { title, youtubeUrl, description } = req.body;

    const videoCount = await prisma.bandVideo.count({ where: { bandId } });

    await prisma.bandVideo.create({
      data: {
        bandId,
        title,
        youtubeUrl,
        description: description || null,
        sortOrder: videoCount,
      },
    });

    req.flash("success", "Video added successfully");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Add video error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/video/:videoId/delete - Delete video
router.post("/:bandId/video/:videoId/delete", requireAuth, isBandMember, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const videoId = parseInt(req.params.videoId);

    const video = await prisma.bandVideo.findFirst({
      where: { id: videoId, bandId },
    });

    if (!video) {
      req.flash("error", "Video not found");
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    await prisma.bandVideo.delete({ where: { id: videoId } });

    req.flash("success", "Video deleted");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Delete video error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/audio/add - Add audio link
router.post("/:bandId/audio/add", requireAuth, isBandMember, [
  body("title").trim().isLength({ min: 1 }).withMessage("Title is required"),
  body("externalUrl").trim().isURL().withMessage("Valid URL required"),
  body("description").optional().trim(),
], async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const { title, externalUrl, description } = req.body;

    const audioCount = await prisma.bandAudio.count({ where: { bandId } });

    await prisma.bandAudio.create({
      data: {
        bandId,
        title,
        externalUrl,
        description: description || null,
        sortOrder: audioCount,
      },
    });

    req.flash("success", "Audio added successfully");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Add audio error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/audio/:audioId/delete - Delete audio
router.post("/:bandId/audio/:audioId/delete", requireAuth, isBandMember, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const audioId = parseInt(req.params.audioId);

    const audio = await prisma.bandAudio.findFirst({
      where: { id: audioId, bandId },
    });

    if (!audio) {
      req.flash("error", "Audio not found");
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    await prisma.bandAudio.delete({ where: { id: audioId } });

    req.flash("success", "Audio deleted");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Delete audio error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/social/add - Add social link
router.post("/:bandId/social/add", requireAuth, isBandMember, [
  body("platform").trim().isLength({ min: 1 }).withMessage("Platform is required"),
  body("url").trim().isURL().withMessage("Valid URL required"),
  body("handle").optional().trim(),
], async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash("error", errors.array()[0].msg);
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    const { platform, url, handle } = req.body;

    const socialCount = await prisma.bandSocialLink.count({ where: { bandId } });

    await prisma.bandSocialLink.create({
      data: {
        bandId,
        platform,
        url,
        handle: handle || null,
        sortOrder: socialCount,
      },
    });

    req.flash("success", "Social link added successfully");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Add social link error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

// POST /:bandId/social/:socialId/delete - Delete social link
router.post("/:bandId/social/:socialId/delete", requireAuth, isBandMember, async (req, res) => {
  try {
    const bandId = parseInt(req.params.bandId);
    const socialId = parseInt(req.params.socialId);

    const social = await prisma.bandSocialLink.findFirst({
      where: { id: socialId, bandId },
    });

    if (!social) {
      req.flash("error", "Social link not found");
      return res.redirect(`/bands/${bandId}/edit#public-page`);
    }

    await prisma.bandSocialLink.delete({ where: { id: socialId } });

    req.flash("success", "Social link deleted");
    res.redirect(`/bands/${bandId}/edit#public-page`);
  } catch (error) {
    console.error("Delete social link error:", error);
    req.flash("error", "An error occurred");
    res.redirect(`/bands/${req.params.bandId}/edit`);
  }
});

module.exports = router;

