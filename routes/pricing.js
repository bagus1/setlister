const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");

/**
 * GET /pricing - Public pricing page
 */
router.get("/", async (req, res) => {
  try {
    // Get all active subscription plans
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    // Format plans for display
    const formattedPlans = plans.map(plan => ({
      ...plan,
      priceMonthlyDollars: plan.priceMonthly / 100,
      priceYearlyDollars: plan.priceYearly ? plan.priceYearly / 100 : null,
      yearlyMonthlyEquivalent: plan.priceYearly ? (plan.priceYearly / 12 / 100) : null,
      yearlySavings: plan.priceYearly 
        ? Math.round(((plan.priceMonthly * 12 - plan.priceYearly) / plan.priceYearly) * 100)
        : null,
    }));

    // Get user's current subscription if logged in
    let currentPlan = null;
    if (req.session && req.session.user) {
      const subscription = await prisma.userSubscription.findUnique({
        where: { userId: req.session.user.id },
        include: { plan: true },
      });
      
      if (subscription && subscription.status === 'active') {
        currentPlan = subscription.plan.slug;
      }
    }

    res.render("pricing/index", {
      title: "Pricing - The Band Plan",
      plans: formattedPlans,
      currentPlan,
      user: req.session?.user || null,
    });
  } catch (error) {
    console.error("Pricing page error:", error);
    res.status(500).render("error", {
      title: "Error",
      user: req.session?.user || null,
      message: "Failed to load pricing information",
    });
  }
});

module.exports = router;

