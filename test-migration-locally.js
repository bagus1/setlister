#!/usr/bin/env node

/**
 * Test Migration Locally
 *
 * This script tests the PostgreSQL migration locally to ensure everything works
 * before running on staging/production.
 */

const { sequelize, User, Band, Song } = require("./models/index.js");

async function testMigration() {
  console.log("🧪 Testing PostgreSQL migration locally...\n");

  try {
    // Test 1: Database connection
    console.log("1️⃣ Testing database connection...");
    await sequelize.authenticate();
    console.log("   ✅ Database connection successful\n");

    // Test 2: Schema sync
    console.log("2️⃣ Testing schema sync...");
    await sequelize.sync({ force: true });
    console.log("   ✅ Schema sync successful\n");

    // Test 3: Basic model operations
    console.log("3️⃣ Testing basic model operations...");

    // Test User model
    const testUser = await User.create({
      username: "test_user",
      email: "test@example.com",
      password: "test_hash",
    });
    console.log("   ✅ User creation successful");

    // Test Band model
    const testBand = await Band.create({
      name: "Test Band",
      description: "Test band for migration testing",
      createdById: testUser.id,
    });
    console.log("   ✅ Band creation successful");

    // Test Song model
    const testSong = await Song.create({
      title: "Test Song",
      key: "C",
      tempo: 120,
    });
    console.log("   ✅ Song creation successful");

    // Test associations
    await testBand.addSong(testSong);
    console.log("   ✅ Association test successful");

    // Test queries
    const bands = await Band.findAll({
      include: ["Songs"],
    });
    console.log(`   ✅ Query test successful - found ${bands.length} bands`);

    // Cleanup test data (in correct order due to foreign keys)
    await testBand.destroy();
    await testSong.destroy();
    await testUser.destroy();
    console.log("   ✅ Cleanup successful\n");

    // Test 4: Import verification
    console.log("4️⃣ Testing data import capability...");
    const fs = require("fs");
    const path = require("path");

    if (fs.existsSync("migration-output")) {
      const files = fs
        .readdirSync("migration-output")
        .filter((f) => f.endsWith(".sql"));
      console.log(`   ✅ Found ${files.length} migration files`);

      // Check if key tables have data
      const usersFile = path.join("migration-output", "users.sql");
      if (fs.existsSync(usersFile)) {
        const content = fs.readFileSync(usersFile, "utf8");
        const lines = content
          .split("\n")
          .filter((line) => line.trim().startsWith("INSERT"));
        console.log(
          `   ✅ Users migration file has ${lines.length} INSERT statements`
        );
      }
    } else {
      console.log(
        "   ⚠️  No migration-output directory found - run migrate-sqlite-to-postgres.js first"
      );
    }

    console.log("\n🎉 All tests passed! Your PostgreSQL migration is ready.");
    console.log("\n📋 Next steps:");
    console.log(
      "   1. Test on staging server using: ./deploy-staging-postgres.sh"
    );
    console.log("   2. Verify everything works on staging");
    console.log("   3. When ready, use: ./deploy-production-postgres.sh");
  } catch (error) {
    console.error("\n❌ Migration test failed:", error.message);
    console.error(
      "\n🔍 Check the error above and fix any issues before proceeding."
    );
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the test
testMigration().catch(console.error);
