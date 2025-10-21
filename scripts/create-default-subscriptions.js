const { prisma } = require("../lib/prisma");

async function createDefaultSubscriptions() {
  console.log("Creating default subscriptions for all bands...");

  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "free" },
  });

  if (!freePlan) {
    console.error("Free plan not found! Run seed-subscription-plans.js first.");
    process.exit(1);
  }

  const bands = await prisma.band.findMany({
    select: { id: true, name: true },
  });

  console.log(`Found ${bands.length} bands`);

  let created = 0;
  let skipped = 0;

  for (const band of bands) {
    const exists = await prisma.bandSubscription.findUnique({
      where: { bandId: band.id },
    });

    if (!exists) {
      await prisma.bandSubscription.create({
        data: {
          bandId: band.id,
          planId: freePlan.id,
          status: "active",
          storageUsedBytes: 0,
        },
      });
      console.log(`✓ Created free subscription for: ${band.name}`);
      created++;
    } else {
      console.log(`- Skipped (already exists): ${band.name}`);
      skipped++;
    }
  }

  console.log(`\n✅ Done! Created ${created}, skipped ${skipped}`);
}

createDefaultSubscriptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

