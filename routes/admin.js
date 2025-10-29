const express = require("express");
const router = express.Router();
const path = require("path");
const logger = require("../utils/logger");
const { requireAuth } = require("./auth");
const { requireRole } = require("../middleware/rbac");
const { prisma } = require("../lib/prisma");

// Apply auth middleware to all admin routes
router.use(requireAuth);
router.use(requireRole("moderator")); // Allow both moderators and admins

/**
 * GET /admin - Moderator Dashboard
 */
// POST /admin/recalculate-storage - Recalculate storage for all bands
router.post("/recalculate-storage", async (req, res) => {
  try {
    const {
      updateBandStorageUsage,
      formatBytes,
    } = require("../utils/storageCalculator");

    const bands = await prisma.band.findMany({
      select: { id: true, name: true },
    });

    let totalProcessed = 0;
    let totalBytes = BigInt(0);
    let errors = 0;
    const results = [];

    for (const band of bands) {
      try {
        const bytes = await updateBandStorageUsage(band.id);
        const formatted = formatBytes(bytes);
        results.push({
          band: band.name,
          bytes: Number(bytes),
          formatted,
          success: true,
        });
        totalBytes += bytes;
        totalProcessed++;
      } catch (error) {
        results.push({
          band: band.name,
          error: error.message,
          success: false,
        });
        errors++;
        logger.logError(
          `Error recalculating storage for band ${band.name}`,
          error
        );
      }
    }

    logger.logFormSubmission(
      `Recalculated storage for all bands: ${totalProcessed} processed, ${errors} errors`,
      req,
      { totalProcessed, errors, totalBytes: totalBytes.toString() }
    );

    req.flash(
      "success",
      `Recalculated storage for ${totalProcessed} band(s). ${errors > 0 ? `${errors} error(s) occurred.` : ""}`
    );
    res.redirect("/admin/recordings");
  } catch (error) {
    logger.logError("Admin recalculate all storage error", error);
    req.flash("error", "Failed to recalculate storage for all bands");
    res.redirect("/admin/recordings");
  }
});

router.get("/", async (req, res) => {
  try {
    // Get stats for dashboard
    const [
      totalUsers,
      totalVenues,
      totalBands,
      pendingChanges,
      totalSongs,
      totalSetlists,
      totalDocuments,
      totalArtists,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.venue.count(),
      prisma.band.count(),
      prisma.venueChange.count({ where: { status: "pending" } }),
      prisma.song.count(),
      prisma.setlist.count(),
      prisma.gigDocument.count(),
      prisma.artist.count(),
    ]);

    // Get recent activity (simplified for now)
    const recentActivity = [
      {
        title: "New User Registration",
        description: "A new user joined the platform",
        timeAgo: "2 hours ago",
      },
      {
        title: "Venue Change Suggestion",
        description: "User suggested updating venue contact information",
        timeAgo: "4 hours ago",
      },
    ];

    res.render("admin/index", {
      title: "Moderator Dashboard",
      marqueeTitle: "Admin",
      user: req.session.user,
      stats: {
        totalUsers,
        totalVenues,
        totalBands,
        pendingChanges,
        totalSongs,
        totalSetlists,
        totalDocuments,
        totalArtists,
      },
      recentActivity,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error", "Failed to load dashboard");
    res.redirect("/dashboard");
  }
});

/**
 * GET /admin/users - List all users with their roles
 */
router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            bands: true,
            createdBands: true,
            createdSongs: true,
            createdVenues: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.render("admin/users", {
      title: "User Management",
      marqueeTitle: "Admin Users",
      users,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    req.flash("error", "Failed to load users");
    res.redirect("/dashboard");
  }
});

/**
 * POST /admin/users/:id/role - Update user role
 */
router.post("/users/:id/role", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;

    // Validate role
    const validRoles = ["user", "moderator", "admin"];
    if (!validRoles.includes(role)) {
      req.flash("error", "Invalid role specified");
      return res.redirect("/admin/users");
    }

    // Prevent admin from removing their own admin role
    if (userId === req.session.user.id && role !== "admin") {
      req.flash("error", "You cannot remove your own admin role");
      return res.redirect("/admin/users");
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, username: true, role: true },
    });

    req.flash("success", `Updated ${updatedUser.username}'s role to ${role}`);
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Error updating user role:", error);
    req.flash("error", "Failed to update user role");
    res.redirect("/admin/users");
  }
});

