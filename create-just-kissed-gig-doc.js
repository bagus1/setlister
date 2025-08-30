const { PrismaClient } = require("./generated/prisma");

const prisma = new PrismaClient();

async function createLetsStayTogetherGigDocument() {
  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Connected successfully!");

    // Find the song
    const song = await prisma.song.findFirst({
      where: {
        title: { contains: "Let's Stay Together", mode: "insensitive" },
      },
    });

    if (!song) {
      console.log("Song not found!");
      return;
    }

    console.log(`Found song: ID ${song.id} - "${song.title}"`);

    // Extract URLs from the song content
    const { content, urls } = generateChordContent();

    // Check if a gig document already exists
    const existingDoc = await prisma.gigDocument.findFirst({
      where: {
        songId: song.id,
        type: "chords",
      },
    });

    if (existingDoc) {
      console.log(`Gig document already exists with ID: ${existingDoc.id}`);
      console.log("Updating existing document...");

      // Update the existing document
      const updatedDoc = await prisma.gigDocument.update({
        where: { id: existingDoc.id },
        data: {
          content: content,
          version: existingDoc.version + 1,
          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ Updated gig document ID ${updatedDoc.id} to version ${updatedDoc.version}`
      );
    } else {
      console.log("Creating new gig document...");

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

      console.log(`✅ Created new gig document with ID: ${newDoc.id}`);
    }

    // Display extracted URLs with descriptions and types
    if (urls.length > 0) {
      console.log(`\n📎 Extracted ${urls.length} URLs from song content:`);
      urls.forEach((urlInfo, index) => {
        console.log(`  ${index + 1}. ${urlInfo.description || urlInfo.url}`);
        console.log(`     URL: ${urlInfo.url}`);
        console.log(`     Type: ${urlInfo.type}`);
      });
      console.log(
        "\n💡 Note: These URLs should be added as links associated with the song in your system."
      );

      // Create Link records in the database
      console.log("\n🔗 Creating Link records in database...");
      for (const urlInfo of urls) {
        // Skip font resources and other non-music links
        if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
          console.log(`  Skipping ${urlInfo.type}: ${urlInfo.url}`);
          continue;
        }

        // Map our link types to database enum values
        let dbLinkType;
        switch (urlInfo.type) {
          case "youtube":
            dbLinkType = "youtube";
            break;
          case "spotify":
            dbLinkType = "spotify";
            break;
          case "apple_music":
            dbLinkType = "apple_music";
            break;
          case "soundcloud":
            dbLinkType = "soundcloud";
            break;
          case "bandcamp":
            dbLinkType = "bandcamp";
            break;
          case "lyrics":
            dbLinkType = "lyrics";
            break;
          case "guitar_tabs":
            dbLinkType = "tab";
            break;
          case "wikipedia":
            dbLinkType = "other";
            break;
          case "discogs":
            dbLinkType = "other";
            break;
          case "allmusic":
            dbLinkType = "other";
            break;
          case "rateyourmusic":
            dbLinkType = "other";
            break;
          default:
            dbLinkType = "other";
        }

        try {
          // Check if link already exists
          const existingLink = await prisma.link.findFirst({
            where: {
              songId: song.id,
              url: urlInfo.url,
            },
          });

          if (existingLink) {
            console.log(
              `  ✅ Link already exists: ${urlInfo.description || urlInfo.url}`
            );
          } else {
            // Create new link
            const newLink = await prisma.link.create({
              data: {
                songId: song.id,
                type: dbLinkType,
                description: urlInfo.description || urlInfo.url,
                url: urlInfo.url,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            console.log(
              `  ✅ Created link: ${urlInfo.description || urlInfo.url} (ID: ${newLink.id})`
            );
          }
        } catch (error) {
          console.error(
            `  ❌ Error creating link for ${urlInfo.url}:`,
            error.message
          );
        }
      }
    } else {
      console.log("\n📎 No URLs found in song content.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("\nDatabase connection closed.");
  }
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

function generateChordContent() {
  // Read the actual song file content
  const fs = require("fs");
  const path = require("path");

  try {
    const songFilePath = path.join(
      __dirname,
      "KDGRB",
      "songs",
      "song-094-Let's Stay Together.html"
    );
    const songContent = fs.readFileSync(songFilePath, "utf8");

    // Extract URLs with link text before processing content
    const urls = [];

    // Extract anchor tags with href and link text
    const anchorRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
    let anchorMatch;
    while ((anchorMatch = anchorRegex.exec(songContent)) !== null) {
      const url = anchorMatch[1];
      const linkText = anchorMatch[2].replace(/<[^>]*>/g, "").trim(); // Remove HTML tags from link text

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
      bodyContent = bodyContent.replace(
        /<a[^>]*href="[^"]*"[^>]*>.*?<\/a>/g,
        ""
      );
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
  } catch (error) {
    console.error("Error reading song file:", error);
    return { content: "Error reading song file content", urls: [] };
  }
}

// Run the script
createLetsStayTogetherGigDocument().catch(console.error);
