const fs = require("fs");

// Read the JSON results
const results = JSON.parse(
  fs.readFileSync("./song-database-matches.json", "utf8")
);

// Function to create HTML table row
function createHTMLRow(
  filename,
  extractedTitle,
  matchType,
  dbId,
  dbTitle,
  metadata
) {
  const matchIcon =
    matchType === "✅ EXACT" ? "✅" : matchType === "🔍 SIMILAR" ? "🔍" : "❌";

  // Create clickable link for filename
  const filenameLink = `<a href="http://127.0.0.1:5500/KDGRB/songs/${encodeURIComponent(filename)}" target="_blank" style="color: #007bff; text-decoration: none;">${filename}</a>`;

  return `
    <tr>
      <td>${filenameLink}</td>
      <td>${extractedTitle || ""}</td>
      <td>${matchIcon} ${matchType}</td>
      <td>${dbId || ""}</td>
      <td>${dbTitle || ""}</td>
      <td>${metadata || ""}</td>
    </tr>`;
}

// Generate HTML content
let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Song Database Matching Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; text-align: center; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .exact { background-color: #d4edda; }
        .similar { background-color: #fff3cd; }
        .no-match { background-color: #f8d7da; }
        .summary { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border-radius: 5px; }
        .exact-stat { background-color: #d4edda; }
        .similar-stat { background-color: #fff3cd; }
        .no-match-stat { background-color: #f8d7da; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>🎵 Song Database Matching Results Grid</h1>
    
    <div class="summary">
        <h2>📊 Summary Statistics</h2>
        <div class="stats">`;

// Calculate statistics
const exactMatches = results.filter((r) => r.exactMatch).length;
const similarMatches = results.filter(
  (r) => r.similarMatches.length > 0 && !r.exactMatch
).length;
const noMatches = results.filter(
  (r) => !r.exactMatch && r.similarMatches.length === 0
).length;
const total = results.length;

htmlContent += `
            <div class="stat-box exact-stat">
                <h3>✅ Exact Matches</h3>
                <h2>${exactMatches}</h2>
                <p>${((exactMatches / total) * 100).toFixed(1)}%</p>
            </div>
            <div class="stat-box similar-stat">
                <h3>🔍 Similar Matches</h3>
                <h2>${similarMatches}</h2>
                <p>${((similarMatches / total) * 100).toFixed(1)}%</p>
            </div>
            <div class="stat-box no-match-stat">
                <h3>❌ No Matches</h3>
                <h2>${noMatches}</h2>
                <p>${((noMatches / total) * 100).toFixed(1)}%</p>
            </div>
            <div class="stat-box">
                <h3>🎯 Overall Success</h3>
                <h2>${(((exactMatches + similarMatches) / total) * 100).toFixed(1)}%</h2>
                <p>Total: ${total}</p>
            </div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>FILENAME (Click to View)</th>
                <th>EXTRACTED TITLE</th>
                <th>MATCH TYPE</th>
                <th>DB ID</th>
                <th>DATABASE TITLE</th>
                <th>METADATA</th>
            </tr>
        </thead>
        <tbody>`;

// Process each result
results.forEach((result, index) => {
  const { filename, extractedTitle, exactMatch, similarMatches } = result;

  if (exactMatch) {
    // Exact match
    const metadata = [];
    if (exactMatch.key) metadata.push(`Key: ${exactMatch.key}`);
    if (exactMatch.time) metadata.push(`Time: ${exactMatch.time}`);
    if (exactMatch.bpm) metadata.push(`BPM: ${exactMatch.bpm}`);

    htmlContent += createHTMLRow(
      filename,
      extractedTitle,
      "✅ EXACT",
      exactMatch.id,
      exactMatch.title,
      metadata.join(", ")
    );
  } else if (similarMatches.length > 0) {
    // Similar match
    const metadata = [];
    if (similarMatches[0].key) metadata.push(`Key: ${similarMatches[0].key}`);
    if (similarMatches[0].time)
      metadata.push(`Time: ${similarMatches[0].time}`);
    if (similarMatches[0].bpm) metadata.push(`BPM: ${similarMatches[0].bpm}`);

    htmlContent += createHTMLRow(
      filename,
      extractedTitle,
      "🔍 SIMILAR",
      similarMatches[0].id,
      similarMatches[0].title,
      metadata.join(", ")
    );
  } else {
    // No match
    htmlContent += createHTMLRow(
      filename,
      extractedTitle,
      "❌ NO MATCH",
      "",
      "",
      ""
    );
  }
});

htmlContent += `
        </tbody>
    </table>
</body>
</html>`;

// Write HTML file
fs.writeFileSync("./song-database-results.html", htmlContent);
console.log("✅ HTML file created: song-database-results.html");
console.log(
  `📊 Processed ${total} songs with ${exactMatches} exact matches, ${similarMatches} similar matches, and ${noMatches} no matches.`
);
