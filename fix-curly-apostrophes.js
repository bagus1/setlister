const { PrismaClient } = require("./generated/prisma");

const prisma = new PrismaClient();

async function fixCurlyApostrophes() {
  try {
    console.log("Connecting to PostgreSQL database...");
    await prisma.$connect();
    console.log("Connected successfully!");

    // Find all songs with curly apostrophes (Unicode U+2019, char code 8217)
    console.log("\nFinding songs with curly apostrophes...");
    const songsWithCurlyApostrophes = await prisma.song.findMany({
      where: {
        title: {
          contains: String.fromCharCode(8217), // curly apostrophe U+2019
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    console.log(
      `Found ${songsWithCurlyApostrophes.length} songs with curly apostrophes:`
    );
    songsWithCurlyApostrophes.forEach((song) => {
      console.log(`  ID ${song.id}: "${song.title}"`);
    });

    if (songsWithCurlyApostrophes.length === 0) {
      console.log("No songs with curly apostrophes found. Database is clean!");
      return;
    }

    // Update each song to replace curly apostrophes with straight ones
    console.log("\nUpdating songs to replace curly apostrophes...");
    let updatedCount = 0;

    for (const song of songsWithCurlyApostrophes) {
      // Replace curly apostrophe (U+2019) with straight apostrophe (U+0027)
      const newTitle = song.title.replace(/\u2019/g, "'");

      if (newTitle !== song.title) {
        await prisma.song.update({
          where: { id: song.id },
          data: { title: newTitle },
        });

        console.log(`  Updated ID ${song.id}: "${song.title}" → "${newTitle}"`);
        updatedCount++;
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} songs!`);

    // Verify the fix
    console.log("\nVerifying fix...");
    const remainingCurlyApostrophes = await prisma.song.findMany({
      where: {
        title: {
          contains: String.fromCharCode(8217), // curly apostrophe U+2019
        },
      },
    });

    if (remainingCurlyApostrophes.length === 0) {
      console.log("✅ All curly apostrophes have been fixed!");
    } else {
      console.log(
        `❌ Still found ${remainingCurlyApostrophes.length} songs with curly apostrophes`
      );
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\nDatabase connection closed.");
  }
}

// Run the script
fixCurlyApostrophes().catch(console.error);
