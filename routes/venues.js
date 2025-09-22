const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");
const logger = require("../utils/logger");

const router = express.Router();

// Helper function to extract username from social media handles
function extractUsernameFromHandle(handle, platform) {
  if (!handle) return "";

  let cleanHandle = handle.trim();

  // Remove common prefixes
  cleanHandle = cleanHandle.replace(/^@/, "");

  // Platform-specific URL handling
  switch (platform) {
    case "facebook":
      // Handle Facebook URLs like https://facebook.com/username or just username
      if (cleanHandle.includes("facebook.com/")) {
        const match = cleanHandle.match(/facebook\.com\/([^\/\?]+)/);
        if (match) {
          cleanHandle = match[1];
        }
      }
      break;
    case "instagram":
      // Handle Instagram URLs like https://instagram.com/username or just username
      if (cleanHandle.includes("instagram.com/")) {
        const match = cleanHandle.match(/instagram\.com\/([^\/\?]+)/);
        if (match) {
          cleanHandle = match[1];
        }
      }
      break;
    case "linkedin":
      // Handle LinkedIn URLs like https://linkedin.com/company/username or just username
      if (cleanHandle.includes("linkedin.com/")) {
        const match = cleanHandle.match(
          /linkedin\.com\/(?:company\/)?([^\/\?]+)/
        );
        if (match) {
          cleanHandle = match[1];
        }
      }
      break;
    case "twitter":
      // Handle Twitter URLs like https://twitter.com/username or just username
      if (cleanHandle.includes("twitter.com/")) {
        const match = cleanHandle.match(/twitter\.com\/([^\/\?]+)/);
        if (match) {
          cleanHandle = match[1];
        }
      }
      break;
  }

  return cleanHandle;
}

