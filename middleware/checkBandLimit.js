const { prisma } = require("../lib/prisma");

/**
 * Middleware to check if user can create more bands based on their subscription
 */
async function checkBandLimit(req, res, next) {
  try {
    const userId = req.session.user.id;

    // Get user's subscription
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        bands: true, // Count of bands user is owner/member of
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Get current band count where user is creator/owner
    const bandCount = await prisma.band.count({
      where: { createdById: userId },
    });

    // Get plan limits
    const plan = user.subscription?.plan;
    const maxBands = plan?.maxBands;

    // If maxBands is null, unlimited
    if (maxBands === null || maxBands === undefined) {
      return next();
    }

    // Check if at limit
    if (bandCount >= maxBands) {
      req.flash(
        "error",
        `You've reached your limit of ${maxBands} bands on the ${
          plan?.name || "Free"
        } plan. Upgrade to create more bands.`
      );
      return res.redirect("/pricing");
    }

    next();
  } catch (error) {
    console.error("Check band limit error:", error);
    next(error);
  }
}

module.exports = {
  checkBandLimit,
};

