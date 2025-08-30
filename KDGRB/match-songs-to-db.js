const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();
const songsDir = "./songs";

async function matchSongsToDatabase() {
  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Connected successfully!\n");

    // Get all song files
    const songFiles = fs
      .readdirSync(songsDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    console.log(`Found ${songFiles.length} song files to process\n`);

    const results = [];

    for (const filename of songFiles) {
      // Extract song title from filename
      const titleMatch = filename.match(/song-\d+-(.+)\.html/);
      if (!titleMatch) {
        console.log(`Could not parse title from filename: ${filename}`);
        continue;
      }

      const songTitle = titleMatch[1].replace(/-/g, " ").replace(/_/g, " ");

      // Query database for songs with similar titles
      const songs = await prisma.song.findMany({
        where: {
          title: {
            contains: songTitle,
            mode: "insensitive", // Case-insensitive search
          },
        },
        select: {
          id: true,
          title: true,
          key: true,
          time: true,
          bpm: true,
        },
      });

      // Also try exact match
      const exactMatch = await prisma.song.findFirst({
        where: {
          title: songTitle,
        },
        select: {
          id: true,
          title: true,
          key: true,
          time: true,
          bpm: true,
        },
      });

      const result = {
        filename,
        extractedTitle: songTitle,
        exactMatch: exactMatch
          ? {
              id: exactMatch.id,
              title: exactMatch.title,
              key: exactMatch.key,
              time: exactMatch.time,
              bpm: exactMatch.bpm,
            }
          : null,
        similarMatches: songs.length > 0 ? songs : [],
      };

      results.push(result);

      // Display results
      console.log(`File: ${filename}`);
      console.log(`  Extracted Title: "${songTitle}"`);

      if (exactMatch) {
        console.log(
          `  ✅ EXACT MATCH: ID ${exactMatch.id} - "${exactMatch.title}"`
        );
        if (exactMatch.key) console.log(`    Key: ${exactMatch.key}`);
        if (exactMatch.time) console.log(`    Time: ${exactMatch.time}`);
        if (exactMatch.bpm) console.log(`    BPM: ${exactMatch.bpm}`);
      } else if (songs.length > 0) {
        console.log(`  🔍 SIMILAR MATCHES (${songs.length}):`);
        songs.forEach((song) => {
          console.log(`    ID ${song.id}: "${song.title}"`);
          if (song.key) console.log(`      Key: ${song.key}`);
          if (song.time) console.log(`      Time: ${song.time}`);
          if (song.bpm) console.log(`      BPM: ${song.bpm}`);
        });
      } else {
        console.log(`  ❌ NO MATCHES FOUND`);
      }
      console.log("");
    }

    // Summary
    const exactMatches = results.filter((r) => r.exactMatch).length;
    const similarMatches = results.filter(
      (r) => r.similarMatches.length > 0 && !r.exactMatch
    ).length;
    const noMatches = results.filter(
      (r) => !r.exactMatch && r.similarMatches.length === 0
    ).length;

    console.log("=== SUMMARY ===");
    console.log(`Total files processed: ${results.length}`);
    console.log(`Exact matches: ${exactMatches}`);
    console.log(`Similar matches only: ${similarMatches}`);
    console.log(`No matches: ${noMatches}`);

    // Save detailed results to JSON file
    const outputFile = "./song-database-matches.json";
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results saved to: ${outputFile}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\nDatabase connection closed.");
  }
}

// Run the script
matchSongsToDatabase().catch(console.error);
