const fs = require("fs");
const path = require("path");

// Read the HTML file
const htmlContent = fs.readFileSync(
  "/Users/john/coding-practice/setlists/KDG R&B/KDGRB.html",
  "utf8"
);

// Create output directory
const outputDir = "./parsed-songs";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Split content by hr tags (page breaks) which separate songs
const songSections = htmlContent.split(
  /<hr[^>]*style="page-break-before:always;display:none;">/
);

let songCount = 0;
const songs = [];

// Process each section
songSections.forEach((section, index) => {
  if (index === 0) return; // Skip the first empty section

  // Find the song title (text between h1 tags)
  const titleMatch = section.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!titleMatch) return;

  const songTitle = titleMatch[1].trim();
  if (!songTitle) return;

  // Clean up the title
  const cleanTitle = songTitle
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "...")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .trim();

  if (!cleanTitle || cleanTitle.length < 2) return;

  songCount++;

  // Create filename
  const filename = `${songCount}-${cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")}.html`;

  // Extract the content after the title
  const contentAfterTitle = section.substring(section.indexOf("</h1>") + 6);

  // Create the song HTML file
  const songHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${cleanTitle}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .subtitle { color: #666; font-style: italic; }
        .chord { font-weight: bold; color: #0066cc; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        p { margin: 8px 0; }
    </style>
</head>
<body>
    <h1>${cleanTitle}</h1>
    ${contentAfterTitle}
</body>
</html>`;

  // Write the song file
  fs.writeFileSync(path.join(outputDir, filename), songHtml);

  songs.push({
    number: songCount,
    title: cleanTitle,
    filename: filename,
  });

  console.log(`Created: ${filename} - "${cleanTitle}"`);
});

// Create index file
const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>KDG R&B Songs Index</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .song-list { margin: 20px 0; }
        .song-item { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .song-item:hover { background-color: #f5f5f5; }
        .song-number { font-weight: bold; color: #0066cc; }
        .song-title { font-size: 18px; margin: 5px 0; }
        .song-filename { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <h1>KDG R&B Songs Index</h1>
    <p>Total songs: ${songCount}</p>
    
    <div class="song-list">
        ${songs
          .map(
            (song) => `
        <div class="song-item">
            <div class="song-number">#${song.number}</div>
            <div class="song-title">${song.title}</div>
            <div class="song-filename">${song.filename}</div>
        </div>
        `
          )
          .join("")}
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, "index.html"), indexHtml);

console.log(
  `\nParsing complete! Created ${songCount} song files and index.html`
);
console.log(`Output directory: ${outputDir}`);
