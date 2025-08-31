const fs = require("fs");
const path = require("path");

// Read the HTML file - updated paths since script is now in KDGRB directory
const htmlFilePath = "./KDGRB.html";
const outputDir = "./songs";

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Function to sanitize filename (remove special characters)
function sanitizeFilename(filename) {
  console.log(`DEBUG: sanitizeFilename input: "${filename}"`);
  const result = filename
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
  console.log(`DEBUG: sanitizeFilename output: "${result}"`);
  return result;
}

// Test the function
console.log("Testing sanitizeFilename function:");
const testResult = sanitizeFilename("Don&rsquo;t Wanna Fight No More");
console.log(`Test result: "${testResult}"`);

try {
  console.log("Reading HTML file...");
  const htmlContent = fs.readFileSync(htmlFilePath, "utf8");

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

  // Split by the hr tags that delineate songs
  const songSeparator = '<hr style="page-break-before:always;display:none;">';
  const songs = bodyContent.split(songSeparator);

  console.log(`Found ${songs.length} song sections`);

  let songCount = 0;

  songs.forEach((songContent, index) => {
    // Skip empty sections
    if (!songContent.trim()) {
      return;
    }

    songCount++;

    // Extract song title from h1 tag - try multiple patterns
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
      // Pattern 2: <h1...><span...>title</span> - use non-greedy match to capture full content
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
        } else {
          // Debug: log what we're looking at
          console.log(
            `Could not extract title for song ${index}, content preview:`,
            songContent.substring(0, 200)
          );
        }
      }
    }

    // Create filename with song title
    const filename = `song-${String(index).padStart(3, "0")}-${songTitle}.html`;
    const filePath = path.join(outputDir, filename);

    console.log(`Song ${index}: Creating file: ${filename}`);

    // Build the complete HTML structure for each song
    let fullSongContent = songContent.trim();
    if (index > 0) {
      fullSongContent = songSeparator + "\n" + fullSongContent;
    }

    // Create complete HTML document
    const completeHtml = `<!DOCTYPE html>
<html>
<head>
${headContent}
</head>
<body>
${fullSongContent}
</body>
</html>`;

    // Write the complete song HTML file
    fs.writeFileSync(filePath, completeHtml, "utf8");

    console.log(`Created: ${filename}`);
  });

  console.log(`\nSuccessfully created ${songCount} song files in ${outputDir}`);
} catch (error) {
  console.error("Error parsing HTML:", error);
}
