/**
 * Google Doc HTML Processor
 * Converts Google Doc HTML to TinyMCE-compatible content
 * Based on the sophisticated logic from KDGRB/process-all-songs-to-gig-docs.js
 */

/**
 * Process Google Doc HTML content to make it TinyMCE compatible
 * @param {string} htmlContent - Raw HTML from Google Doc
 * @returns {Object} - { content: string, urls: Array }
 */
function processGoogleDocHtml(htmlContent) {
  console.log("=== GOOGLE DOC HTML PROCESSING DEBUG ===");
  console.log("Input HTML length:", htmlContent.length);
  console.log(
    "Input HTML preview (first 500 chars):",
    htmlContent.substring(0, 500)
  );

  // Extract URLs with link text before processing content
  const urls = [];

  // Extract anchor tags with href and link text
  const anchorRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(htmlContent)) !== null) {
    const url = anchorMatch[1];
    const linkText = anchorMatch[2].replace(/<[^>]*>/g, "").trim();

    if (url.startsWith("http")) {
      urls.push({
        url: url,
        description: linkText || url,
        type: determineLinkType(url, linkText),
      });
    }
  }

  // Also extract any standalone URLs that weren't in anchor tags
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  const standaloneUrls = htmlContent.match(urlRegex) || [];

  standaloneUrls.forEach((url) => {
    // Check if this URL wasn't already captured in anchor tags
    if (!urls.some((u) => u.url === url)) {
      urls.push({
        url: url,
        description: url,
        type: determineLinkType(url, url),
      });
    }
  });

  // Extract the body content
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    let bodyContent = bodyMatch[1];
    console.log("Body content extracted, length:", bodyContent.length);
    console.log(
      "Body content preview (first 500 chars):",
      bodyContent.substring(0, 500)
    );

    // Remove the title (h1 tag) from the content
    bodyContent = bodyContent.replace(/<h1[^>]*>.*?<\/h1>/gi, "");
    console.log("After removing H1 tags, length:", bodyContent.length);

    // Remove the first hr tag from the content
    bodyContent = bodyContent.replace(/<hr[^>]*>/, "");
    console.log("After removing HR tags, length:", bodyContent.length);

    // Remove all URL links from the content (more aggressive cleaning)
    bodyContent = bodyContent.replace(/<a[^>]*>.*?<\/a>/g, ""); // Remove ALL anchor tags
    bodyContent = bodyContent.replace(/https?:\/\/[^\s<>"']+/g, ""); // Remove standalone URLs
    console.log("After removing links and URLs, length:", bodyContent.length);

    // Clean up any remaining empty spans or paragraphs that might have been left behind
    bodyContent = bodyContent.replace(/<span><\/span>/g, "");
    bodyContent = bodyContent.replace(/<p><\/p>/g, "");
    bodyContent = bodyContent.replace(/<p><span><\/span><\/p>/g, "");

    // Additional aggressive cleaning for any remaining problematic tags
    bodyContent = bodyContent.replace(/<a[^>]*>/g, ""); // Remove any remaining opening anchor tags
    bodyContent = bodyContent.replace(/<\/a>/g, ""); // Remove any remaining closing anchor tags

    // Convert specific CSS classes to TinyMCE indentation format
    // .c21 (36pt) -> padding-left: 40px (first level)
    // .c26 (72pt) -> padding-left: 80px (second level)
    // .c48 (108pt) -> padding-left: 120px (third level)
    // .c85 (144pt) -> padding-left: 160px (fourth level)

    // Replace .c21 class with padding-left: 40px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc21\b[^"]*"/g,
      'style="padding-left: 40px;"'
    );

    // Replace .c26 class with padding-left: 80px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc26\b[^"]*"/g,
      'style="padding-left: 80px;"'
    );

    // Replace .c48 class with padding-left: 120px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc48\b[^"]*"/g,
      'style="padding-left: 120px;"'
    );

    // Replace .c85 class with padding-left: 160px
    bodyContent = bodyContent.replace(
      /class="[^"]*\bc85\b[^"]*"/g,
      'style="padding-left: 160px;"'
    );

    // Remove all other CSS classes and simplify the HTML structure
    bodyContent = bodyContent.replace(/class="[^"]*"/g, "");
    console.log("After removing CSS classes, length:", bodyContent.length);

    // Remove complex inline styles and keep only the padding-left we added
    bodyContent = bodyContent.replace(
      /style="[^"]*(?:padding-left: 40px|padding-left: 80px|padding-left: 120px|padding-left: 160px)[^"]*"/g,
      (match) => {
        if (match.includes("padding-left: 40px"))
          return 'style="padding-left: 40px;"';
        if (match.includes("padding-left: 80px"))
          return 'style="padding-left: 80px;"';
        if (match.includes("padding-left: 120px"))
          return 'style="padding-left: 120px;"';
        if (match.includes("padding-left: 160px"))
          return 'style="padding-left: 160px;"';
        return match;
      }
    );
    console.log("After processing inline styles, length:", bodyContent.length);

    // Remove all other style attributes that don't contain padding-left
    bodyContent = bodyContent.replace(/style="(?!.*padding-left)[^"]*"/g, "");

    // Clean up empty attributes
    bodyContent = bodyContent.replace(/\s+>/g, ">");
    bodyContent = bodyContent.replace(/>\s+</g, "><");
    console.log("After final cleanup, length:", bodyContent.length);
    console.log(
      "Final processed content preview (first 500 chars):",
      bodyContent.substring(0, 500)
    );
    console.log("URLs extracted:", urls.length);
    urls.forEach((url, index) => {
      console.log(`  URL ${index + 1}: ${url.url} (${url.type})`);
    });

    return { content: bodyContent, urls: urls };
  }

  // Fallback to the full content if extraction fails
  console.log("WARNING: Body extraction failed, using fallback content");
  console.log("Fallback content length:", htmlContent.length);
  return { content: htmlContent, urls: urls };
}

