const { prisma } = require("../lib/prisma");

const plans = [
  {
    name: "Free",
    slug: "free",
    storageQuotaGB: 8,
    bandwidthQuotaGB: 100,
    maxBands: 3,
    maxPublishedAlbums: 3,
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "Up to 3 bands maximum",
      "8 GB storage shared across all your bands",
      "Up to 3 published albums per band",
      "Unlimited recordings & setlists",
      "Basic public band pages (/bands/123)",
      "All songs visible to all band members",
      "Shared public venue database",
      "Community support",
      "100 GB bandwidth/month",
    ],
    displayOrder: 1,
  },
  {
    name: "Pro",
    slug: "pro",
    storageQuotaGB: 20,
    bandwidthQuotaGB: 500,
    maxBands: null, // Unlimited bands
    maxPublishedAlbums: null,
    priceMonthly: 1000, // $10.00
    priceYearly: 10000, // $100.00 (17% discount)
    features: [
      "Unlimited bands",
      "20 GB storage across all your bands (stacks with other Pro members!)",
      "Unlimited published albums per band",
      "🎯 Custom URLs (/your-band-name, SEO-friendly)",
      "🔒 Private songs (hide unreleased material)",
      "🔒 Private venues (band-specific venue database)",
      "Advanced analytics (plays, downloads)",
      "Custom domain for band page (future)",
      "Priority processing",
      "Remove branding",
      "Email support (48hr)",
      "500 GB bandwidth/month",
    ],
    displayOrder: 2,
  },
  {
    name: "Premium",
    slug: "premium",
    storageQuotaGB: 100,
    bandwidthQuotaGB: 2000,
    maxBands: null, // Unlimited bands
    maxPublishedAlbums: null,
    priceMonthly: 2500, // $25.00
    priceYearly: 25000, // $250.00 (17% discount)
    features: [
      "Unlimited bands",
      "100 GB storage across all your bands (stacks with other members!)",
      "Everything in Pro",
      "White-label option",
      "API access",
      "Advanced booking tools",
      "Priority support (24hr)",
      "2 TB bandwidth/month",
    ],
    displayOrder: 3,
  },
];

async function seedPlans() {
  console.log("Seeding subscription plans...");

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug: plan.slug },
    });

    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { slug: plan.slug },
        data: plan,
      });
      console.log(`✓ Updated ${plan.name} plan`);
    } else {
      await prisma.subscriptionPlan.create({
        data: plan,
      });
      console.log(`✓ Created ${plan.name} plan`);
    }
  }

  console.log("\nSubscription plans seeded successfully!");
}

seedPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding plans:", err);
    process.exit(1);
  });

