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
    res.render("legal/document-new", {
      title: "Terms of Service",
      pageTitle: "Terms of Service",
      marqueeTitle: "Legal",
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
    res.render("legal/document-new", {
      title: "Privacy Policy",
      pageTitle: "Privacy Policy",
      marqueeTitle: "Legal",
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
    res.render("legal/document-new", {
      title: "DMCA / Copyright Policy",
      pageTitle: "DMCA / Copyright Policy",
      marqueeTitle: "Legal",
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
  res.render("legal/index-new", {
    title: "Legal Documents",
    pageTitle: "Legal Documents",
    marqueeTitle: "Legal",
    currentUrl: req.originalUrl,
  });
});

// Redirect old URLs to help section
router.get("/recording-tips", (req, res) => {
  res.redirect("/help/recording-instructions");
});

router.get("/recording-instructions", (req, res) => {
  res.redirect("/help/recording-instructions");
});

router.get("/google-doc-formatting-guide", (req, res) => {
  res.redirect("/help/google-doc-formatting");
});

module.exports = router;