/**
 * GET /admin/venue-changes - List pending venue changes
 */
router.get("/venue-changes", async (req, res) => {
  try {
    const changes = await prisma.venueChange.findMany({
      where: { status: "pending" },
      include: {
        venue: {
          select: { id: true, name: true, city: true, state: true },
        },
        suggestedBy: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.render("admin/venue-changes", {
      title: "Venue Changes Review",
      marqueeTitle: "Admin Venue Changes",
      changes,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("Error fetching venue changes:", error);
    req.flash("error", "Failed to load venue changes");
    res.redirect("/dashboard");
  }
});

/**
 * POST /admin/venue-changes/:id/approve - Approve a venue change
 */
router.post("/venue-changes/:id/approve", async (req, res) => {
  try {
    const changeId = parseInt(req.params.id);
    const reviewerId = req.session.user.id;

    // Get the change with venue info
    const change = await prisma.venueChange.findUnique({
      where: { id: changeId },
      include: { venue: true },
    });

    if (!change || change.status !== "pending") {
      req.flash("error", "Change not found or already processed");
      return res.redirect("/admin/venue-changes");
    }

    // Update the venue field
    const updateData = {};
    updateData[change.fieldName] = change.suggestedValue;

    await prisma.$transaction([
      // Update the venue
      prisma.venue.update({
        where: { id: change.venueId },
        data: updateData,
      }),
      // Mark the change as approved
      prisma.venueChange.update({
        where: { id: changeId },
        data: {
          status: "approved",
          reviewedByUserId: reviewerId,
          reviewedAt: new Date(),
        },
      }),
    ]);

    req.flash("success", `Approved change for ${change.venue.name}`);
    res.redirect("/admin/venue-changes");
  } catch (error) {
    console.error("Error approving venue change:", error);
    req.flash("error", "Failed to approve venue change");
    res.redirect("/admin/venue-changes");
  }
});

/**
 * POST /admin/venue-changes/:id/reject - Reject a venue change
 */
router.post("/venue-changes/:id/reject", async (req, res) => {
  try {
    const changeId = parseInt(req.params.id);
    const reviewerId = req.session.user.id;
    const { reason } = req.body;

    const change = await prisma.venueChange.findUnique({
      where: { id: changeId },
      include: { venue: true },
    });

    if (!change || change.status !== "pending") {
      req.flash("error", "Change not found or already processed");
      return res.redirect("/admin/venue-changes");
    }

    await prisma.venueChange.update({
      where: { id: changeId },
      data: {
        status: "rejected",
        reviewedByUserId: reviewerId,
        reviewedAt: new Date(),
        reason: reason || "Rejected by moderator",
      },
    });

    req.flash("success", `Rejected change for ${change.venue.name}`);
    res.redirect("/admin/venue-changes");
  } catch (error) {
    console.error("Error rejecting venue change:", error);
    req.flash("error", "Failed to reject venue change");
    res.redirect("/admin/venue-changes");
  }
});

/**
 * GET /admin/venues - Venue Management
 */
router.get("/venues", async (req, res) => {
  try {
    const { search, city, state } = req.query;

    let whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }

    if (city) {
      whereClause.city = { contains: city, mode: "insensitive" };
    }

    if (state) {
      whereClause.state = state;
    }

    const venues = await prisma.venue.findMany({
      where: whereClause,
      include: {
        venueType: true,
        contacts: true,
        socials: true,
      },
      orderBy: { name: "asc" },
      take: 100, // Limit to prevent performance issues
    });

    res.render("admin/venues", {
      title: "Venue Management",
      marqueeTitle: "Admin Venues",
      venues,
      searchQuery: search || "",
      cityFilter: city || "",
      stateFilter: state || "",
      currentUser: req.session.user,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Venue management error:", error);
    req.flash("error", "Failed to load venues");
    res.redirect("/admin");
  }
});

/**
 * POST /admin/venues/:id/delete - Delete venue (admin only)
 */
router.post("/venues/:id/delete", async (req, res) => {
  try {
    if (req.session.user.role !== "admin") {
      req.flash("error", "Only administrators can delete venues");
      return res.redirect("/admin/venues");
    }

    const venueId = parseInt(req.params.id);

    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      req.flash("error", "Venue not found");
      return res.redirect("/admin/venues");
    }

    // Delete venue (cascade will handle related records)
    await prisma.venue.delete({
      where: { id: venueId },
    });

    req.flash("success", `Venue "${venue.name}" deleted successfully`);
    res.redirect("/admin/venues");
  } catch (error) {
    console.error("Delete venue error:", error);
    req.flash("error", "Failed to delete venue");
    res.redirect("/admin/venues");
  }
});

/**
 * GET /admin/songs - Song Management
 */
router.get("/songs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";

    // Build search conditions
    const searchConditions = search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            {
              artists: {
                some: {
                  artist: { name: { contains: search, mode: "insensitive" } },
                },
              },
            },
            { vocalist: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};

    // Get total count for pagination
    const totalSongs = await prisma.song.count({
      where: searchConditions,
    });

    // Build orderBy based on sort parameters
    let orderBy = {};
    if (sortBy === "title") {
      orderBy = { title: sortOrder };
    } else if (sortBy === "createdAt") {
      orderBy = { createdAt: sortOrder };
    } else if (sortBy === "key") {
      orderBy = { key: sortOrder };
    } else {
      orderBy = { createdAt: "desc" };
    }

    // Get songs with pagination
    const songs = await prisma.song.findMany({
      where: searchConditions,
      include: {
        artists: {
          include: { artist: true },
        },
        creator: {
          select: { username: true },
        },
        _count: {
          select: {
            gigDocuments: true,
            links: true,
            bandSongs: true,
          },
        },
      },
      orderBy: orderBy,
      skip: skip,
      take: limit,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalSongs / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.render("admin/songs", {
      title: "Song Management",
      marqueeTitle: "Admin Songs",
      songs,
      totalSongs,
      currentPage: page,
      totalPages,
      hasNextPage,
      hasPrevPage,
      search,
      sortBy,
      sortOrder,
      currentUser: req.session.user,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Song management error:", error);
    req.flash("error", "Failed to load song management");
    res.redirect("/admin");
  }
});

/**
 * DELETE /admin/songs/:id - Delete a song (admin only)
 */
router.delete("/songs/:id", async (req, res) => {
  try {
    const songId = parseInt(req.params.id);
    const userId = req.session?.user?.id || null;
    const ip =
      req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress;

    // Log the action
    logger.logFormSubmission(`/admin/songs/${songId}`, "deleted", userId, {
      songId,
    });
    console.log(
      `[ADMIN] Attempting to delete song ${songId} by user ${userId}`
    );

    // Check if song exists
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        links: {
          include: {
            recordingSplit: true,
          },
        },
        bandSongs: true,
        setlistSongs: true,
        albumTracks: true,
        recordingSplits: true,
      },
    });

    if (!song) {
      console.log(`[ADMIN] Song ${songId} not found`);
      return res.status(404).json({
        success: false,
        error: "Song not found",
      });
    }

    console.log(`[ADMIN] Song found: ${song.title}`);
    console.log(`[ADMIN] Links: ${song.links?.length || 0}`);
    console.log(
      `[ADMIN] Recording splits: ${song.recordingSplits?.length || 0}`
    );
    console.log(`[ADMIN] Band songs: ${song.bandSongs?.length || 0}`);
    console.log(`[ADMIN] Setlist songs: ${song.setlistSongs?.length || 0}`);
    console.log(`[ADMIN] Album tracks: ${song.albumTracks?.length || 0}`);

    // Delete all associated records manually since onDelete is NoAction

    const fs = require("fs");

    // Delete recording splits and their associated files
    if (song.recordingSplits && song.recordingSplits.length > 0) {
      for (const split of song.recordingSplits) {
        // Delete associated split file
        if (split.filePath) {
          const splitPath = path.join(__dirname, "..", split.filePath);
          if (fs.existsSync(splitPath)) {
            fs.unlinkSync(splitPath);
          }
        }
        // Delete the recording split
        await prisma.recordingSplit.delete({
          where: { id: split.id },
        });
      }
    }

    // Delete all remaining links (those not associated with recording splits)
    console.log(`[ADMIN] Deleting remaining links...`);
    await prisma.link.deleteMany({
      where: { songId: songId },
    });

    // Delete album tracks
    if (song.albumTracks && song.albumTracks.length > 0) {
      console.log(
        `[ADMIN] Deleting ${song.albumTracks.length} album tracks...`
      );
      await prisma.albumTrack.deleteMany({
        where: { songId: songId },
      });
    }

    // Delete band songs
    if (song.bandSongs && song.bandSongs.length > 0) {
      console.log(`[ADMIN] Deleting ${song.bandSongs.length} band songs...`);
      await prisma.bandSong.deleteMany({
        where: { songId: songId },
      });
    }

    // Delete setlist songs
    if (song.setlistSongs && song.setlistSongs.length > 0) {
      console.log(
        `[ADMIN] Deleting ${song.setlistSongs.length} setlist songs...`
      );
      await prisma.setlistSong.deleteMany({
        where: { songId: songId },
      });
    }

    // Delete song artists
    console.log(`[ADMIN] Deleting song artists...`);
    await prisma.songArtist.deleteMany({
      where: { songId: songId },
    });

    // Now delete the song
    console.log(`[ADMIN] Deleting song...`);
    await prisma.song.delete({
      where: { id: songId },
    });

    console.log(`[ADMIN] Song ${songId} deleted successfully`);
    res.json({
      success: true,
      message: "Song deleted successfully",
    });
  } catch (error) {
    console.error("[ADMIN] Delete song error:", error);
    console.error("[ADMIN] Error details:", error.message);
    console.error("[ADMIN] Stack:", error.stack);
    logger.logError("Admin delete song error", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete song",
    });
  }
});

/**
 * GET /admin/whitelist-requests - Manage whitelist requests
 */
router.get("/whitelist-requests", async (req, res) => {
  try {
    const requests = await prisma.whitelistRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.render("admin/whitelist-requests", {
      title: "Manage Whitelist Requests",
      marqueeTitle: "Admin Whitelist Requests",
      requests,
      user: req.user,
    });
  } catch (error) {
    console.error("Error loading whitelist requests:", error);
    res.status(500).render("admin/whitelist-requests", {
      title: "Manage Whitelist Requests",
      marqueeTitle: "Admin Whitelist Requests",
      requests: [],
      error: "Error loading whitelist requests",
      user: req.user,
    });
  }
});

/**
 * GET /admin/subscriptions - View all user subscriptions and system stats
 */
router.get("/subscriptions", async (req, res) => {
  try {
    const {
      calculateUserStorageUsage,
      formatBytes,
    } = require("../utils/storageCalculator");

    // Get all users with their subscriptions
    const users = await prisma.user.findMany({
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        bands: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
                storageUsedBytes: true,
              },
            },
          },
        },
      },
      orderBy: [
        { subscription: { plan: { storageQuotaGB: "desc" } } },
        { createdAt: "desc" },
      ],
    });

    // Calculate storage usage for each user
    const usersWithStorage = await Promise.all(
      users.map(async (user) => {
        let storageInfo = null;
        try {
          storageInfo = await calculateUserStorageUsage(user.id);
        } catch (error) {
          console.error(
            `Error calculating storage for user ${user.id}:`,
            error.message
          );
        }

        return {
          ...user,
          storageInfo,
          planName: user.subscription?.plan?.name || "Free",
          planPrice: user.subscription?.plan?.priceMonthly || 0,
          status: user.subscription?.status || "none",
        };
      })
    );

    // Calculate system-wide statistics
    const totalUsers = users.length;
    const activeSubscriptions = users.filter(
      (u) => u.subscription?.status === "active"
    ).length;
    const freeUsers = users.filter(
      (u) => !u.subscription || u.subscription.plan.storageQuotaGB === 8
    ).length;
    const proUsers = users.filter(
      (u) => u.subscription?.plan?.storageQuotaGB === 20
    ).length;
    const premiumUsers = users.filter(
      (u) => u.subscription?.plan?.storageQuotaGB === 100
    ).length;

    // Calculate monthly recurring revenue (MRR)
    const mrr =
      users
        .filter((u) => u.subscription?.status === "active")
        .reduce(
          (sum, u) => sum + (u.subscription?.plan?.priceMonthly || 0),
          0
        ) / 100;

    // Calculate total storage usage
    const totalStorageBytes = users.reduce((sum, user) => {
      return sum + (user.storageInfo?.usedGB || 0);
    }, 0);

    // Get all subscription plans for the dropdown
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });

    res.render("admin/subscriptions", {
      title: "Subscription Management",
      user: req.user,
      users: usersWithStorage,
      plans,
      stats: {
        totalUsers,
        activeSubscriptions,
        freeUsers,
        proUsers,
        premiumUsers,
        mrr,
        totalStorageGB: totalStorageBytes.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Admin subscriptions error:", error);
    req.flash("error", "Failed to load subscriptions");
    res.redirect("/admin");
  }
});