/**
 * Determine link type based on URL and description
 * @param {string} url - The URL
 * @param {string} description - Link description
 * @returns {string} - Link type
 */
function determineLinkType(url, description) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "youtube";
  } else if (url.includes("spotify.com")) {
    return "spotify";
  } else if (
    url.includes("apple.com/music") ||
    url.includes("music.apple.com")
  ) {
    return "apple_music";
  } else if (
    url.includes("amazon.com/music") ||
    url.includes("music.amazon.com")
  ) {
    return "amazon_music";
  } else if (url.includes("bandcamp.com")) {
    return "bandcamp";
  } else if (url.includes("soundcloud.com")) {
    return "soundcloud";
  } else if (url.includes("genius.com") || url.includes("lyrics.genius.com")) {
    return "lyrics";
  } else if (
    url.includes("ultimate-guitar.com") ||
    url.includes("tabs.ultimate-guitar.com")
  ) {
    return "guitar_tabs";
  } else if (url.includes("chordie.com")) {
    return "guitar_tabs";
  } else if (url.includes("tabs.ultimate-guitar.com")) {
    return "guitar_tabs";
  } else if (url.includes("e-chords.com")) {
    return "guitar_tabs";
  } else if (url.includes("guitaretab.com")) {
    return "guitar_tabs";
  } else if (url.includes("azlyrics.com") || url.includes("lyrics.com")) {
    return "lyrics";
  } else if (url.includes("metrolyrics.com")) {
    return "lyrics";
  } else if (url.includes("songlyrics.com")) {
    return "lyrics";
  } else if (url.includes("musixmatch.com")) {
    return "lyrics";
  } else if (url.includes("discogs.com")) {
    return "discography";
  } else if (url.includes("allmusic.com")) {
    return "discography";
  } else if (url.includes("rateyourmusic.com")) {
    return "discography";
  } else if (url.includes("last.fm")) {
    return "discography";
  } else if (url.includes("wikipedia.org")) {
    return "information";
  } else if (url.includes("biography.com")) {
    return "information";
  } else if (url.includes("rollingstone.com")) {
    return "information";
  } else if (url.includes("pitchfork.com")) {
    return "information";
  } else if (url.includes("npr.org")) {
    return "information";
  } else if (url.includes("billboard.com")) {
    return "information";
  } else if (
    url.includes("font") ||
    url.includes("woff") ||
    url.includes("ttf")
  ) {
    return "font_resource";
  } else {
    return "other";
  }
}

module.exports = {
  processGoogleDocHtml,
  determineLinkType,
};
