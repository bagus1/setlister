const express = require("express");
const router = express.Router();
const { requireAuth } = require("./auth");
const { requireRole } = require("../middleware/rbac");
const { prisma } = require("../lib/prisma");

// Apply auth middleware to all admin routes
router.use(requireAuth);
router.use(requireRole("moderator")); // Allow both moderators and admins

/**
 * GET /admin - Moderator Dashboard
 */
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
    ] = await Promise.all([
      prisma.user.count(),
      prisma.venue.count(),
      prisma.band.count(),
      prisma.venueChange.count({ where: { status: "pending" } }),
      prisma.song.count(),
      prisma.setlist.count(),
      prisma.gigDocument.count(),
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
      user: req.session.user,
      stats: {
        totalUsers,
        totalVenues,
        totalBands,
        pendingChanges,
        totalSongs,
        totalSetlists,
        totalDocuments,
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
 * GET /admin/content - Content Moderation
 */
router.get("/content", async (req, res) => {
  try {
    // Get content stats
    const [totalSongs, totalBands, totalSetlists, totalDocuments] =
      await Promise.all([
        prisma.song.count(),
        prisma.band.count(),
        prisma.setlist.count(),
        prisma.gigDocument.count(),
      ]);

    // Get recent content (last 20 of each type)
    const [songs, bands, setlists, documents] = await Promise.all([
      prisma.song.findMany({
        include: {
          artists: {
            include: { artist: true },
          },
          createdBy: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.band.findMany({
        include: {
          members: true,
          createdBy: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.setlist.findMany({
        include: {
          band: true,
          setlistSongs: true,
          createdBy: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.gigDocument.findMany({
        include: {
          song: {
            include: {
              artists: {
                include: { artist: true },
              },
            },
          },
          createdBy: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    res.render("admin/content", {
      title: "Content Moderation",
      stats: {
        totalSongs,
        totalBands,
        totalSetlists,
        totalDocuments,
      },
      songs,
      bands,
      setlists,
      documents,
      currentUser: req.session.user,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Content moderation error:", error);
    req.flash("error", "Failed to load content");
    res.redirect("/admin");
  }
});

module.exports = router;