/**
 * POST /admin/subscriptions/:userId/change - Manually change a user's subscription
 */
router.post("/subscriptions/:userId/change", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { planId } = req.body;

    if (!planId) {
      req.flash("error", "Plan ID is required");
      return res.redirect("/admin/subscriptions");
    }

    const planIdInt = parseInt(planId);

    // Check if plan exists
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planIdInt },
    });

    if (!plan) {
      req.flash("error", "Invalid plan selected");
      return res.redirect("/admin/subscriptions");
    }

    // Check if user has a subscription
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      // Update existing subscription
      await prisma.userSubscription.update({
        where: { userId },
        data: {
          planId: planIdInt,
          status: "active",
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new subscription
      await prisma.userSubscription.create({
        data: {
          userId,
          planId: planIdInt,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          updatedAt: new Date(),
        },
      });
    }

    req.flash("success", `User subscription updated to ${plan.name} plan`);
    res.redirect("/admin/subscriptions");
  } catch (error) {
    console.error("Change subscription error:", error);
    req.flash("error", "Failed to change subscription");
    res.redirect("/admin/subscriptions");
  }
});

/**
 * POST /admin/subscriptions/:userId/cancel - Cancel a user's subscription
 */
router.post("/subscriptions/:userId/cancel", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const subscription = await prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      req.flash("error", "User has no active subscription");
      return res.redirect("/admin/subscriptions");
    }

    // Update subscription status to canceled
    await prisma.userSubscription.update({
      where: { userId },
      data: {
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    req.flash("success", "User subscription canceled");
    res.redirect("/admin/subscriptions");
  } catch (error) {
    console.error("Cancel subscription error:", error);
    req.flash("error", "Failed to cancel subscription");
    res.redirect("/admin/subscriptions");
  }
});

