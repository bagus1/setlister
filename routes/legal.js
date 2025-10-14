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

// GET /legal/recording-tips - Recording tips and best practices
router.get("/recording-tips", (req, res) => {
  const htmlContent = `
    <div class="">
      <h3>🎙️ Key Takeaways</h3>
      <ul>
        <li><strong>Phone placement matters</strong> - Keep recording device away from vocalists</li>
        <li><strong>Use an audio interface</strong> - Get a balanced mix from your mixer</li>
        <li><strong>Designate a recorder</strong> - Someone who doesn't need the site or doesn't sing during the performance</li>
        <li><strong>Test before the gig</strong> - Do a quick recording to check levels</li>
      </ul>
    </div>

    <h2>Recording Setup Considerations</h2>
    
    <h3>The Phone Proximity Problem</h3>
    <p>
      If you're using the same phone or device to both <strong>view The Band Plan</strong> (for lyrics, chords, etc.) 
      and <strong>record your performance</strong>, you may encounter audio balance issues:
    </p>
    
    <div class="alert alert-warning">
      <strong>⚠️ Issue:</strong> If your device is close to a vocalist who's also viewing it during the performance, 
      their voice may overpower other instruments in the recording since the microphone is so close to them.
    </div>
    
    <h3>Recommended Solutions</h3>
    
    <h4>Option 1: Use an Audio Interface (Best Quality)</h4>
    <p>
      Connect your phone or tablet to your mixing board using an audio interface:
    </p>
    <ul>
      <li><strong>USB Audio Interface</strong> - Connect mixer output to your device (e.g., Focusrite Scarlett Solo, Behringer U-Phoria)</li>
      <li><strong>Direct Line-In</strong> - If your device has a line-in port, connect directly from mixer</li>
      <li><strong>Benefits:</strong> 
        <ul>
          <li>Balanced mix of all instruments</li>
          <li>Professional sound quality</li>
          <li>Control levels from the mixer</li>
        </ul>
      </li>
    </ul>
    
    <h4>Option 2: Designate a Non-Performer as Recorder</h4>
    <p>
      Have someone who doesn't need to view The Band Plan during the performance handle the recording:
    </p>
    <ul>
      <li><strong>Sound person</strong> - If you have a sound engineer, they can record from the booth</li>
      <li><strong>Non-singing member</strong> - A band member who doesn't need to view lyrics/chords</li>
      <li><strong>Friend/audience member</strong> - Someone who can hold a device in a good location</li>
      <li><strong>Benefits:</strong>
        <ul>
          <li>Optimal microphone placement</li>
          <li>No need to worry about viewing the site</li>
          <li>Can monitor recording quality during performance</li>
        </ul>
      </li>
    </ul>
    
    <h4>Option 3: Use a Computer Connected to Your Mixer (Recommended for Best Quality)</h4>
    <p>
      If you already have a computer connected to your mixer (for streaming, recording, or processing), 
      you can use that computer to record directly in The Band Plan:
    </p>
    <ul>
      <li><strong>Open The Band Plan on the mixer computer</strong> - Navigate to your setlist and click "Record This Set"</li>
      <li><strong>Select your audio interface</strong> - When the browser prompts for microphone permission, choose your audio interface from the dropdown</li>
      <li><strong>Get a perfect mix</strong> - The recording will capture exactly what's coming out of your mixer</li>
      <li><strong>Benefits:</strong>
        <ul>
          <li>Professional sound quality from your mixer</li>
          <li>Balanced mix of all instruments and vocals</li>
          <li>No phone proximity issues</li>
          <li>Direct digital connection (no analog degradation)</li>
          <li>Automatic upload when you're done</li>
        </ul>
      </li>
    </ul>
    
    <div class="alert alert-info">
      <strong>💡 Pro Tip:</strong> This is often the best solution if you're already using a laptop for setlists, 
      backing tracks, or streaming. The audio quality will be excellent since it's coming directly from your mixer.
    </div>
    
    <h4>Option 4: Use a Separate Recording Device</h4>
    <p>
      Use a dedicated device just for recording:
    </p>
    <ul>
      <li><strong>Second phone/tablet</strong> - Place it in an optimal location for capturing the full band</li>
      <li><strong>Digital recorder</strong> - Zoom H4n, Tascam DR-40, etc. (you'll need to upload the file afterward)</li>
      <li><strong>Benefits:</strong>
        <ul>
          <li>Dedicated device = better placement options</li>
          <li>No performance interruptions</li>
          <li>Higher quality with professional recorders</li>
        </ul>
      </li>
    </ul>
    
    <h3>Microphone Placement Tips</h3>
    
    <h4>For Phone/Tablet Recording:</h4>
    <ul>
      <li><strong>Center of the room</strong> - Equal distance from all instruments</li>
      <li><strong>Ear level</strong> - Position at listening height (not on the floor or ceiling)</li>
      <li><strong>Away from speakers</strong> - Avoid direct PA bleed</li>
      <li><strong>Stable surface</strong> - Don't let it move during the show</li>
      <li><strong>Check orientation</strong> - Some phones have directional mics - test which side sounds best</li>
    </ul>
    
    <h3>Before You Record</h3>
    
    <h4>Pre-Gig Checklist:</h4>
    <ul>
      <li>✅ <strong>Test record</strong> - Do a 30-second test during sound check</li>
      <li>✅ <strong>Check battery</strong> - Full charge or plugged in</li>
      <li>✅ <strong>Clear storage</strong> - Make sure you have enough space (500MB+ recommended)</li>
      <li>✅ <strong>Set volume levels</strong> - Listen back to your test to check for clipping or low volume</li>
      <li>✅ <strong>Disable notifications</strong> - Turn on Do Not Disturb mode</li>
      <li>✅ <strong>Keep screen on</strong> - The Band Plan handles this automatically</li>
    </ul>
    
    <h3>During Recording</h3>
    
    <ul>
      <li><strong>Don't touch the device</strong> - Handling noise will be captured</li>
      <li><strong>Monitor occasionally</strong> - Glance to make sure recording is still running</li>
      <li><strong>Note any issues</strong> - Remember if there were sound problems for later reference</li>
    </ul>
    
    <h3>After Recording</h3>
    
    <ul>
      <li><strong>Don't close the browser</strong> - Let the upload complete</li>
      <li><strong>Split while fresh</strong> - Mark song boundaries while you remember the set</li>
      <li><strong>Label clearly</strong> - If adding unlisted songs, use accurate titles</li>
    </ul>
    
    <h3>Recommended Equipment (Optional)</h3>
    
    <div class="alert alert-info">
      <p>While you can record great audio with just your phone, here are some affordable upgrades:</p>
      <ul>
        <li><strong>USB Audio Interface</strong> ($50-100) - Focusrite Scarlett Solo, Behringer UMC22</li>
        <li><strong>Lightning to USB adapter</strong> ($15-30) - To connect interface to iPhone/iPad</li>
        <li><strong>USB-C to USB adapter</strong> ($10-20) - For Android devices</li>
        <li><strong>Phone tripod/stand</strong> ($10-25) - Keep device stable</li>
      </ul>
    </div>
    
    <h3>Audio Quality Expectations</h3>
    
    <p><strong>What you'll get:</strong></p>
    <ul>
      <li>✅ Reference recordings for practice and improvement</li>
      <li>✅ Memory of live performances</li>
      <li>✅ Individual song files for sharing</li>
      <li>✅ Documentation of your band's progress</li>
    </ul>
    
    <p><strong>What you won't get:</strong></p>
    <ul>
      <li>❌ Studio-quality multi-track recordings</li>
      <li>❌ Perfect balance without proper equipment</li>
      <li>❌ Isolated instrument tracks (everything is mixed together)</li>
    </ul>
    
    <div class="alert alert-primary">
      <h4>💡 Pro Tip: Build Your Setup Gradually</h4>
      <p class="mb-0">
        Start with just your phone and improve your setup over time. Even a basic recording is valuable 
        for tracking your progress and sharing with bandmates. As you get more serious, invest in 
        better equipment like audio interfaces and dedicated recorders.
      </p>
    </div>
    
    <h3>Getting Help</h3>
    
    <p>
      If you're having issues with recording quality or need advice on equipment, 
      reach out to the community or check our tutorial videos for visual guides on optimal setup.
    </p>
  `;

  res.render("legal/document", {
    title: "Recording Tips & Best Practices",
    content: htmlContent,
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
