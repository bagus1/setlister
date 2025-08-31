const express = require("express");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Load Google service account credentials
const CREDENTIALS_PATH = path.join(
  __dirname,
  "..",
  "setlister-api-44d3352d2811.json"
);
const SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

// Initialize Google Drive API client for exporting documents
function getGoogleDriveClient() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
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
  console.log("=== Starting song extraction ===");

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

    console.log(`Found ${songs.length} song sections`);

    // First pass: Detect what heading levels are used for song titles
    let detectedHeadingLevel = null;
    let headingPattern = null;

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

    if (!detectedHeadingLevel) {
      console.log(`No heading tags detected, falling back to H1 pattern`);
      detectedHeadingLevel = "h1";
      headingPattern = /<h1[^>]*>(.*?)<\/h1>/gi;
    }

    // Second pass: Extract songs using detected heading pattern
    let songCount = 0;
    const extractedSongs = [];

    songs.forEach((songContent, index) => {
      // Skip empty sections
      if (!songContent.trim()) {
        return;
      }

      // songCount will be incremented only when we find actual songs

      // Extract song title using detected heading pattern
      let songTitle = "untitled";

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

        extractedSongs.push({
          index: songCount,
          title: songTitle,
          contentLength: songBodyContent.length,
          contentPreview:
            songBodyContent.substring(0, 200) +
            (songBodyContent.length > 200 ? "..." : ""),
          originalIndex: index,
        });

        console.log(
          `Song ${songCount}: "${songTitle}" - Content length: ${songBodyContent.length}`
        );
      } else {
        console.log(`Section ${index}: Skipped (no song title or metadata)`);
      }
    });

    console.log(`=== Song extraction completed: ${songCount} songs found ===`);

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

    // Process the HTML content directly
    const result = processHtmlContent(htmlContent);

    console.log("=== Google Doc processing completed successfully ===");
    res.json({
      success: true,
      message: "Google Doc processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("=== ERROR processing Google Doc ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    console.error("=== END ERROR ===");

    res.status(500).json({
      success: false,
      error: error.message || "Failed to process Google Doc",
    });
  }
});

module.exports = router;