/**
 * GET /admin/subscription-plans - View and edit subscription plans
 */
router.get("/subscription-plans", async (req, res) => {
  try {
    // Get all subscription plans
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: "asc" },
    });

    // Calculate active users per plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const activeUsers = await prisma.userSubscription.count({
          where: {
            planId: plan.id,
            status: "active",
          },
        });

        return {
          ...plan,
          activeUsers,
          priceMonthlyDollars: plan.priceMonthly / 100,
          priceYearlyDollars: plan.priceYearly ? plan.priceYearly / 100 : null,
        };
      })
    );

    res.render("admin/subscription-plans", {
      title: "Manage Subscription Plans",
      user: req.user,
      plans: plansWithStats,
    });
  } catch (error) {
    console.error("Admin subscription plans error:", error);
    req.flash("error", "Failed to load subscription plans");
    res.redirect("/admin");
  }
});

/**
 * POST /admin/subscription-plans/:planId - Update a subscription plan
 */
router.post("/subscription-plans/:planId", async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const {
      name,
      slug,
      storageQuotaGB,
      bandwidthQuotaGB,
      maxBands,
      maxPublishedAlbums,
      priceMonthly,
      priceYearly,
      isActive,
      displayOrder,
    } = req.body;

    // Validate required fields
    if (!name || !slug || !storageQuotaGB || !priceMonthly) {
      req.flash(
        "error",
        "Name, slug, storage quota, and monthly price are required"
      );
      return res.redirect("/admin/subscription-plans");
    }

    // Convert prices from dollars to cents
    const priceMonthlyInt = Math.round(parseFloat(priceMonthly) * 100);
    const priceYearlyInt = priceYearly
      ? Math.round(parseFloat(priceYearly) * 100)
      : null;

    // Update the plan
    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name,
        slug,
        storageQuotaGB: parseInt(storageQuotaGB),
        bandwidthQuotaGB: parseInt(bandwidthQuotaGB || 0),
        maxBands: maxBands ? parseInt(maxBands) : null,
        maxPublishedAlbums: maxPublishedAlbums
          ? parseInt(maxPublishedAlbums)
          : null,
        priceMonthly: priceMonthlyInt,
        priceYearly: priceYearlyInt,
        isActive: isActive === "on",
        displayOrder: parseInt(displayOrder || 0),
        updatedAt: new Date(),
      },
    });

    req.flash("success", `Subscription plan "${name}" updated successfully`);
    res.redirect("/admin/subscription-plans");
  } catch (error) {
    console.error("Update subscription plan error:", error);
    req.flash("error", "Failed to update subscription plan");
    res.redirect("/admin/subscription-plans");
  }
});

