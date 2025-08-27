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

module.exports = router;
