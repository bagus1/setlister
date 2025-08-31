const express = require("express");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const { prisma } = require("../lib/prisma");

const router = express.Router();

// Load Google service account credentials
// Google Drive API scopes
const SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

// Initialize Google Drive API client for exporting documents
function getGoogleDriveClient() {
  try {
    // Use environment variable for credentials file, fallback to default
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_FILE
      ? path.join(__dirname, "..", process.env.GOOGLE_CREDENTIALS_FILE)
      : path.join(__dirname, "..", "setlister-api-8ba5ce617f03.json"); // Default to working file

    console.log(`Using credentials file: ${path.basename(credentialsPath)}`);

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    return google.drive({ version: "v3", auth });
  } catch (error) {
    console.error("Error loading Google credentials:", error);
    throw new Error("Failed to initialize Google Drive API client");
  }
}

// Extract document ID from Google Doc URL
function extractDocumentId(url) {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error(
      "Invalid Google Doc URL. Please provide a valid Google Doc link."
    );
  }
  return match[1];
}

// Function to sanitize filename (remove special characters)
function sanitizeFilename(filename) {
  return filename
    .replace(/&rsquo;/g, "'") // Decode right single quotation mark
    .replace(/&lsquo;/g, "'") // Decode left single quotation mark
    .replace(/&rdquo;/g, '"') // Decode right double quotation mark
    .replace(/&ldquo;/g, '"') // Decode left double quotation mark
    .replace(/&amp;/g, "&") // Decode ampersand
    .replace(/&lt;/g, "<") // Decode less than
    .replace(/&gt;/g, ">") // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotation mark
    .replace(/&#39;/g, "'") // Decode apostrophe
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid filename characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Process HTML content directly (from Google Docs export)
function processHtmlContent(htmlContent) {
  console.log("=== BAgus says Starting song extraction ===");

  try {
    // Extract the HTML structure and styles
    const htmlMatch = htmlContent.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
    if (!htmlMatch) {
      throw new Error("Could not find HTML structure in the document");
    }

    const fullHtmlContent = htmlMatch[1];

    // Extract the head section with styles
    const headMatch = fullHtmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (!headMatch) {
      throw new Error("Could not find head section with styles");
    }

    const headContent = headMatch[1];

    // Extract the body content
    const bodyMatch = fullHtmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) {
      throw new Error("Could not find body section");
    }

    const bodyContent = bodyMatch[1];
    console.log("Extracted body content, length:", bodyContent.length);

    // Split by the hr tags that delineate songs
    const songSeparator = '<hr style="page-break-before:always;display:none;">';
    const songs = bodyContent.split(songSeparator);

    console.log(`Found ${songs.length} sooong sections`);

    // First pass: Detect what heading levels are used for song titles
    let detectedHeadingLevel = null;
    let headingPattern = null;
    let usePageBreakParsing = false;

    for (let i = 0; i < songs.length; i++) {
      const songContent = songs[i];
      if (!songContent.trim()) continue;

      // Check for different heading levels
      const h1Match = songContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const h2Match = songContent.match(/<h2[^>]*>(.*?)<\/h2>/i);
      const h3Match = songContent.match(/<h3[^>]*>(.*?)<\/h3>/i);

      if (h1Match && h1Match[1].trim()) {
        detectedHeadingLevel = "h1";
        headingPattern = /<h1[^>]*>(.*?)<\/h1>/gi;
        console.log(`Detected H1 as song title format`);
        break;
      } else if (h2Match && h2Match[1].trim()) {
        detectedHeadingLevel = "h2";
        headingPattern = /<h2[^>]*>(.*?)<\/h2>/gi;
        console.log(`Detected H2 as song title format`);
        break;
      } else if (h3Match && h3Match[1].trim()) {
        detectedHeadingLevel = "h3";
        headingPattern = /<h3[^>]*>(.*?)<\/h3>/gi;
        console.log(`Detected H3 as song title format`);
        break;
      }
    }

    // If no headings found, use page break parsing
    if (!detectedHeadingLevel) {
      console.log(`No heading tags detected, using page break parsing`);
      usePageBreakParsing = true;
    }

    // Second pass: Extract songs using detected heading pattern
    let songCount = 0;
    const extractedSongs = [];
    console.log("sooongs.length:  ", songs.length);
    songs.forEach((songContent, index) => {
      // Skip empty sections
      if (!songContent.trim()) {
        return;
      }

      // songCount will be incremented only when we find actual songs

      // Extract song title using detected heading pattern or page break parsing
      let songTitle = "untitled";

      if (usePageBreakParsing) {
        // Page break parsing: use the first line of each section
        console.log(
          `Section ${index} content preview:`,
          songContent.substring(0, 200)
        );

        // Get the first non-empty line (likely the song title)
        const lines = songContent.split("\n").filter((line) => line.trim());
        if (lines.length > 0) {
          const firstLine = lines[0];
          // Remove HTML tags and get clean text
          const cleanText = firstLine.replace(/<[^>]*>/g, "").trim();
          if (cleanText && cleanText.length > 0) {
            // Extract just the song title from the beginning of the line
            let extractedTitle = cleanText;

            // Stop at common metadata indicators
            const stopPatterns = [
              /Chords by/i,
              /views/i,
              /saves/i,
              /comments/i,
              /Author:/i,
              /Difficulty:/i,
              /Speed:/i,
              /Tuning:/i,
              /Key:/i,
              /Capo:/i,
              /\[/i, // Stop at section markers like [Intro]
              /\(/i, // Stop at parentheses
            ];

            for (const pattern of stopPatterns) {
              const match = cleanText.match(pattern);
              if (match) {
                extractedTitle = cleanText.substring(0, match.index).trim();
                break;
              }
            }

            // Clean up any remaining artifacts
            extractedTitle = extractedTitle.replace(/\s+/g, " ").trim();

            if (extractedTitle && extractedTitle.length > 0) {
              songTitle = sanitizeFilename(extractedTitle);
              console.log(
                `Song ${index}: Page break parsing - Extracted title: "${extractedTitle}" -> sanitized: "${songTitle}"`
              );
            }
          }
        }
      } else {
        // Heading-based parsing (existing logic)
        // Pattern 1: Look for the first non-empty h1 tag with content
        const h1Matches = songContent.match(/<h1[^>]*>.*?<\/h1>/gi);
        if (h1Matches) {
          for (const h1Match of h1Matches) {
            // Extract text content from h1 tag
            const textMatch = h1Match.match(/<h1[^>]*>(.*?)<\/h1>/i);
            if (textMatch && textMatch[1]) {
              // Remove HTML tags and get clean text
              const cleanText = textMatch[1].replace(/<[^>]*>/g, "").trim();
              if (cleanText && cleanText.length > 0) {
                songTitle = sanitizeFilename(cleanText);
                console.log(
                  `Song ${index}: Extracted title: "${cleanText}" -> sanitized: "${songTitle}"`
                );
                break; // Use the first non-empty title found
              }
            }
          }
        }

        // If still untitled, try alternative patterns
        if (songTitle === "untitled") {
          // Pattern 2: <h1...><span...>title</span>
          const titleMatch1 = songContent.match(
            /<h1[^>]*>.*?<span[^>]*>([^<]*?)<\/span>/i
          );
          if (titleMatch1 && titleMatch1[1] && titleMatch1[1].trim()) {
            songTitle = sanitizeFilename(titleMatch1[1]);
            console.log(
              `Song ${index}: Extracted title: "${titleMatch1[1]}" -> sanitized: "${songTitle}"`
            );
          } else {
            // Pattern 3: <h1...>title</h1> (without span)
            const titleMatch2 = songContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (titleMatch2 && titleMatch2[1] && titleMatch2[1].trim()) {
              songTitle = sanitizeFilename(titleMatch2[1]);
              console.log(
                `Song ${index}: Extracted title: "${titleMatch2[1]}" -> sanitized: "${songTitle}"`
              );
            }
          }
        }
      }

      // Only process sections that have actual song titles (not metadata)
      if (songTitle !== "untitled") {
        songCount++; // Increment the song counter!

        // Extract song content (everything after the title)
        const songBodyContent = songContent
          .replace(
            new RegExp(
              `<${detectedHeadingLevel}[^>]*>.*?<\/${detectedHeadingLevel}>`,
              "gi"
            ),
            ""
          )
          .trim();
        console.log("title:  ", songTitle);
        console.log("cooontent:  ", songBodyContent.length);

        extractedSongs.push({
          index: songCount,
          title: songTitle,
          contentLength: songBodyContent.length,
          contentPreview:
            songBodyContent.substring(0, 200) +
            (songBodyContent.length > 200 ? "..." : ""),
          fullContent: songBodyContent, // Add the full content
          originalIndex: index,
        });

        console.log(
          `=== Successfully created extractedSongs entry ${songCount} ===`
        );
        console.log(
          `=== Entry has fullContent: ${!!extractedSongs[extractedSongs.length - 1].fullContent} ===`
        );
        console.log(
          `=== Entry fullContent length: ${extractedSongs[extractedSongs.length - 1].fullContent?.length || "undefined"} ===`
        );

        console.log(
          `Song ${songCount}: "${songTitle}" - Content length: ${songBodyContent.length}`
        );
      } else {
        console.log(`Section ${index}: Skipped (no song title or metadata)`);
      }
    });

    console.log(`=== Song extraction completed: ${songCount} songs found ===`);
    console.log("Bagus was here 2");

    // Check if we found any songs
    if (songCount === 0) {
      throw new Error(
        "No songs could be extracted from this document. Please ensure your Google Doc has songs separated by page breaks and each song title is clearly formatted."
      );
    }

    console.log(
      "extractedSongs BAGUS FULL LENGTH:  ",
      extractedSongs[0].fullContent.length
    );
    return {
      success: true,
      message: "Google Doc processed successfully",
      contentLength: htmlContent.length,
      songsFound: songCount,
      extractedSongs: extractedSongs,
      htmlContentLength: htmlContent.length,
    };
  } catch (error) {
    console.error("Error in song extraction:", error);
    throw error;
  }
}

// POST /admin/process-google-doc
router.post("/admin/process-google-doc", async (req, res) => {
  try {
    console.log("=== Starting Google Doc processing ===");
    const { googleDocUrl } = req.body;

    if (!googleDocUrl) {
      console.log("No Google Doc URL provided");
      return res.status(400).json({
        success: false,
        error: "Google Doc URL is required",
      });
    }

    console.log("Processing Google Doc URL:", googleDocUrl);

    // Extract document ID
    const documentId = extractDocumentId(googleDocUrl);
    console.log("Extracted document ID:", documentId);

    // Get Google Drive client
    console.log("Creating Google Drive client...");
    const drive = getGoogleDriveClient();
    console.log("Google Drive client created successfully");

    // Get document metadata (including title) using Google Drive API FIRST
    console.log("Fetching document metadata...");
    const fileMetadata = await drive.files.get({
      fileId: documentId,
      fields: "name,createdTime,modifiedTime",
    });
    const documentTitle = fileMetadata.data.name;
    console.log("Document title:", documentTitle);

    // Export document as HTML using Google Drive API
    console.log("Exporting document as HTML from Google Drive API...");
    const response = await drive.files.export({
      fileId: documentId,
      mimeType: "text/html",
    });
    const htmlContent = response.data;

    console.log("HTML exported successfully:", {
      contentLength: htmlContent.length,
    });

    console.log("Bagus was here");
    // Process the HTML content directly
    const result = processHtmlContent(htmlContent);

    // Add document title to the result
    result.documentTitle = documentTitle;
    console.log("Bagus was here 3");

    // Check if we have songs before proceeding
    if (!result.extractedSongs || result.extractedSongs.length === 0) {
      throw new Error(
        "No songs could be extracted from this document. Please ensure your Google Doc has songs separated by page breaks and each song title is clearly formatted."
      );
    }

    console.log(
      "result BAGUS FULL LENGTH:  ",
      result.extractedSongs[0].fullContent.length
    );
    console.log("=== Google Doc processing completed successfully ===");

    // Instead of session storage and redirect, directly render the quickset confirmation page
    // Extract the essential data needed for quickset
    const essentialData = {
      success: result.success,
      message: result.message,
      contentLength: result.contentLength,
      songsFound: result.songsFound,
      documentTitle: result.documentTitle,
      extractedSongs: result.extractedSongs.map((song) => ({
        index: song.index,
        title: song.title,
        contentLength: song.contentLength,
        contentPreview: song.contentPreview,
        fullContent: song.fullContent, // Include the full content for gig document creation
        originalIndex: song.originalIndex,
      })),
    };

    // Get the band ID from the request
    const bandId = req.body.bandId || "1";

    // Import the sophisticated HTML processor
    const { processGoogleDocHtml } = require("../utils/googleDocHtmlProcessor");

    // Process each extracted song with the sophisticated HTML processor
    const processedSongs = essentialData.extractedSongs.map((song, index) => {
      console.log(`=== Processing song ${index + 1}: ${song.title} ===`);
      console.log(`- Has fullContent: ${!!song.fullContent}`);
      console.log(
        `- fullContent length: ${song.fullContent?.length || "undefined"}`
      );
      console.log(
        `- contentPreview length: ${song.contentPreview?.length || "undefined"}`
      );
      console.log(`- contentLength: ${song.contentLength}`);

      // Process the HTML content to make it TinyMCE compatible
      const contentToProcess =
        song.fullContent || song.contentPreview.replace(/\.\.\.$/, "");
      console.log(
        `- Content being sent to HTML processor: ${contentToProcess?.length || "undefined"} characters`
      );
      console.log(
        `- Content preview: ${contentToProcess?.substring(0, 100) || "NO CONTENT"}`
      );

      const { content: processedContent, urls } =
        processGoogleDocHtml(contentToProcess);

      return {
        lineNumber: index + 1,
        title: song.title,
        artist: "", // Will be filled in during matching
        originalContent: song.contentPreview, // Keep original for display
        processedContent: processedContent, // TinyMCE-compatible content
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: urls, // Extracted URLs for link creation
      };
    });

    // Create a quickset-compatible structure from Google Doc data
    const quicksetData = {
      sets: [
        {
          name: "Set_1", // Use the actual database set name
          songs: processedSongs.map((song) => ({
            lineNumber: song.lineNumber,
            title: song.title,
            artist: song.artist,
            originalContent: song.originalContent,
            processedContent: song.processedContent,
            contentLength: song.contentLength,
            originalIndex: song.originalIndex,
            urls: song.urls,
          })),
        },
      ],
      songs: processedSongs.map((song) => ({
        lineNumber: song.lineNumber,
        title: song.title,
        artist: song.artist,
        originalContent: song.originalContent,
        processedContent: song.processedContent,
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: song.urls,
      })),
    };

    // Create a temporary setlist for the quickset workflow
    // Use the Google Doc title if available, otherwise fall back to default
    console.log("Parsed data for setlist title:", {
      hasDocumentTitle: !!essentialData.documentTitle,
      documentTitle: essentialData.documentTitle,
      dataKeys: Object.keys(essentialData),
    });

    // Priority: 1) Google Doc title, 2) Default
    let titleToUse = null;
    if (essentialData.documentTitle) {
      titleToUse = `${essentialData.documentTitle} - ${new Date().toLocaleDateString()}`;
    } else {
      titleToUse = `Google Doc Import - ${new Date().toLocaleDateString()}`;
    }

    const setlistTitle = titleToUse;
    console.log("Final setlist title:", setlistTitle);

    // Create the setlist first so we have a real ID
    try {
      const setlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          date: new Date(),
          bandId: parseInt(bandId),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create a default set for the Google Doc songs
      await prisma.setlistSet.create({
        data: {
          setlistId: setlist.id,
          name: "Set_1", // Default to Set 1
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Store the Google Doc data in session for quickset confirmation
      req.session.quickSetData = {
        bandId: parseInt(bandId),
        setlistId: setlist.id, // Use the real setlist ID
        sets: quicksetData.sets,
        songs: quicksetData.songs,
        googleDocData: essentialData, // Store original Google Doc data
        isGoogleDocImport: true, // Flag to indicate this is from Google Doc
      };

      // Redirect to the quickset confirmation page
      res.redirect(`/bands/${bandId}/quick-set/confirm`);
    } catch (error) {
      console.error("Error creating setlist:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create setlist for Google Doc import",
      });
    }
  } catch (error) {
    console.error("=== ERROR processing Google Doc ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    console.error("=== END ERROR ===");

    // Check for specific parsing error
    let userFriendlyError = "Failed to process Google Doc";

    if (
      error.message &&
      error.message.includes(
        "Cannot read properties of undefined (reading 'fullContent')"
      )
    ) {
      userFriendlyError =
        "Sorry, we can't process that doc. Make sure your Google Doc has songs separated by page breaks and each song title is clearly formatted.";
    } else if (error.message) {
      userFriendlyError = error.message;
    }

    res.status(500).json({
      success: false,
      error: userFriendlyError,
    });
  }
});

module.exports = router;