/**
 * POST /admin/subscription-plans/:planId/features - Update plan features (JSON)
 */
router.post("/subscription-plans/:planId/features", async (req, res) => {
  try {
    const planId = parseInt(req.params.planId);
    const { features } = req.body;

    // Parse features if it's a string
    let featuresJson;
    try {
      featuresJson =
        typeof features === "string" ? JSON.parse(features) : features;
    } catch (e) {
      return res
        .status(400)
        .json({ error: "Invalid JSON format for features" });
    }

    await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        features: featuresJson,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: "Features updated successfully" });
  } catch (error) {
    console.error("Update plan features error:", error);
    res.status(500).json({ error: "Failed to update features" });
  }
});

/**
 * GET /admin/recordings/:id - View a specific recording (admin view)
 */
router.get("/recordings/:id", async (req, res) => {
  try {
    const recordingId = parseInt(req.params.id);

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        setlist: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        splits: {
          include: {
            song: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            startTime: "asc",
          },
        },
      },
    });

    if (!recording) {
      req.flash("error", "Recording not found");
      return res.redirect("/admin/recordings");
    }

    res.render("admin/recording-detail", {
      title: "Recording Details",
      marqueeTitle: "Admin Recording",
      recording,
      currentUser: req.session.user,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Admin recording detail error:", error);
    req.flash("error", "Failed to load recording details");
    res.redirect("/admin/recordings");
  }
});

