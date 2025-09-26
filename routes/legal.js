const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { marked } = require("marked");
const router = express.Router();

// Configure marked options for better HTML output
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Helper function to read and convert markdown to HTML
async function renderMarkdownFile(filename) {
  try {
    const filePath = path.join(__dirname, "..", filename);
    const markdownContent = await fs.readFile(filePath, "utf8");
    const htmlContent = marked(markdownContent);
    return htmlContent;
  } catch (error) {
    console.error(`Error reading markdown file ${filename}:`, error);
    return "<p>Document not found.</p>";
  }
}

// Terms of Service
router.get("/terms", async (req, res) => {
  try {
    const htmlContent = await renderMarkdownFile("tos.md");
    res.render("legal/document", {
      title: "Terms of Service",
      content: htmlContent,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    console.error("Error rendering Terms of Service:", error);
    res.status(500).render("error", {
      message: "Error loading Terms of Service",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

// Privacy Policy
router.get("/privacy", async (req, res) => {
  try {
    const htmlContent = await renderMarkdownFile("privacy.md");
    res.render("legal/document", {
      title: "Privacy Policy",
      content: htmlContent,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    console.error("Error rendering Privacy Policy:", error);
    res.status(500).render("error", {
      message: "Error loading Privacy Policy",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

// DMCA Policy
router.get("/dmca", async (req, res) => {
  try {
    const htmlContent = await renderMarkdownFile("dmca.md");
    res.render("legal/document", {
      title: "DMCA / Copyright Policy",
      content: htmlContent,
      currentUrl: req.originalUrl,
    });
  } catch (error) {
    console.error("Error rendering DMCA Policy:", error);
    res.status(500).render("error", {
      message: "Error loading DMCA Policy",
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

// Legal documents index page
router.get("/", (req, res) => {
  res.render("legal/index", {
    title: "Legal Documents",
    currentUrl: req.originalUrl,
  });
});

// GET /legal/google-doc-formatting-guide - Google Doc formatting guide
router.get("/google-doc-formatting-guide", (req, res) => {
  const htmlContent = `
        
    <div class="dark-mode-container">
      <div class="alert alert-info">
      <h3>🎵 TL;DR - Quick Formatting Rules</h3>
      <ul>
        <li><strong>Use page breaks</strong> (Ctrl+Enter / Cmd+Enter) to separate songs</li>
        <li><strong>Put the song title on the first line</strong> of each page</li>
        <li><strong>Use consistent formatting</strong> for song titles (same font, size, style)</li>
        <li><strong>Avoid empty sections</strong> between songs</li>
        <li><strong>Keep titles clean</strong> - no chords, metadata, or extra text in title</li>
      </ul>
    </div>

    <h2>Detailed Formatting Guide</h2>
    
    <h3>1. Song Separation</h3>
    <p>Each song should be separated by a <strong>page break</strong> (Ctrl+Enter on PC, Cmd+Enter on Mac). This creates a visual separation that our parser can detect.</p>
    
    <p><strong>To verify your songs are separated properly:</strong></p>
    <ul>
      <li><strong>Turn on non-printing characters:</strong>
        <ul>
                       <li><strong>Mac:</strong> View → Show → Non-printing characters (or Cmd+Shift+P)</li>
                         <li><strong>PC:</strong> View → Show → Non-printing characters (or Ctrl+Shift+P)</li>
        </ul>
      </li>
      <li><strong>Look for this after each song:</strong> <span style="color: blue; font-family: monospace;">-------- Page break --------¶</span></li>
    </ul>
    
    <h3>2. Song Title Format</h3>
    <p>The <strong>first line</strong> of each page should contain only the song title. Avoid adding:</p>
    <ul>
      <li>Chords (G, D7, C, etc.)</li>
      <li>Metadata (Chords by, Author, etc.)</li>
      <li>Extra text or descriptions</li>
    </ul>
    
    <h3>3. Consistent Styling</h3>
    <p>Use the same formatting for all song titles:</p>
    <ul>
      <li>Same font family (Arial, Courier, etc.)</li>
      <li>Same font size (12pt, 18pt, etc.)</li>
      <li>Same font weight (normal, bold)</li>
    </ul>
    
    <h3>4. Content Structure</h3>
    <p>After the title paragraph, you can add:</p>
    <ul>
      <li>Lyrics</li>
      <li>Chord charts</li>
      <li>Notes and instructions</li>
      <li>Any other song-related content</li>
    </ul>
    
    <h3>5. Common Issues & Solutions</h3>
    
    <h4>Problem: Songs not being detected</h4>
    <p><strong>Solution:</strong> Ensure each song starts with a page break and has a clear title in the first paragraph.</p>
    
    <h4>Problem: Too many sections skipped</h4>
    <p><strong>Solution:</strong> Remove empty paragraphs or whitespace between songs. Each section should have actual content.</p>
    
    <h4>Problem: Song titles include extra text</h4>
    <p><strong>Solution:</strong> Keep titles clean - just the song name, nothing else.</p>
    
    <h3>6. Example Structure</h3>
    <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;">
[Page Break]
Song Title (first paragraph)
[Content continues...]

[Page Break]
Next Song Title (first paragraph)
[Content continues...]
    </pre>
    
    <h3>7. Testing Your Format</h3>
    <p>After formatting your Google Doc:</p>
    <ol>
      <li>Save the document</li>
      <li>Make sure it's publicly accessible</li>
      <li>Try importing it</li>
      <li>Check the summary panel for section counts</li>
      <li>If sections are skipped, review the formatting</li>
    </ol>
    
    <div class="alert alert-warning">
      <strong>Note:</strong> Our parser works best with documents that have 150 songs or fewer. For very large documents, consider splitting them into multiple files.
    </div>
    </div>
  `;

  res.render("legal/document", {
    title: "Google Doc Formatting Guide",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

module.exports = router;