// Helper function to create corresponding contact when adding social media
async function createCorrespondingContact(venueId, socialType, handle) {
  let contactTypeName = null;
  let contactValue = handle.trim();

  // Map social platforms to their corresponding message contact types
  switch (socialType.name) {
    case "Facebook":
      contactTypeName = "FACEBOOK_MESSAGE";
      contactValue = extractUsernameFromHandle(handle, "facebook");
      break;
    case "Instagram":
      contactTypeName = "INSTAGRAM_MESSAGE";
      contactValue = extractUsernameFromHandle(handle, "instagram");
      break;
    case "LinkedIn":
      contactTypeName = "LINKEDIN_MESSAGE";
      contactValue = extractUsernameFromHandle(handle, "linkedin");
      break;
    case "Twitter":
      contactTypeName = "TWITTER_MESSAGE";
      contactValue = extractUsernameFromHandle(handle, "twitter");
      break;
  }

  if (contactTypeName) {
    // Find the contact type
    const contactType = await prisma.venueContactType.findFirst({
      where: { name: contactTypeName },
    });

    if (contactType) {
      // Generate URL from template
      let contactUrl = null;
      if (contactType.urlTemplate) {
        contactUrl = contactType.urlTemplate.replace("{contact}", contactValue);
      }

      // Create the corresponding contact
      await prisma.venueContact.create({
        data: {
          venueId: venueId,
          contactTypeId: contactType.id,
          value: contactValue,
          url: contactUrl,
          label: `${socialType.name} Message`,
          isPrimary: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
    }
  } else {
  }
}

// GET /venues - Show all venues
router.get("/", async (req, res) => {
  try {
    const venues = await prisma.venue.findMany({
      include: {
        venueType: true,
      },
      orderBy: { name: "asc" },
    });

    res.render("venues/index", {
      pageTitle: "Venues",
      venues,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    logger.logError("Venues index error", error);
    req.flash("error", "Error loading venues");
    res.redirect("/");
  }
});

// GET /venues/new - Show new venue form
router.get("/new", requireAuth, async (req, res) => {
  try {
    const venueTypes = await prisma.venueType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const socialTypes = await prisma.venueSocialType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const contactTypes = await prisma.venueContactType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    res.render("venues/new", {
      title: "Add New Venue",
      venueTypes,
      socialTypes,
      contactTypes,
    });
  } catch (error) {
    logger.logError("New venue form error", error);
    req.flash("error", "Error loading form");
    res.redirect("/venues");
  }
});

// POST /venues - Create new venue
router.post(
  "/",
  requireAuth,
  [
    body("name").notEmpty().withMessage("Venue name is required"),
    body("city").optional().trim(),
    body("state").optional().trim(),
    body("phone").optional().trim(),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please enter a valid email"),
    body("website").optional().isURL().withMessage("Please enter a valid URL"),
    body("capacity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Capacity must be a positive number"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Fetch required data for form rendering
        const [venueTypes, socialTypes, contactTypes] = await Promise.all([
          prisma.venueType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
          prisma.venueSocialType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
          prisma.venueContactType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
        ]);

        return res.render("venues/new", {
          title: "Add New Venue",
          errors: errors.array(),
          formData: req.body,
          venueTypes,
          socialTypes,
          contactTypes,
        });
      }

      const {
        name,
        address,
        city,
        state,
        zipCode,
        phone,
        email,
        website,
        capacity,
        venueType,
        musicStyle,
        stageLocation,
        soundSystem,
        stageSize,
        bookingStatus,
        fees,
        leadTime,
        notes,
        contactTypes,
        contactValues,
        contactLabels,
        contactUrls,
        socialPlatforms,
        socialHandles,
        socialUrls,
      } = req.body;

      // Convert capacity to integer if provided
      const capacityInt =
        capacity && capacity.trim() ? parseInt(capacity) : null;

      const venue = await prisma.venue.create({
        data: {
          name: name.trim(),
          address: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          zipCode: zipCode?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          website: website?.trim() || null,
          capacity: capacityInt,
          venueType: venueType
            ? { connect: { id: parseInt(venueType) } }
            : undefined,
          musicStyle: musicStyle?.trim() || null,
          stageLocation: stageLocation?.trim() || null,
          soundSystem: soundSystem?.trim() || null,
          stageSize: stageSize?.trim() || null,
          bookingStatus: bookingStatus?.trim() || null,
          fees: fees?.trim() || null,
          leadTime: leadTime?.trim() || null,
          notes: notes?.trim() || null,
          creator: { connect: { id: req.session.user.id } },
          createdAt: new Date(),
        },
      });

      // Process contact information
      if (contactTypes && contactTypes.length > 0) {
        const contactData = contactTypes
          .map((typeId, index) => ({
            venueId: venue.id,
            contactTypeId: parseInt(typeId),
            value: contactValues[index]?.trim() || "",
            url: contactUrls?.[index]?.trim() || null,
            label: contactLabels[index]?.trim() || null,
            isPrimary: index === 0, // First contact is primary
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
          .filter((contact) => contact.value); // Only include contacts with values

        if (contactData.length > 0) {
          await prisma.venueContact.createMany({
            data: contactData,
          });
        }
      }

      // Process social media information
      if (socialPlatforms && socialPlatforms.length > 0) {
        const socialData = socialPlatforms
          .map((platformId, index) => ({
            venueId: venue.id,
            socialTypeId: parseInt(platformId),
            handle: socialHandles[index]?.trim() || "",
            url: socialUrls?.[index]?.trim() || null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
          .filter((social) => social.handle); // Only include socials with handles

        if (socialData.length > 0) {
          await prisma.venueSocial.createMany({
            data: socialData,
          });

          // Create corresponding contacts for messaging platforms
          for (const social of socialData) {
            try {
              const socialType = await prisma.venueSocialType.findUnique({
                where: { id: social.socialTypeId },
              });

              if (socialType) {
                await createCorrespondingContact(
                  venue.id,
                  socialType,
                  social.handle
                );
              }
            } catch (autoError) {
              // Log automation error but don't fail the main operation
              logger.logError(
                "Contact automation error during venue creation",
                autoError
              );
            }
          }
        }
      }

      req.flash("success", "Venue added successfully");
      res.redirect(`/venues/${venue.id}`);
    } catch (error) {
      logger.logError("Create venue error", error);
      req.flash("error", "Error creating venue");

      // Fetch required data for form rendering
      const [venueTypes, socialTypes, contactTypes] = await Promise.all([
        prisma.venueType.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.venueSocialType.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.venueContactType.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

      res.render("venues/new", {
        title: "Add New Venue",
        formData: req.body,
        venueTypes,
        socialTypes,
        contactTypes,
      });
    }
  }
);

// GET /venues/:id - Show specific venue
router.get("/:id", async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        venueType: true,
        contacts: {
          include: {
            contactType: true,
          },
          where: {
            isActive: true,
          },
        },
        socials: {
          include: {
            socialType: true,
          },
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!venue) {
      req.flash("error", "Venue not found");
      return res.redirect("/venues");
    }

    // Get contact and social types for modals
    const [contactTypes, socialTypes] = await Promise.all([
      prisma.venueContactType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.venueSocialType.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    logger.logInfo(`Contact types found: ${contactTypes.length}`);
    logger.logInfo(`Social types found: ${socialTypes.length}`);

    res.render("venues/show", {
      pageTitle: venue.name,
      venue,
      contactTypes,
      socialTypes,
      loggedIn: !!req.session.user,
      currentUser: req.session.user,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    logger.logError("Venue show error", error);
    req.flash("error", "Error loading venue");
    res.redirect("/venues");
  }
});

// GET /venues/:id/edit - Show edit venue form
router.get("/:id/edit", requireAuth, async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!venue) {
      req.flash("error", "Venue not found");
      return res.redirect("/venues");
    }

    // Check if user is the creator of the venue
    if (venue.createdById !== req.session.user.id) {
      req.flash("error", "You can only edit venues you created");
      return res.redirect(`/venues/${venue.id}`);
    }

    const venueTypes = await prisma.venueType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const socialTypes = await prisma.venueSocialType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const contactTypes = await prisma.venueContactType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    res.render("venues/edit", {
      title: `Edit ${venue.name}`,
      venue,
      venueTypes,
      socialTypes,
      contactTypes,
      returnUrl: req.query.returnUrl || null,
    });
  } catch (error) {
    logger.logError("Edit venue form error", error);
    res.redirect("/venues");
  }
});

// POST /venues/:id/update - Update venue
router.post(
  "/:id/update",
  requireAuth,
  [
    body("name").notEmpty().withMessage("Venue name is required"),
    body("city").optional().trim(),
    body("state").optional().trim(),
    body("phone").optional().trim(),
    body("email")
      .optional()
      .isEmail()
      .withMessage("Please enter a valid email"),
    body("website").optional().isURL().withMessage("Please enter a valid URL"),
    body("capacity")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Capacity must be a positive number"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const venue = await prisma.venue.findUnique({
          where: { id: parseInt(req.params.id) },
        });

        const [venueTypes, socialTypes, contactTypes] = await Promise.all([
          prisma.venueType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
          prisma.venueSocialType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
          prisma.venueContactType.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          }),
        ]);

        return res.render("venues/edit", {
          title: `Edit ${venue.name}`,
          venue,
          venueTypes,
          socialTypes,
          contactTypes,
          errors: errors.array(),
          formData: req.body,
          returnUrl: req.query.returnUrl || req.body.returnUrl || null,
        });
      }

      const venue = await prisma.venue.findUnique({
        where: { id: parseInt(req.params.id) },
      });

      if (!venue) {
        req.flash("error", "Venue not found");
        return res.redirect("/venues");
      }

      // Check if user is the creator of the venue
      if (venue.createdById !== req.session.user.id) {
        req.flash("error", "You can only edit venues you created");
        return res.redirect(`/venues/${venue.id}`);
      }

      const {
        name,
        address,
        city,
        state,
        zipCode,
        phone,
        email,
        website,
        capacity,
        venueType,
        musicStyle,
        stageLocation,
        soundSystem,
        stageSize,
        bookingStatus,
        fees,
        leadTime,
        notes,
        contactTypes,
        contactValues,
        contactLabels,
        contactUrls,
        socialPlatforms,
        socialHandles,
        socialUrls,
      } = req.body;

      // Convert capacity to integer if provided
      const capacityInt =
        capacity && capacity.trim() ? parseInt(capacity) : null;

      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          name: name.trim(),
          address: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          zipCode: zipCode?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          website: website?.trim() || null,
          capacity: capacityInt,
          venueType: venueType
            ? { connect: { id: parseInt(venueType) } }
            : undefined,
          musicStyle: musicStyle?.trim() || null,
          stageLocation: stageLocation?.trim() || null,
          soundSystem: soundSystem?.trim() || null,
          stageSize: stageSize?.trim() || null,
          bookingStatus: bookingStatus?.trim() || null,
          fees: fees?.trim() || null,
          leadTime: leadTime?.trim() || null,
          notes: notes?.trim() || null,
          updatedAt: new Date(),
        },
      });

      req.flash("success", "Venue updated successfully");
      
      // Check if there's a return URL parameter
      const returnUrl = req.query.returnUrl || req.body.returnUrl;
      if (returnUrl && returnUrl.startsWith('/bands/')) {
        res.redirect(returnUrl);
      } else {
        res.redirect(`/venues/${venue.id}`);
      }
    } catch (error) {
      logger.logError("Update venue error", error);
      req.flash("error", "Error updating venue");
      res.redirect(`/venues/${req.params.id}/edit`);
    }
  }
);

// DELETE /venues/:id - Delete venue
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!venue) {
      req.flash("error", "Venue not found");
      return res.redirect("/venues");
    }

    // Check if user is the creator of the venue
    if (venue.createdById !== req.session.user.id) {
      req.flash("error", "You can only delete venues you created");
      return res.redirect(`/venues/${venue.id}`);
    }

    await prisma.venue.delete({
      where: { id: parseInt(req.params.id) },
    });

    req.flash("success", "Venue deleted successfully");
    res.redirect("/venues");
  } catch (error) {
    logger.logError("Delete venue error", error);
    req.flash("error", "Error deleting venue");
    res.redirect("/venues");
  }
});