/**
 * DELETE /admin/recordings/:id - Delete a recording and all associated files
 */
router.delete("/recordings/:id", async (req, res) => {
  try {
    const recordingId = parseInt(req.params.id);
    const userId = req.session?.user?.id || null;

    // Log the action
    logger.logFormSubmission(
      `/admin/recordings/${recordingId}`,
      "deleted",
      userId,
      { recordingId }
    );

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: {
        setlist: {
          include: {
            band: true,
          },
        },
        splits: true,
      },
    });

    if (!recording) {
      return res
        .status(404)
        .json({ success: false, error: "Recording not found" });
    }

    // Delete all split files
    for (const split of recording.splits) {
      if (split.filePath) {
        const splitPath = path.join(__dirname, "..", split.filePath);
        if (require("fs").existsSync(splitPath)) {
          require("fs").unlinkSync(splitPath);
        }
      }
    }

    // Delete source file
    if (recording.filePath) {
      const sourcePath = path.join(__dirname, "..", recording.filePath);
      if (require("fs").existsSync(sourcePath)) {
        require("fs").unlinkSync(sourcePath);
      }
    }

    // Delete waveform file if it exists
    if (recording.waveformPath) {
      const waveformPath = path.join(__dirname, "..", recording.waveformPath);
      if (require("fs").existsSync(waveformPath)) {
        require("fs").unlinkSync(waveformPath);
      }
    }

    // Get bandId before deleting recording
    const bandId = recording.setlist.band.id;

    // Delete the recording and all related records (cascade)
    await prisma.recording.delete({
      where: { id: recordingId },
    });

    // Recalculate band storage after recording deletion
    const { updateBandStorageUsage } = require("../utils/storageCalculator");
    try {
      await updateBandStorageUsage(bandId);
    } catch (storageError) {
      logger.logError(
        "Failed to recalculate band storage after admin recording deletion",
        storageError
      );
    }

    res.json({
      success: true,
      message: `Recording deleted successfully`,
    });
  } catch (error) {
    console.error("Delete recording error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete recording" });
  }
});

