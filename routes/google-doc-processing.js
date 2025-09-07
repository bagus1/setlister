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

// Function to format HTML for better readability and parsing
function formatHtml(html) {
  if (!html || typeof html !== "string") return html;

  let formatted = html
    // Add line breaks after closing tags
    .replace(/<\/([^>]+)>/g, "</$1>\n")
    // Add line breaks before opening tags (but not the first one)
    .replace(/(?<!^)(<[^\/][^>]*>)/g, "\n$1")
    // Clean up multiple line breaks
    .replace(/\n\s*\n/g, "\n")
    // Trim whitespace from each line
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  return formatted;
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
    let rawSongs = bodyContent.split(songSeparator);

    console.log(
      `Found ${rawSongs.length} raw sections using page break separator`
    );

    // Debug: Check if we're finding the page break separator
    const separatorCount = (
      bodyContent.match(
        new RegExp(songSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      ) || []
    ).length;
    console.log(`Page break separator occurrences: ${separatorCount}`);

    // If no sections found, try alternative page break patterns
    if (rawSongs.length <= 1) {
      console.log(
        "No sections found with primary separator, trying alternatives..."
      );

      // Try alternative page break patterns
      const altSeparators = [
        '<hr style="page-break-before:always;">',
        '<hr style="page-break-before:always;display:none;">',
        '<hr style="page-break-before:always;display:none;height:0;overflow:hidden;">',
        '<div style="page-break-before:always;"></div>',
        '<div style="page-break-before:always;height:0;overflow:hidden;"></div>',
      ];

      for (const altSep of altSeparators) {
        const altSongs = bodyContent.split(altSep);
        if (altSongs.length > 1) {
          console.log(
            `Found ${altSongs.length} sections using alternative separator: ${altSep}`
          );
          rawSongs = altSongs;
          break;
        }
      }
    }

    // Debug: Analyze first few sections to understand HTML structure
    console.log("=== HTML Structure Analysis ===");
    for (let i = 0; i < Math.min(3, rawSongs.length); i++) {
      const content = rawSongs[i].trim();
      if (content) {
        console.log(`Section ${i} structure:`, {
          length: content.length,
          hasPTags: content.includes("<p"),
          hasDivTags: content.includes("<div"),
          hasSpanTags: content.includes("<span"),
          hasH1Tags: content.includes("<h1"),
          hasH2Tags: content.includes("<h2"),
          hasH3Tags: content.includes("<h3"),
          firstTags: content.match(/<[^>]+>/g)?.slice(0, 5) || [],
          preview: content.substring(0, 300),
        });
      }
    }
    console.log("=== End HTML Structure Analysis ===");

    // Filter out empty sections and merge adjacent empty ones
    const songs = [];
    for (let i = 0; i < rawSongs.length; i++) {
      const content = rawSongs[i].trim();
      if (content && content.length > 0) {
        // More lenient content checking - look for any meaningful content
        const hasParagraph = content.match(/<p[^>]*>.*?<\/p>/i);
        const hasDiv = content.match(/<div[^>]*>.*?<\/div>/i);
        const hasSpan = content.match(/<span[^>]*>.*?<\/span>/i);
        const hasTextContent =
          content.replace(/<[^>]*>/g, "").trim().length > 0;

        // Accept sections with any HTML structure that contains text
        const hasAnyHtmlContent = hasParagraph || hasDiv || hasSpan;
        const hasContent = hasAnyHtmlContent && hasTextContent;

        // Debug logging for skipped sections
        if (!hasContent) {
          console.log(`\n=== SECTION ${i} SKIPPED ===`);
          console.log(`Reason: Content validation failed`);
          console.log(`hasParagraph: ${!!hasParagraph}`);
          console.log(`hasDiv: ${!!hasDiv}`);
          console.log(`hasSpan: ${!!hasSpan}`);
          console.log(`hasTextContent: ${!!hasTextContent}`);
          console.log(`hasAnyHtmlContent: ${hasAnyHtmlContent}`);
          console.log(`contentLength: ${content.length}`);
          console.log(`Content preview (first 300 chars):`);
          console.log(content.substring(0, 300));
          console.log(
            `All HTML tags found:`,
            content.match(/<[^>]+>/g)?.slice(0, 10) || []
          );
          console.log(`=== END SKIPPED SECTION ${i} ===\n`);
        } else {
          console.log(`Section ${i} ACCEPTED - hasContent: true`);
        }

        if (hasContent) {
          songs.push(rawSongs[i]);
        }
      } else {
        console.log(
          `Section ${i} SKIPPED - Empty content (length: ${content.length})`
        );
      }
    }

    console.log(`\n=== CONTENT FILTERING SUMMARY ===`);
    console.log(`Raw sections: ${rawSongs.length}`);
    console.log(`Valid sections: ${songs.length}`);
    console.log(`Skipped sections: ${rawSongs.length - songs.length}`);
    console.log(`=== END FILTERING SUMMARY ===\n`);

    // Store section counts for later use
    const sectionCounts = {
      rawSectionsCount: rawSongs.length,
      validSectionsCount: songs.length,
      skippedSectionsCount: rawSongs.length - songs.length,
    };

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

      // Format the HTML for better parsing and debugging
      const formattedContent = formatHtml(songContent);
      console.log(`\n=== SECTION ${index} FORMATTED HTML ===`);
      console.log(formattedContent.substring(0, 500));
      console.log(`=== END SECTION ${index} ===\n`);

      // songCount will be incremented only when we find actual songs

      // Extract song title using detected heading pattern or page break parsing
      let songTitle = "untitled";
      let titleParagraphIndex = -1; // Initialize here for scope

      if (usePageBreakParsing) {
        // Page break parsing: look for the first meaningful content (likely the song title)
        console.log(
          `Section ${index} content preview:`,
          songContent.substring(0, 200)
        );

        // Find ALL paragraphs in the section
        const allParagraphs = songContent.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
        let titleParagraph = null;
        let titleParagraphIndex = -1;

        // Skip paragraphs that are empty or only contain &nbsp; or whitespace
        // Loop through them to find the first one with meaningful content
        for (let i = 0; i < allParagraphs.length; i++) {
          const paragraph = allParagraphs[i];
          const cleanText = paragraph.replace(/<[^>]*>/g, "").trim();
          if (
            cleanText &&
            cleanText.length > 0 &&
            !cleanText.match(/^(&nbsp;|\s)+$/)
          ) {
            titleParagraph = paragraph;
            titleParagraphIndex = i;
            console.log(
              `Section ${index} - Found title paragraph at index ${i}: "${cleanText}"`
            );
            break;
          }
        }

        if (titleParagraph && titleParagraphIndex >= 0) {
          // Use the first meaningful paragraph as the title source
          const cleanText = titleParagraph.replace(/<[^>]*>/g, "").trim();
          console.log(
            `Section ${index} - Title paragraph clean text: "${cleanText}"`
          );

          if (cleanText && cleanText.length > 0) {
            // Extract just the song title from the beginning of the text
            let extractedTitle = cleanText;

            // Stop at common metadata indicators or when we hit chord notation
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
              /\s+[A-G][#b]?\d*\s+/i, // Stop at chord notation like " Asus2 " or " Em "
              /\s+[A-G][#b]?\d*$/i, // Stop at chord notation at end like " G"
              /\s+Jam\s+in\s+/i, // Stop at "Jam in" patterns
              /\s+in\s+[A-G][#b]?\s*$/i, // Stop at "in G" patterns
            ];

            for (const pattern of stopPatterns) {
              const match = cleanText.match(pattern);
              if (match) {
                extractedTitle = cleanText.substring(0, match.index).trim();
                break;
              }
            }

            // Additional cleanup: stop at chord patterns that weren't caught by stopPatterns
            // Look for patterns like "TitleAsus2" or "TitleEm" where chord notation is attached
            // But be more careful to avoid false matches in words like "Alabama"
            const chordAttachedMatch = extractedTitle.match(
              /^(.+?)([A-G][#b]?\d+)([A-Z][a-z]|$)/i
            );
            if (
              chordAttachedMatch &&
              chordAttachedMatch[2] &&
              chordAttachedMatch[2].length > 1
            ) {
              console.log(
                `Section ${index} - Found attached chord: "${chordAttachedMatch[2]}" in "${chordAttachedMatch[0]}"`
              );
              // Take only the part before the chord
              extractedTitle = chordAttachedMatch[1].trim();
              console.log(
                `Section ${index} - Title after attached chord cleanup: "${extractedTitle}"`
              );
            }

            // Clean up any remaining artifacts
            extractedTitle = extractedTitle
              .replace(/\s+/g, " ") // Normalize whitespace
              .replace(/&nbsp;/g, " ") // Replace HTML non-breaking spaces
              .replace(/&amp;/g, "&") // Replace HTML ampersands
              .replace(/&lt;/g, "<") // Replace HTML less than
              .replace(/&gt;/g, ">") // Replace HTML greater than
              .replace(/&quot;/g, '"') // Replace HTML quotes
              .replace(/&#39;/g, "'") // Replace HTML apostrophes
              .trim();

            // Only use this as title if it's reasonable length (not too long)
            if (
              extractedTitle &&
              extractedTitle.length > 0 &&
              extractedTitle.length < 200 // Increased from 100 to 200
            ) {
              songTitle = sanitizeFilename(extractedTitle);
              console.log(
                `Song ${index}: Page break parsing - Extracted title: "${extractedTitle}" -> sanitized: "${songTitle}"`
              );
            } else {
              console.log(
                `Song ${index}: Title rejected - length: ${extractedTitle?.length || 0}, content: "${extractedTitle?.substring(0, 50) || "undefined"}"`
              );
            }
          } else {
            console.log(
              `Section ${index} - No clean text found in title paragraph`
            );
          }
        } else {
          console.log(`Section ${index} - No meaningful paragraph found`);
        }

        // If we still don't have a title, try the old line-based approach as fallback
        if (songTitle === "untitled") {
          const lines = songContent.split("\n").filter((line) => line.trim());
          if (lines.length > 0) {
            const firstLine = lines[0];
            const cleanText = firstLine.replace(/<[^>]*>/g, "").trim();
            if (cleanText && cleanText.length > 0 && cleanText.length < 200) {
              // Increased from 100 to 200
              songTitle = sanitizeFilename(cleanText);
              console.log(
                `Song ${index}: Page break parsing (fallback) - Extracted title: "${cleanText}" -> sanitized: "${songTitle}"`
              );
            } else {
              console.log(
                `Song ${index}: Fallback title rejected - length: ${cleanText?.length || 0}, content: "${cleanText?.substring(0, 50) || "undefined"}"`
              );
            }
          }
        }

        // If we STILL don't have a title, try to extract any meaningful text from the beginning
        if (songTitle === "untitled") {
          // Get all text content from the section and take the first reasonable chunk
          const allText = songContent
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (allText && allText.length > 0) {
            // Take the first 50 characters as a potential title
            const potentialTitle = allText.substring(0, 50).trim();
            if (potentialTitle.length > 3) {
              // At least 3 characters
              songTitle = sanitizeFilename(potentialTitle);
              console.log(
                `Song ${index}: Page break parsing (aggressive fallback) - Extracted title: "${potentialTitle}" -> sanitized: "${songTitle}"`
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

        // Extract song content - use the rest as song content source
        let songBodyContent;
        if (usePageBreakParsing && titleParagraphIndex >= 0) {
          // For page break parsing, use all paragraphs after the title paragraph
          const remainingParagraphs = allParagraphs.slice(
            titleParagraphIndex + 1
          );
          songBodyContent = remainingParagraphs.join("\n").trim();
          console.log(
            `Section ${index} - Using ${remainingParagraphs.length} paragraphs after title as song content`
          );
        } else {
          // For heading-based parsing, remove the heading as before
          songBodyContent = songContent
            .replace(
              new RegExp(
                `<${detectedHeadingLevel}[^>]*>.*?<\/${detectedHeadingLevel}>`,
                "gi"
              ),
              ""
            )
            .trim();
        }
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
      // Include section counts for session storage
      rawSectionsCount: sectionCounts.rawSectionsCount,
      validSectionsCount: sectionCounts.validSectionsCount,
      skippedSectionsCount: sectionCounts.skippedSectionsCount,
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

    // Extract section counts from the result for session storage
    const sectionCounts = {
      rawSectionsCount: result.rawSectionsCount || 0,
      validSectionsCount: result.validSectionsCount || 0,
      skippedSectionsCount: result.skippedSectionsCount || 0,
    };

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

    // Update section counts to reflect actual processed songs
    sectionCounts.validSectionsCount = processedSongs.length;
    sectionCounts.rawSectionsCount = Math.max(
      sectionCounts.rawSectionsCount,
      processedSongs.length
    );
    sectionCounts.skippedSectionsCount =
      sectionCounts.rawSectionsCount - sectionCounts.validSectionsCount;

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

    // Check if this is from the new-doc flow with radio button choice
    const listType = req.body.listType;
    const createSetlist = listType !== "repertoire";

    // Only create setlist if requested
    let setlist = null;
    if (createSetlist) {
      try {
        setlist = await prisma.setlist.create({
          data: {
            title: setlistTitle,
            date: new Date(),
            bandId: parseInt(bandId),
            createdById: req.session.user.id,
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
      } catch (error) {
        console.error("Error creating setlist:", error);
        res.status(500).json({
          success: false,
          error: "Failed to create setlist for Google Doc import",
        });
        return;
      }
    }

    // Store the Google Doc data in session for quickset confirmation
    req.session.quickSetData = {
      bandId: parseInt(bandId),
      setlistId: createSetlist ? setlist.id : null, // Only create setlist if requested
      sets: quicksetData.sets,
      songs: quicksetData.songs,
      googleDocData: {
        ...essentialData,
        ...sectionCounts, // Include the section counts
      }, // Store original Google Doc data plus section counts
      isGoogleDocImport: true, // Flag to indicate this is from Google Doc
      isNewList: !!listType, // Flag to indicate this is from new-doc flow
      createSetlist: createSetlist,
    };

    // Redirect to the quickset confirmation page
    res.redirect(`/bands/${bandId}/quick-set/confirm`);
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
