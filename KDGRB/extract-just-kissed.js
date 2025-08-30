const fs = require("fs");

// Read the HTML file
const htmlContent = fs.readFileSync(
  "/Users/john/coding-practice/setlists/KDG R&B/KDGRB.html",
  "utf8"
);

// Find the content around "just kissed my baby"
const searchTerm = "just kissed my baby";
const index = htmlContent.toLowerCase().indexOf(searchTerm);

if (index === -1) {
  console.log("Could not find 'just kissed my baby' in the HTML");
  process.exit(1);
}

// Extract a reasonable amount of content around the search term
const startIndex = Math.max(0, index - 2000);
const endIndex = Math.min(htmlContent.length, index + 5000);
const extractedContent = htmlContent.substring(startIndex, endIndex);

// Clean up the HTML and extract just the text content
const cleanContent = extractedContent
  .replace(/<[^>]+>/g, " ") // Remove HTML tags
  .replace(/&nbsp;/g, " ") // Replace HTML entities
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ") // Normalize whitespace
  .trim();

console.log("=== EXTRACTED CONTENT AROUND 'just kissed my baby' ===\n");
console.log(cleanContent);

// Also try to find any links in the content
const linkRegex = /https?:\/\/[^\s<>"']+/g;
const links = extractedContent.match(linkRegex);

if (links && links.length > 0) {
  console.log("\n=== LINKS FOUND ===");
  links.forEach((link, i) => {
    console.log(`${i + 1}. ${link}`);
  });
}

// Save the extracted content to a file
fs.writeFileSync("just-kissed-extracted.txt", cleanContent);
console.log("\nExtracted content saved to 'just-kissed-extracted.txt'");