/**
 * DELETE /admin/recordings/splits/:id - Delete a specific recording split
 */
router.delete("/recordings/splits/:id", async (req, res) => {
  try {
    const splitId = parseInt(req.params.id);
    const userId = req.session?.user?.id || null;

    // Log the action
    logger.logFormSubmission(
      `/admin/recordings/splits/${splitId}`,
      "deleted",
      userId,
      { splitId }
    );

    const split = await prisma.recordingSplit.findUnique({
      where: { id: splitId },
      include: {
        recording: {
          include: {
            setlist: {
              include: {
                band: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        link: true,
      },
    });

    if (!split) {
      return res.status(404).json({ success: false, error: "Split not found" });
    }

    // Get bandId before deleting
    const bandId = split.recording.setlist.band.id;

    // Delete the link associated with this split if it exists
    if (split.linkId) {
      await prisma.link.delete({
        where: { id: split.linkId },
      });
    }

    // Delete the split audio file
    if (split.filePath) {
      const splitPath = path.join(__dirname, "..", split.filePath);
      if (require("fs").existsSync(splitPath)) {
        require("fs").unlinkSync(splitPath);
      }
    }

    // Delete the split record
    await prisma.recordingSplit.delete({
      where: { id: splitId },
    });

    // Recalculate band storage after split deletion
    const { updateBandStorageUsage } = require("../utils/storageCalculator");
    try {
      await updateBandStorageUsage(bandId);
    } catch (storageError) {
      logger.logError(
        "Failed to recalculate band storage after admin split deletion",
        storageError
      );
    }

    res.json({
      success: true,
      message: `Split deleted successfully`,
    });
  } catch (error) {
    console.error("Delete split error:", error);
    res.status(500).json({ success: false, error: "Failed to delete split" });
  }
});

/**
 * GET /admin/recordings - Manage all recordings across all bands
 */
router.get("/recordings", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    // Build search conditions
    const searchConditions = search
      ? {
          OR: [
            { filePath: { contains: search, mode: "insensitive" } },
            {
              setlist: {
                title: { contains: search, mode: "insensitive" },
              },
            },
            {
              setlist: {
                band: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : {};

    // Get total count for pagination
    const totalRecordings = await prisma.recording.count({
      where: searchConditions,
    });

    // Get recordings with pagination
    const recordings = await prisma.recording.findMany({
      where: searchConditions,
      include: {
        setlist: {
          include: {
            band: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        _count: {
          select: {
            splits: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: skip,
      take: limit,
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalRecordings / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Calculate global storage statistics
    const { formatBytes } = require("../utils/storageCalculator");
    const bands = await prisma.band.findMany({
      select: { storageUsedBytes: true },
    });

    let totalStorageBytes = BigInt(0);
    let bandsWithStorage = 0;
    bands.forEach((band) => {
      if (band.storageUsedBytes) {
        totalStorageBytes += BigInt(band.storageUsedBytes);
        bandsWithStorage++;
      }
    });

    const totalStorageGB = Number(totalStorageBytes) / 1024 ** 3;
    const avgStoragePerBand =
      bandsWithStorage > 0
        ? Number(totalStorageBytes) / bandsWithStorage / 1024 ** 3
        : 0;

    // Count total recordings and their total size
    const allRecordings = await prisma.recording.findMany({
      where: { filePath: { not: "" }, fileSize: { not: null } },
      select: { fileSize: true, isProcessed: true },
    });

    let totalRecordingBytes = BigInt(0);
    let processedRecordings = 0;
    allRecordings.forEach((r) => {
      totalRecordingBytes += BigInt(r.fileSize || 0);
      if (r.isProcessed) processedRecordings++;
    });
    const totalRecordingGB = Number(totalRecordingBytes) / 1024 ** 3;

    // Get split statistics
    const totalSplits = await prisma.recordingSplit.count({
      where: { filePath: { not: "" } },
    });

    const splits = await prisma.recordingSplit.findMany({
      where: { filePath: { not: "" } },
      select: {
        filePath: true,
        recording: {
          select: {
            setlist: {
              select: {
                bandId: true,
              },
            },
          },
        },
      },
    });

    // Count unique bands that have splits
    const bandsWithSplits = new Set(
      splits.map((s) => s.recording.setlist.bandId)
    ).size;

    // Calculate average splits per processed recording
    const avgSplitsPerRecording =
      processedRecordings > 0
        ? (totalSplits / processedRecordings).toFixed(1)
        : 0;

    // Calculate percentage of recordings that are processed
    const processedPercentage =
      allRecordings.length > 0
        ? ((processedRecordings / allRecordings.length) * 100).toFixed(1)
        : 0;

    // Calculate total split file sizes from filesystem
    const fs = require("fs");
    const path = require("path");
    let totalSplitBytes = BigInt(0);
    let splitsWithFiles = 0;
    let splitsMissingFiles = 0;

    for (const split of splits) {
      if (split.filePath && split.filePath.startsWith("/uploads/")) {
        try {
          // Try public/uploads first (for recordings), then uploads directly (for splits)
          let filePath = path.join(process.cwd(), "public", split.filePath);
          if (!fs.existsSync(filePath)) {
            // Split files are stored in uploads/ directly, not public/uploads/
            filePath = path.join(process.cwd(), split.filePath.substring(1)); // Remove leading /
          }
          const stats = fs.statSync(filePath);
          totalSplitBytes += BigInt(stats.size);
          splitsWithFiles++;
        } catch (err) {
          // File doesn't exist (likely on different server or deleted)
          splitsMissingFiles++;
        }
      }
    }

    const totalSplitGB = Number(totalSplitBytes) / 1024 ** 3;
    const avgSplitSize =
      splitsWithFiles > 0 ? Number(totalSplitBytes) / splitsWithFiles : 0;
    const avgSplitSizeMB = avgSplitSize / (1024 * 1024);

    res.render("admin/recordings", {
      title: "Recordings Management",
      marqueeTitle: "Admin Recordings",
      recordings,
      totalRecordings,
      currentPage: page,
      totalPages,
      hasNextPage,
      hasPrevPage,
      search,
      currentUser: req.session.user,
      globalStats: {
        totalBands: bands.length,
        bandsWithStorage,
        totalStorageBytes,
        totalStorageGB: parseFloat(totalStorageGB.toFixed(2)),
        avgStoragePerBand: parseFloat(avgStoragePerBand.toFixed(2)),
        totalRecordingGB: parseFloat(totalRecordingGB.toFixed(2)),
        totalRecordings: allRecordings.length,
        processedRecordings,
        processedPercentage: parseFloat(processedPercentage),
        totalSplits,
        splitsWithFiles,
        splitsMissingFiles,
        bandsWithSplits,
        avgSplitsPerRecording: parseFloat(avgSplitsPerRecording),
        totalSplitBytes,
        totalSplitGB: parseFloat(totalSplitGB.toFixed(2)),
        avgSplitSizeMB: parseFloat(avgSplitSizeMB.toFixed(1)),
        formatBytes,
      },
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Admin recordings error:", error);
    req.flash("error", "Failed to load recordings management");
    res.redirect("/admin");
  }
});

module.exports = router;
