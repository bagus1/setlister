#!/usr/bin/env node

const { PrismaClient } = require("../generated/prisma");

async function testProductionPrisma() {
  let prisma;

  try {
    console.log("🔄 Creating production Prisma client...");

    // Create production Prisma client
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://bagus1_setlists_app:allofmyfriends@192.250.227.26:5432/bagus1_setlists_prod",
        },
      },
    });

    console.log("✅ Production Prisma client created");
    console.log("🔄 Connecting to production database...");

    await prisma.$connect();
    console.log("✅ Connected to production database successfully!");

    console.log("🔄 Running simple SELECT count query...");

    // Simple count query to test the connection
    const result =
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM gig_documents`;

    console.log("✅ Query executed successfully!");
    console.log("📊 Result:", result);

    console.log("🔄 Disconnecting...");
    await prisma.$disconnect();
    console.log("✅ Disconnected successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Full error:", error);

    if (prisma) {
      try {
        await prisma.$disconnect();
        console.log("✅ Disconnected after error");
      } catch (disconnectError) {
        console.error("❌ Error disconnecting:", disconnectError.message);
      }
    }
  }
}

// Run the test
console.log("🧪 Testing Production Prisma Connection");
console.log("=====================================");
testProductionPrisma();