// POST /venues/:id/contacts - Add contact to venue
router.post("/:id/contacts", requireAuth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id);
    const { contactTypeId, value, label, url } = req.body;

    // Verify venue exists and user owns it
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return res.status(404).json({ success: false, error: "Venue not found" });
    }

    if (venue.createdById !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        error: "You can only add contacts to venues you created",
      });
    }

    // Parse the value to extract handle from URL if needed
    let parsedValue = value.trim();
    let parsedUrl = url?.trim() || null;
    
    // Get the contact type to determine if we need URL parsing
    const contactType = await prisma.venueContactType.findUnique({
      where: { id: parseInt(contactTypeId) },
    });
    
    if (contactType) {
      // Parse Facebook URLs
      if (contactType.name === 'FACEBOOK_MESSAGE' && parsedValue.includes('facebook.com/')) {
        parsedValue = extractUsernameFromHandle(parsedValue, 'facebook');
        // Generate URL from template if available
        if (contactType.urlTemplate) {
          parsedUrl = contactType.urlTemplate.replace('{contact}', parsedValue);
        }
      }
      // Parse Instagram URLs
      else if (contactType.name === 'INSTAGRAM_MESSAGE' && parsedValue.includes('instagram.com/')) {
        parsedValue = extractUsernameFromHandle(parsedValue, 'instagram');
        if (contactType.urlTemplate) {
          parsedUrl = contactType.urlTemplate.replace('{contact}', parsedValue);
        }
      }
      // Parse Twitter URLs
      else if (contactType.name === 'TWITTER_MESSAGE' && parsedValue.includes('twitter.com/')) {
        parsedValue = extractUsernameFromHandle(parsedValue, 'twitter');
        if (contactType.urlTemplate) {
          parsedUrl = contactType.urlTemplate.replace('{contact}', parsedValue);
        }
      }
      // Parse LinkedIn URLs
      else if (contactType.name === 'LINKEDIN_MESSAGE' && parsedValue.includes('linkedin.com/')) {
        parsedValue = extractUsernameFromHandle(parsedValue, 'linkedin');
        if (contactType.urlTemplate) {
          parsedUrl = contactType.urlTemplate.replace('{contact}', parsedValue);
        }
      }
    }

    // Check if contact already exists
    const existingContact = await prisma.venueContact.findFirst({
      where: {
        venueId: venueId,
        contactTypeId: parseInt(contactTypeId),
        value: parsedValue,
      },
    });

    if (existingContact) {
      return res.status(400).json({
        success: false,
        error: "A contact with this information already exists for this venue",
      });
    }

    // Create the contact
    const contact = await prisma.venueContact.create({
      data: {
        venueId: venueId,
        contactTypeId: parseInt(contactTypeId),
        value: parsedValue,
        label: label?.trim() || null,
        url: parsedUrl,
        isPrimary: false, // New contacts are not primary by default
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, contact });
  } catch (error) {
    logger.logError("Add venue contact error", error);
    
    // Handle unique constraint violation specifically
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: "A contact with this information already exists for this venue",
      });
    }
    
    res.status(500).json({ success: false, error: "Error adding contact" });
  }
});

