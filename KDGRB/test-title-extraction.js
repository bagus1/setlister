const fs = require("fs");

// Read one of the song files to test title extraction
const songContent = fs.readFileSync("songs/song-089.html", "utf8");

console.log("Testing title extraction...");

// Pattern 1: <h1...><span...>title</span>
const titleMatch1 = songContent.match(
  /<h1[^>]*>.*?<span[^>]*>([^<]+)<\/span>/i
);
console.log("Pattern 1 result:", titleMatch1);

// Pattern 2: <h1...>title</h1> (without span)
const titleMatch2 = songContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
console.log("Pattern 2 result:", titleMatch2);

// Let's see what the actual h1 tag looks like
const h1Match = songContent.match(/<h1[^>]*>.*?<\/h1>/i);
console.log("H1 tag found:", h1Match);

// Show a snippet around the h1 tag
const h1Index = songContent.indexOf("<h1");
if (h1Index !== -1) {
  console.log(
    "Content around H1:",
    songContent.substring(h1Index, h1Index + 200)
  );
}
