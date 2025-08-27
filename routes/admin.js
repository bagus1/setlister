const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { requireAuth } = require("./auth");

// Middleware to check if user is admin (you can customize this logic)
const requireAdmin = (req, res, next) => {
  // For now, let's assume any authenticated user can access this
  // You can add more specific admin logic later
  if (!req.session.user) {
    req.flash("error", "You must be logged in to access this page");
    return res.redirect("/auth/login");
  }
  next();
};

// GET /admin/whitelist-requests - View all whitelist requests
router.get("/whitelist-requests", requireAdmin, async (req, res) => {
  try {
    const requests = await prisma.whitelistRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.render("admin/whitelist-requests", {
      title: "Manage Whitelist Requests",
      requests,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    console.error("Error fetching whitelist requests:", error);
    req.flash("error", "Error loading whitelist requests");
    res.redirect("/");
  }
});

// POST /admin/whitelist-requests/:id/approve - Approve a whitelist request
router.post("/whitelist-requests/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await prisma.whitelistRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: "approved",
        updatedAt: new Date(),
      },
    });

    // TODO: Send email notification to user that their request was approved
    console.log(`Whitelist request ${id} approved`);

    req.flash("success", "Whitelist request approved successfully");
    res.redirect("/admin/whitelist-requests");
  } catch (error) {
    console.error("Error approving whitelist request:", error);
    req.flash("error", "Error approving whitelist request");
    res.redirect("/admin/whitelist-requests");
  }
});

// POST /admin/whitelist-requests/:id/reject - Reject a whitelist request
router.post("/whitelist-requests/:id/reject", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await prisma.whitelistRequest.update({
      where: { id: parseInt(id) },
      data: {
        status: "rejected",
        updatedAt: new Date(),
      },
    });

    // TODO: Send email notification to user that their request was rejected
    console.log(`Whitelist request ${id} rejected`);

    req.flash("success", "Whitelist request rejected successfully");
    res.redirect("/admin/whitelist-requests");
  } catch (error) {
    console.error("Error rejecting whitelist request:", error);
    req.flash("error", "Error rejecting whitelist request");
    res.redirect("/admin/whitelist-requests");
  }
});

module.exports = router;