// POST /venues/:id/socials - Add social media to venue
router.post("/:id/socials", requireAuth, async (req, res) => {
  try {
    const venueId = parseInt(req.params.id);
    const { socialTypeId, handle, url } = req.body;

    // Verify venue exists and user owns it
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return res.status(404).json({ success: false, error: "Venue not found" });
    }

    if (venue.createdById !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        error: "You can only add social media to venues you created",
      });
    }

    // Create the social media entry
    const social = await prisma.venueSocial.create({
      data: {
        venueId: venueId,
        socialTypeId: parseInt(socialTypeId),
        handle: handle.trim(),
        url: url?.trim() || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Automation: Create corresponding contact if it's a messaging platform
    try {
      const socialType = await prisma.venueSocialType.findUnique({
        where: { id: parseInt(socialTypeId) },
      });

      if (socialType) {
        // Create corresponding contact using shared function
        await createCorrespondingContact(venueId, socialType, handle);
        logger.logInfo(`Auto-created contact for ${socialType.name} social`);
      }
    } catch (autoError) {
      // Log automation error but don't fail the main operation
      logger.logError("Contact automation error", autoError);
      console.error("Automation error details:", autoError);
    }

    res.json({ success: true, social });
  } catch (error) {
    logger.logError("Add venue social error", error);
    res
      .status(500)
      .json({ success: false, error: "Error adding social media" });
  }
});

module.exports = router;
