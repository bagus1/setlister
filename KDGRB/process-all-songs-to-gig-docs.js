#!/usr/bin/env node

const { PrismaClient } = require("../generated/prisma");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
const dotenv = require("dotenv");

let prisma = new PrismaClient();

// Function to execute SQL command on production via SSH
async function executeProductionSQL(sqlCommand, description) {
  try {
    console.log(`🔄 ${description}...`);

    const sshCommand = `ssh bagus1@bagus.org "cd ~/repositories/setlister && PGPASSWORD=allofmyfriends psql -h localhost -U bagus1_setlists_app -d bagus1_setlists_prod -c '${sqlCommand.replace(/'/g, "''")}'"`;

    const result = execSync(sshCommand, { encoding: "utf8" });

    console.log(`✅ ${description} completed`);
    return result;
  } catch (error) {
    console.error(`❌ Error ${description}:`, error.message);
    throw error;
  }
}

// Function to execute SQL command locally via psql
async function executeLocalSQL(sqlCommand, description) {
  try {
    console.log(`🔄 ${description}...`);

    // Get database info from .env
    dotenv.config();

    const dbHost = process.env.DB_HOST || "localhost";
    const dbUser = process.env.DB_USER || "bagus1_setlists_app";
    const dbPassword = process.env.DB_PASSWORD || "allofmyfriends";
    const dbName = process.env.DB_NAME || "bagus1_setlists_prod";

    const psqlCommand = `PGPASSWORD='${dbPassword}' psql -h ${dbHost} -U ${dbUser} -d ${dbName} -c '${sqlCommand.replace(/'/g, "''")}'`;

    const result = execSync(psqlCommand, { encoding: "utf8" });

    console.log(`✅ ${description} completed`);
    return result;
  } catch (error) {
    console.error(`❌ Error ${description}:`, error.message);
    throw error;
  }
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to get user input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function showInteractiveMenu() {
  console.log(`
🎵 Song Processing Menu
=======================

1. Process ALL songs (full: gig docs + links) - Choose Environment
2. Process by Database ID
3. Process by Song Title
4. Process by Filename
5. Process with Start/End Range
6. Match only (no gig docs/links)
7. Exit

Choose an option (1-7): `);

  const choice = await askQuestion("");

  switch (choice) {
    case "1":
      await processAllSongsToGigDocs({ all: true });
      break;
    case "2":
      await processByDatabaseId();
      break;
    case "3":
      await processBySongTitle();
      break;
    case "4":
      await processByFilename();
      break;
    case "5":
      await processWithRange();
      break;
    case "6":
      await processAllSongsToGigDocs({ matchOnly: true });
      break;
    case "7":
      console.log("👋 Goodbye!");
      rl.close();
      process.exit(0);
      break;
    case "10":
      // Hidden option: Prisma mode for testing
      await processAllSongsToGigDocs({ all: true, usePrisma: true });
      break;
    default:
      console.log("❌ Invalid choice. Please try again.");
      await showInteractiveMenu();
      break;
  }
}

async function processAllSongsToGigDocs(options = {}) {
  try {
    if (options.usePrisma) {
      // Hidden Prisma mode for testing
      console.log("🔧 PRISMA MODE: Using Prisma client (for testing)");
      console.log("Connecting to database...");
      await prisma.$connect();
      console.log("Connected successfully!");
    } else if (options.all && !options.matchOnly) {
      // Mode 1: Ask for environment choice
      console.log("🌍 Choose environment for processing:");
      console.log("1. Local database");
      console.log("2. Production database");

      const envChoice = await askQuestion("Enter choice (1 or 2): ");

      if (envChoice === "1") {
        console.log("🏠 LOCAL MODE: Using direct SQL execution");
        options.localSql = true;
      } else if (envChoice === "2") {
        console.log("🌐 PRODUCTION MODE: Using SSH + direct SQL execution");
        console.log(
          "⚠️  WARNING: This will create/update gig documents and links on the live system!"
        );
        const confirm = await askQuestion("Type 'PRODUCTION' to confirm: ");
        if (confirm !== "PRODUCTION") {
          console.log("❌ Production mode cancelled. Returning to menu.");
          return;
        }
        console.log("✅ Production mode confirmed. Proceeding...");
        options.production = true;
      } else {
        console.log("❌ Invalid environment choice. Returning to menu.");
        return;
      }
    } else {
      // Other modes: Use Prisma
      console.log("Connecting to database...");
      await prisma.$connect();
      console.log("Connected successfully!");
    }

    // Read the songs directory
    const songsDir = path.join(__dirname, "songs");
    let songFiles =
      options.customFiles ||
      fs
        .readdirSync(songsDir)
        .filter((file) => file.endsWith(".html"))
        .sort();

    console.log(`Found ${songFiles.length} song HTML files to process`);
    if (options.production) {
      console.log("🌐 Processing on PRODUCTION database");
    }

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const filename of songFiles) {
      console.log(`\n--- Processing ${filename} ---`);

      try {
        // Extract title from filename (using the logic from match-songs-to-db.js)
        const extractedTitle = extractTitleFromFilename(filename);
        if (!extractedTitle) {
          console.log(`  ❌ Skipping: Could not extract title from filename`);
          skippedCount++;
          continue;
        }

        console.log(`  Extracted title: "${extractedTitle}"`);

        // Find song in database (using the logic from match-songs-to-db.js)
        const song = await findSongInDatabase(extractedTitle);
        if (!song) {
          console.log(`  ❌ Skipping: No database match found`);
          skippedCount++;
          continue;
        }

        console.log(
          `  ✅ Database match: ID ${song.song.id} - "${song.song.title}"`
        );

        // Process the song file to create gig document and links
        const songToProcess = options.songId ? song : song.song;

        if (options.matchOnly) {
          // Just collect matching info for HTML report
          console.log(
            `  ✅ Match found: ${songToProcess.title} (ID: ${songToProcess.id})`
          );
          processedCount++;
        } else if (options.all) {
          // Full processing: gig documents and links
          const result = await processSongFile(
            filename,
            {
              song: songToProcess,
              matchType: "PROCESSING",
            },
            options
          );
          if (result.success) {
            console.log(`  ✅ Successfully processed: ${result.message}`);
            processedCount++;
          } else {
            console.log(`  ❌ Error processing: ${result.message}`);
            errorCount++;
          }
        } else {
          // Default: just matching (same as match-only)
          console.log(
            `  ✅ Match found: ${songToProcess.title} (ID: ${songToProcess.id})`
          );
          processedCount++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n=== PROCESSING COMPLETE ===`);
    if (options.production) {
      console.log(`🌐 PRODUCTION DATABASE`);
    }
    console.log(`✅ Successfully processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total files: ${songFiles.length}`);

    // Generate HTML report if in match-only mode or default mode (not --all)
    if (options.matchOnly || !options.all) {
      console.log(`\n📊 Generating HTML report...`);
      await generateHTMLReport(
        songFiles,
        processedCount,
        skippedCount,
        errorCount
      );
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\nDatabase connection closed.");

    // Exit if this was a non-interactive mode (match only, range processing, or full batch processing)
    if (options.matchOnly || options.customFiles || options.all) {
      console.log("✅ Processing complete. Exiting...");
      process.exit(0);
    }
  }
}

function extractTitleFromFilename(filename) {
  // Remove .html extension
  let title = filename.replace(/\.html$/, "");

  // Remove song number prefix (e.g., "song-094-")
  title = title.replace(/^song-\d+-/, "");

  // Handle special cases
  if (title === "Untitled" || title === "untitled") {
    return null;
  }

  return title;
}

async function findSongInDatabase(extractedTitle) {
  // First try exact match
  let song = await prisma.song.findFirst({
    where: {
      title: { equals: extractedTitle, mode: "insensitive" },
    },
  });

  if (song) {
    return { song, matchType: "EXACT" };
  }

  // Try similar match (contains)
  song = await prisma.song.findFirst({
    where: {
      title: { contains: extractedTitle, mode: "insensitive" },
    },
  });

  if (song) {
    return { song, matchType: "SIMILAR" };
  }

  // Try reverse contains (extracted title contains database title)
  song = await prisma.song.findFirst({
    where: {
      title: { mode: "insensitive" },
    },
  });

  if (song && extractedTitle.toLowerCase().includes(song.title.toLowerCase())) {
    return { song, matchType: "REVERSE_CONTAINS" };
  }

  return null;
}

async function processSongFile(filename, songInfo, options = {}) {
  try {
    const { song, matchType } = songInfo;

    // Read the song file content
    const songFilePath = path.join(__dirname, "songs", filename);
    const songContent = fs.readFileSync(songFilePath, "utf8");

    // Extract URLs and process content
    const { content, urls } = generateChordContent(songContent);

    if (options.production) {
      // Production mode: Generate and execute SQL commands via SSH
      console.log(`    Creating new gig document on PRODUCTION`);

      // Escape content for SQL
      const escapedContent = content.replace(/'/g, "''");
      const now = new Date().toISOString();

      // Create gig document SQL
      const gigDocSQL = `INSERT INTO gig_documents (song_id, created_by_id, type, version, content, is_active, created_at, updated_at) VALUES (${song.id}, 1, 'chords', 1, '${escapedContent}', true, '${now}', '${now}') RETURNING id;`;

      // Execute gig document creation
      const gigDocResult = await executeProductionSQL(
        gigDocSQL,
        "Creating gig document"
      );

      // Extract gig document ID from result
      const gigDocIdMatch = gigDocResult.match(/id\s*\n\s*(\d+)/);
      const gigDocId = gigDocIdMatch ? gigDocIdMatch[1] : "unknown";

      // Process URLs and create links
      let linksCreated = 0;
      if (urls.length > 0) {
        console.log(
          `    Found ${urls.length} URLs, processing links on PRODUCTION...`
        );

        for (const urlInfo of urls) {
          // Skip font resources and other non-music links
          if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
            continue;
          }

          // Map link types to database enum values
          const dbLinkType = mapLinkType(urlInfo.type);

          try {
            // Check if link already exists
            const checkLinkSQL = `SELECT id FROM links WHERE song_id = ${song.id} AND url = '${urlInfo.url.replace(/'/g, "''")}';`;
            const existingLinkResult = await executeProductionSQL(
              checkLinkSQL,
              "Checking existing link"
            );

            if (!existingLinkResult.includes("(0 rows)")) {
              // Create new link
              const linkSQL = `INSERT INTO links (song_id, type, description, url, created_at, updated_at) VALUES (${song.id}, '${dbLinkType}', '${(urlInfo.description || urlInfo.url).replace(/'/g, "''")}', '${urlInfo.url.replace(/'/g, "''")}', '${now}', '${now}');`;
              await executeProductionSQL(linkSQL, "Creating link");
              linksCreated++;
            }
          } catch (error) {
            console.error(`      Error creating link: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        message: `PRODUCTION: Gig document ${gigDocId} (${matchType}), ${linksCreated} new links created`,
      };
    } else if (options.localSql || options.production) {
      // Direct SQL mode: Generate and execute SQL commands (local or production)
      const envLabel = options.localSql ? "LOCAL" : "PRODUCTION";
      const executeSQL = options.localSql
        ? executeLocalSQL
        : executeProductionSQL;

      console.log(
        `    Creating new gig document using DIRECT SQL (${envLabel})`
      );

      // Escape content for SQL
      const escapedContent = content.replace(/'/g, "''");
      const now = new Date().toISOString();

      // Create gig document SQL
      const gigDocSQL = `INSERT INTO gig_documents (song_id, created_by_id, type, version, content, is_active, created_at, updated_at) VALUES (${song.id}, 1, 'chords', 1, '${escapedContent}', true, '${now}', '${now}') RETURNING id;`;

      // Execute gig document creation
      const gigDocResult = await executeSQL(gigDocSQL, "Creating gig document");

      // Extract gig document ID from result
      const gigDocIdMatch = gigDocResult.match(/id\s*\n\s*(\d+)/);
      const gigDocId = gigDocIdMatch ? gigDocIdMatch[1] : "unknown";

      // Process URLs and create links
      let linksCreated = 0;
      if (urls.length > 0) {
        console.log(
          `    Found ${urls.length} URLs, processing links using DIRECT SQL (${envLabel})...`
        );

        for (const urlInfo of urls) {
          // Skip font resources and other non-music links
          if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
            continue;
          }

          // Map link types to database enum values
          const dbLinkType = mapLinkType(urlInfo.type);

          try {
            // Check if link already exists
            const checkLinkSQL = `SELECT id FROM links WHERE song_id = ${song.id} AND url = '${urlInfo.url.replace(/'/g, "''")}';`;
            const existingLinkResult = await executeSQL(
              checkLinkSQL,
              "Checking existing link"
            );

            if (!existingLinkResult.includes("(0 rows)")) {
              // Create new link
              const linkSQL = `INSERT INTO links (song_id, type, description, url, created_at, updated_at) VALUES (${song.id}, '${dbLinkType}', '${(urlInfo.description || urlInfo.url).replace(/'/g, "''")}', '${urlInfo.url.replace(/'/g, "''")}', '${now}', '${now}');`;
              await executeSQL(linkSQL, "Creating link");
              linksCreated++;
            }
          } catch (error) {
            console.error(`      Error creating link: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        message: `${envLabel}: Gig document ${gigDocId} (${matchType}), ${linksCreated} new links created`,
      };
    } else {
      // Local mode: Use Prisma
      console.log(`    Creating new gig document`);

      // Create new gig document
      const newDoc = await prisma.gigDocument.create({
        data: {
          songId: song.id,
          createdById: 1, // Assuming user ID 1 exists
          type: "chords",
          version: 1,
          content: content,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const gigDocId = newDoc.id;

      // Process URLs and create links
      let linksCreated = 0;
      if (urls.length > 0) {
        console.log(`    Found ${urls.length} URLs, processing links...`);

        for (const urlInfo of urls) {
          // Skip font resources and other non-music links
          if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
            continue;
          }

          // Map link types to database enum values
          const dbLinkType = mapLinkType(urlInfo.type);

          try {
            // Check if link already exists
            const existingLink = await prisma.link.findFirst({
              where: {
                songId: song.id,
                url: urlInfo.url,
              },
            });

            if (!existingLink) {
              // Create new link
              await prisma.link.create({
                data: {
                  songId: song.id,
                  type: dbLinkType,
                  description: urlInfo.description || urlInfo.url,
                  url: urlInfo.url,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              linksCreated++;
            }
          } catch (error) {
            console.error(`      Error creating link: ${error.message}`);
          }
        }
      }

      return {
        success: true,
        message: `Gig document ${gigDocId} (${matchType}), ${linksCreated} new links created`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
}

function mapLinkType(urlType) {
  const typeMap = {
    youtube: "youtube",
    spotify: "spotify",
    apple_music: "apple_music",
    soundcloud: "soundcloud",
    bandcamp: "bandcamp",
    lyrics: "lyrics",
    guitar_tabs: "tab",
    wikipedia: "other",
    discogs: "other",
    allmusic: "other",
    rateyourmusic: "other",
  };

  return typeMap[urlType] || "other";
}

function generateChordContent(songContent) {
  // Extract URLs with link text before processing content
  const urls = [];

  // Extract anchor tags with href and link text
  const anchorRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(songContent)) !== null) {
    const url = anchorMatch[1];
    const linkText = anchorMatch[2].replace(/<[^>]*>/g, "").trim();

    if (url.startsWith("http")) {
      urls.push({
        url: url,
        description: linkText || url,
        type: determineLinkType(url, linkText),
      });
    }
  }

  // Also extract any standalone URLs that weren't in anchor tags
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const standaloneUrls = songContent.match(urlRegex) || [];

  standaloneUrls.forEach((url) => {
    // Check if this URL wasn't already captured in anchor tags
    if (!urls.some((u) => u.url === url)) {
      urls.push({
        url: url,
        description: url,
        type: determineLinkType(url, url),
      });
    }
  });

  // Extract the body content
  const bodyMatch = songContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    let bodyContent = bodyMatch[1];

    // Remove the title (h1 tag) from the content
    bodyContent = bodyContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "");

    // Remove the first hr tag from the content
    bodyContent = bodyContent.replace(/<hr[^>]*>/, "");

    // Remove all URL links from the content
    bodyContent = bodyContent.replace(/<a[^>]*href="[^"]*"[^>]*>.*?<\/a>/g, "");
    bodyContent = bodyContent.replace(/https?:\/\/[^\s<>"']+/g, "");

    // Convert specific CSS classes to TinyMCE indentation format
    // .c21 (36pt) -> padding-left: 40px (first level)
    // .c26 (72pt) -> padding-left: 80px (second level)
    // .c48 (108pt) -> padding-left: 120px (third level)
    // .c85 (144pt) -> padding-left: 160px (fourth level)

    // Replace .c21 class with padding-left: 40px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc21\b[^"]*"/g,
      'style="padding-left: 40px;"'
    );

    // Replace .c26 class with padding-left: 80px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc26\b[^"]*"/g,
      'style="padding-left: 80px;"'
    );

    // Replace .c48 class with padding-left: 120px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc48\b[^"]*"/g,
      'style="padding-left: 120px;"'
    );

    // Replace .c85 class with padding-left: 160px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc85\b[^"]*"/g,
      'style="padding-left: 160px;"'
    );

    // Remove all other CSS classes and simplify the HTML structure
    bodyContent = bodyContent.replace(/class="[^"]*"/g, "");

    // Remove complex inline styles and keep only the padding-left we added
    bodyContent = bodyContent.replace(
      /style="[^"]*(?:padding-left: 40px|padding-left: 80px|padding-left: 120px|padding-left: 160px)[^"]*"/g,
      (match) => {
        if (match.includes("padding-left: 40px"))
          return 'style="padding-left: 40px;"';
        if (match.includes("padding-left: 80px"))
          return 'style="padding-left: 80px;"';
        if (match.includes("padding-left: 120px"))
          return 'style="padding-left: 120px;"';
        if (match.includes("padding-left: 160px"))
          return 'style="padding-left: 160px;"';
        return match;
      }
    );

    // Remove all other style attributes that don't contain padding-left
    bodyContent = bodyContent.replace(/style="(?!.*padding-left)[^"]*"/g, "");

    // Clean up empty attributes
    bodyContent = bodyContent.replace(/\s+>/g, ">");
    bodyContent = bodyContent.replace(/>\s+</g, "><");

    return { content: bodyContent, urls: urls };
  }

  // Fallback to the full content if extraction fails
  return { content: songContent, urls: urls };
}

function determineLinkType(url, description) {
  // Determine link type based on URL and description
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (url.includes("spotify.com")) {
    return "spotify";
  } else if (
    url.includes("apple.com/music") ||
    url.includes("music.apple.com")
  ) {
    return "apple_music";
  } else if (
    url.includes("amazon.com/music") ||
    url.includes("music.amazon.com")
  ) {
    return "amazon_music";
  } else if (url.includes("bandcamp.com")) {
    return "bandcamp";
  } else if (url.includes("soundcloud.com")) {
    return "soundcloud";
  } else if (url.includes("genius.com") || url.includes("lyrics.genius.com")) {
    return "lyrics";
  } else if (
    url.includes("ultimate-guitar.com") ||
    url.includes("tabs.ultimate-guitar.com")
  ) {
    return "guitar_tabs";
  } else if (url.includes("songsterr.com")) {
    return "guitar_tabs";
  } else if (
    url.includes("googleusercontent.com") ||
    url.includes("fonts.googleapis.com")
  ) {
    return "font_resource";
  } else if (url.includes("wikipedia.org")) {
    return "wikipedia";
  } else if (url.includes("discogs.com")) {
    return "discogs";
  } else if (url.includes("allmusic.com")) {
    return "allmusic";
  } else if (url.includes("rateyourmusic.com")) {
    return "rateyourmusic";
  } else {
    return "other";
  }
}

async function generateHTMLReport(
  songFiles,
  processedCount,
  skippedCount,
  errorCount
) {
  try {
    const reportPath = path.join(__dirname, "song-processing-report.html");

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Song Processing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; text-align: center; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .summary { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border-radius: 5px; }
        .success-stat { background-color: #d4edda; }
        .warning-stat { background-color: #fff3cd; }
        .danger-stat { background-color: #f8d7da; }
        .info-stat { background-color: #e7f3ff; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🎵 Song Processing Report</h1>
    
    <div class="summary">
        <h2>📊 Summary Statistics</h2>
        <div class="stats">
            <div class="stat-box success-stat">
                <h3>✅ Successfully Processed</h3>
                <h2>${processedCount}</h2>
                <p>${songFiles.length > 0 ? Math.round((processedCount / songFiles.length) * 100) : 0}%</p>
            </div>
            <div class="stat-box warning-stat">
                <h3>⏭️ Skipped</h3>
                <h2>${skippedCount}</h2>
                <p>${songFiles.length > 0 ? Math.round((skippedCount / songFiles.length) * 100) : 0}%</p>
            </div>
            <div class="stat-box danger-stat">
                <h3>❌ Errors</h3>
                <h2>${errorCount}</h2>
                <p>${songFiles.length > 0 ? Math.round((errorCount / songFiles.length) * 100) : 0}%</p>
            </div>
            <div class="stat-box info-stat">
                <h3>🎯 Total Files</h3>
                <h2>${songFiles.length}</h2>
                <p>Processed: ${processedCount + skippedCount + errorCount}</p>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>FILENAME (Click to View)</th>
                <th>EXTRACTED TITLE</th>
                <th>STATUS</th>
                <th>DB ID</th>
                <th>DATABASE TITLE</th>
                <th>NOTES</th>
            </tr>
        </thead>
        <tbody>
            ${songFiles
              .map((file, index) => {
                const extractedTitle = extractTitleFromFilename(file);
                const status =
                  index < processedCount
                    ? "✅ Processed"
                    : index < processedCount + skippedCount
                      ? "⏭️ Skipped"
                      : "❌ Error";
                const dbId = ""; // Would need to be passed from processing
                const dbTitle = ""; // Would need to be passed from processing
                const notes = "";

                return `
                <tr>
                    <td><a href="http://127.0.0.1:5500/KDGRB/songs/${encodeURIComponent(file)}" target="_blank" style="color: #007bff; text-decoration: none;">${file}</a></td>
                    <td>${extractedTitle || "Untitled"}</td>
                    <td>${status}</td>
                    <td>${dbId}</td>
                    <td>${dbTitle}</td>
                    <td>${notes}</td>
                </tr>
              `;
              })
              .join("")}
        </tbody>
    </table>

    <div style="text-align: center; color: #666; font-size: 0.9em; margin-top: 20px;">
        Generated on ${new Date().toLocaleString()}
    </div>
</body>
</html>`;

    fs.writeFileSync(reportPath, html);
    console.log(`✅ HTML report generated: ${reportPath}`);
  } catch (error) {
    console.error("❌ Error generating HTML report:", error.message);
  }
}

// Individual processing functions
async function processByDatabaseId() {
  try {
    const songId = await askQuestion("Enter song database ID: ");
    const id = parseInt(songId);

    if (isNaN(id)) {
      console.log("❌ Invalid ID. Please enter a number.");
      await showInteractiveMenu();
      return;
    }

    const song = await prisma.song.findUnique({
      where: { id: id },
    });

    if (!song) {
      console.log(`❌ Song with ID ${id} not found in database.`);
      await showInteractiveMenu();
      return;
    }

    console.log(`✅ Found song: "${song.title}" (ID: ${song.id})`);

    // Find the HTML file for this song
    const songsDir = path.join(__dirname, "songs");
    const songFiles = fs
      .readdirSync(songsDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    // Try to find a file that might match this song
    const matchingFile = songFiles.find((file) => {
      const extractedTitle = extractTitleFromFilename(file);
      return (
        extractedTitle &&
        song.title.toLowerCase().includes(extractedTitle.toLowerCase())
      );
    });

    if (matchingFile) {
      console.log(`📁 Found matching file: ${matchingFile}`);
      const result = await processSongFile(matchingFile, {
        song: song,
        matchType: "BY_ID",
      });
      if (result.success) {
        console.log(`✅ Successfully processed: ${result.message}`);
      } else {
        console.log(`❌ Error: ${result.message}`);
      }
    } else {
      console.log("❌ No matching HTML file found for this song.");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await showInteractiveMenu();
    return;
  }
}

async function processBySongTitle() {
  try {
    const searchTitle = await askQuestion("Enter song title to search for: ");

    if (!searchTitle.trim()) {
      console.log("❌ Please enter a title to search for.");
      await showInteractiveMenu();
      return;
    }

    // Find songs in database that match
    const songs = await prisma.song.findMany({
      where: {
        title: { contains: searchTitle, mode: "insensitive" },
      },
      take: 10,
    });

    if (songs.length === 0) {
      console.log(`❌ No songs found matching "${searchTitle}"`);
      await showInteractiveMenu();
      return;
    }

    console.log(`\n📋 Found ${songs.length} matching songs:`);
    songs.forEach((song, index) => {
      console.log(`  ${index + 1}. ID ${song.id}: "${song.title}"`);
    });

    if (songs.length === 1) {
      console.log("\n✅ Processing the only match...");
      await processSongByDatabaseSong(songs[0]);
    } else {
      const choice = await askQuestion(
        `\nChoose song (1-${songs.length}) or 0 to cancel: `
      );
      const choiceNum = parseInt(choice);

      if (choiceNum === 0) {
        await showInteractiveMenu();
        return;
      }

      if (choiceNum >= 1 && choiceNum <= songs.length) {
        await processSongByDatabaseSong(songs[choiceNum - 1]);
      } else {
        console.log("❌ Invalid choice.");
        await showInteractiveMenu();
        return;
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    await showInteractiveMenu();
  }
}

async function processByFilename() {
  try {
    const songsDir = path.join(__dirname, "songs");
    const songFiles = fs
      .readdirSync(songsDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    console.log(`\n📁 Available files (showing first 20):`);
    songFiles.slice(0, 20).forEach((file, index) => {
      console.log(`  ${index + 1}. ${file}`);
    });

    if (songFiles.length > 20) {
      console.log(`  ... and ${songFiles.length - 20} more files`);
    }

    const choice = await askQuestion(
      `\nChoose file (1-${Math.min(20, songFiles.length)}) or enter filename: `
    );

    let selectedFile;
    if (/^\d+$/.test(choice)) {
      const choiceNum = parseInt(choice);
      if (choiceNum >= 1 && choiceNum <= Math.min(20, songFiles.length)) {
        selectedFile = songFiles[choiceNum - 1];
      } else {
        console.log("❌ Invalid choice.");
        await showInteractiveMenu();
        return;
      }
    } else {
      selectedFile = choice;
      if (!songFiles.includes(selectedFile)) {
        console.log(`❌ File "${selectedFile}" not found.`);
        await showInteractiveMenu();
        return;
      }
    }

    console.log(`✅ Selected file: ${selectedFile}`);
    await processSingleFile(selectedFile);
  } catch (error) {
    console.error("❌ Error:", error.message);
    await showInteractiveMenu();
  }
}

async function processWithRange() {
  try {
    const startNum = await askQuestion("Enter start file number (1-based): ");
    const endNum = await askQuestion("Enter end file number (1-based): ");

    const start = parseInt(startNum);
    const end = parseInt(endNum);

    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      console.log("❌ Invalid range. Please enter valid numbers.");
      await showInteractiveMenu();
      return;
    }

    const songsDir = path.join(__dirname, "songs");
    const songFiles = fs
      .readdirSync(songsDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    if (end > songFiles.length) {
      console.log(
        `⚠️  End number ${end} exceeds file count (${songFiles.length}). Using ${songFiles.length} instead.`
      );
      end = songFiles.length;
    }

    const selectedFiles = songFiles.slice(start - 1, end);
    console.log(
      `✅ Processing files ${start}-${end} (${selectedFiles.length} files)`
    );

    await processAllSongsToGigDocs({
      all: true,
      customFiles: selectedFiles,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    await showInteractiveMenu();
  }
}

async function processSongByDatabaseSong(song) {
  try {
    console.log(`\n🎵 Processing song: "${song.title}" (ID: ${song.id})`);

    // Find the HTML file for this song
    const songsDir = path.join(__dirname, "songs");
    const songFiles = fs
      .readdirSync(songsDir)
      .filter((file) => file.endsWith(".html"))
      .sort();

    // Try to find a file that might match this song
    const matchingFile = songFiles.find((file) => {
      const extractedTitle = extractTitleFromFilename(file);
      return (
        extractedTitle &&
        song.title.toLowerCase().includes(extractedTitle.toLowerCase())
      );
    });

    if (matchingFile) {
      console.log(`📁 Found matching file: ${matchingFile}`);
      const result = await processSongFile(
        matchingFile,
        {
          song: song,
          matchType: "BY_TITLE",
        },
        { production: true }
      );
      if (result.success) {
        console.log(`✅ Successfully processed: ${result.message}`);
      } else {
        console.log(`❌ Error: ${result.message}`);
      }
    } else {
      console.log("❌ No matching HTML file found for this song.");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await showInteractiveMenu();
  }
}

async function processSingleFile(filename) {
  try {
    const extractedTitle = extractTitleFromFilename(filename);
    if (!extractedTitle) {
      console.log(`❌ Could not extract title from filename: ${filename}`);
      await showInteractiveMenu();
      return;
    }

    console.log(`📝 Extracted title: "${extractedTitle}"`);

    const song = await findSongInDatabase(extractedTitle);
    if (!song) {
      console.log(`❌ No database match found for "${extractedTitle}"`);
      await showInteractiveMenu();
      return;
    }

    console.log(`✅ Database match: ID ${song.song.id} - "${song.song.title}"`);

    const result = await processSongFile(
      filename,
      {
        song: song.song,
        matchType: "BY_FILENAME",
      },
      { production: false }
    );
    if (result.success) {
      console.log(`✅ Successfully processed: ${result.message}`);
    } else {
      console.log(`❌ Error: ${result.message}`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await showInteractiveMenu();
  }
}

// Run the interactive menu
showInteractiveMenu().catch(console.error);
