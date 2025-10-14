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

// Redirect old URL to new one
router.get("/recording-tips", (req, res) => {
  res.redirect("/legal/recording-instructions");
});

// GET /legal/recording-instructions - Recording instructions and best practices
router.get("/recording-instructions", (req, res) => {
  const htmlContent = `
    <div class="alert alert-info">
      <h3>📝 Introduction</h3>
      <p class="mb-0">
        The Band Plan allows you to record your performances directly in your browser, or upload recordings 
        you've made with other equipment. Once uploaded, you can split your full set recording into individual 
        song files that are linked to your setlist for easy playback and sharing.
      </p>
    </div>

    <h2>Recording Instructions</h2>
    
    <h3>How to Record Directly in The Band Plan</h3>
    
    <ol class="mb-4">
      <li class="mb-3">
        <strong>Navigate to your setlist</strong> - Go to the setlist you want to record and click the 
        <span class="badge bg-danger">Record This Set</span> button (located in the Recording panel on the right side).
      </li>
      
      <li class="mb-3">
        <strong>Grant microphone permission</strong> - Your browser will ask for permission to use your microphone. 
        Click "Allow" to begin recording. If you have an audio interface connected, select it from the dropdown.
      </li>
      
      <li class="mb-3">
        <strong>Recording starts immediately</strong> - A floating widget will appear showing the recording timer 
        and waveform. You can minimize this widget if needed.
      </li>
      
      <li class="mb-3">
        <strong>Navigate freely</strong> - While recording, you can browse to other pages on The Band Plan 
        (view different songs, gig docs, print views, etc.). The recording continues in the background.
        <div class="alert alert-warning mt-2">
          <strong>⚠️ Important:</strong> Don't leave The Band Plan site or close your browser tab, 
          or your recording will end.
        </div>
      </li>
      
      <li class="mb-3">
        <strong>Stop when finished</strong> - When your set is complete, click the 
        <span class="badge bg-secondary">Stop</span> button in the recording widget. 
        The recording will be uploaded and you'll be taken to the "Split" page.
      </li>
      
      <li class="mb-3">
        <strong>Split your recording</strong> - On the split page, you can:
        <ul class="mt-2">
          <li>Listen to the full recording with a waveform visualization</li>
          <li>Click and drag on the waveform to select portions of the recording</li>
          <li>Click a song name on the right to assign that region to the song</li>
          <li>Use <kbd>ESC</kbd> to undo the last region if you make a mistake</li>
          <li>Add unlisted songs using the form below the song list (if you played something not in your setlist)</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Process the splits</strong> - Once all songs are assigned, click 
        <span class="badge bg-success">Process Splits</span>. The system will extract each song 
        as a separate MP3 file.
      </li>
      
      <li class="mb-3">
        <strong>Listen to your recordings</strong> - You'll be taken to the Recordings page where 
        you can play all your split songs in order using the master player.
      </li>
    </ol>
    
    <div class="alert alert-success">
      <h4>💡 Pro Tip</h4>
      <p class="mb-0">
        <strong>Try it out first!</strong> Before your actual gig or rehearsal, do a test recording 
        to familiarize yourself with the process and check your audio levels.
      </p>
    </div>
    
    <h3>Splitting Later</h3>
    <p>
      If you're not ready to split your recording immediately, that's okay! You can come back later:
    </p>
    <ol>
      <li>Go to your setlist page</li>
      <li>Click the <span class="badge bg-primary">Recordings</span> button in the Setlist Actions panel</li>
      <li>Click on any recording to view it and access the split page</li>
    </ol>
    
    <hr class="my-5">
    
    <h2>Recording Options: Best to Last</h2>
    <p>Different recording setups provide different audio quality. Here they are, ranked from best to worst:</p>
    
    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">🏆 Best: Record Separately and Upload MP3s</h4>
        <p>
          For the absolute best quality, record with dedicated equipment and upload your files:
        </p>
        <ul>
          <li>Use a digital recorder (Zoom H4n, Tascam DR-40, etc.) or studio equipment</li>
          <li>Record in a high-quality format</li>
          <li>Export as MP3 for manageable file sizes</li>
          <li>Go to your setlist's Recordings page and use the upload form</li>
        </ul>
        <p class="mb-0"><strong>Why this is best:</strong> Professional equipment, no browser limitations, full control over recording settings.</p>
      </div>
    </div>
    
    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">🥈 Next Best: Computer Connected to Mixer</h4>
        <p>
          If you have a computer connected to your mixer (for streaming, backing tracks, etc.):
        </p>
        <ul>
          <li>Open The Band Plan on that computer</li>
          <li>Navigate to your setlist and click "Record This Set"</li>
          <li>Select your audio interface when prompted</li>
          <li>Get a perfect mix directly from your mixer</li>
        </ul>
        <p class="mb-0"><strong>Why this works:</strong> Professional sound quality, balanced mix, direct digital connection, automatic upload.</p>
      </div>
    </div>
    
    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">🥉 Next Best: Audio Interface on Phone/Tablet</h4>
        <p>
          Connect your phone or tablet to your mixer using an audio interface:
        </p>
        <ul>
          <li><strong>Equipment needed:</strong> USB audio interface (Focusrite Scarlett, Behringer UMC22, etc.)</li>
          <li><strong>For iPhone/iPad:</strong> Lightning to USB Camera Adapter + USB interface</li>
          <li><strong>For Android:</strong> USB-C to USB adapter + USB interface</li>
          <li>Feed from mixer → interface → phone/tablet running The Band Plan</li>
        </ul>
        <p class="mb-0"><strong>Why this works:</strong> Balanced mix, can view setlist during performance, good quality.</p>
      </div>
    </div>
    
    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">📱 Next Best: Phone in Center of Room</h4>
        <p>
          Place a phone or tablet in the center of the room with its built-in microphone:
        </p>
        <ul>
          <li>Position at ear level, equal distance from all instruments</li>
          <li>Away from speakers to avoid PA bleed</li>
          <li>On a stable surface (don't let it move)</li>
          <li>Use a dedicated device if possible (not the one displaying lyrics)</li>
        </ul>
        <p class="mb-0"><strong>Why this works:</strong> Simple setup, captures the room sound, works for reference recordings.</p>
      </div>
    </div>
    
    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">👥 Next Best: Non-Singing Band Member Records</h4>
        <p>
          Have someone who doesn't sing do the recording:
        </p>
        <ul>
          <li>Band member who doesn't need lyrics/chords</li>
          <li>Instrumentalist who plays by ear</li>
          <li>They can have The Band Plan open and recording in front of them</li>
          <li>Better microphone placement since they're not singing into it</li>
        </ul>
        <p class="mb-0"><strong>Why this works:</strong> More balanced recording, vocalist won't overpower the mix.</p>
      </div>
    </div>
    
    <div class="card mb-3 border-warning">
      <div class="card-body">
        <h4 class="card-title">⚠️ Last Resort: Phone While Singing</h4>
        <p>
          Having your phone record while you sing right in front of it:
        </p>
        <ul>
          <li>Your vocal will be very prominent in the mix</li>
          <li>Other instruments may sound distant</li>
          <li>Still useful for reference and memory</li>
        </ul>
        <p class="mb-0"><strong>The issue:</strong> Microphone proximity - your voice is inches from the mic while other sounds are feet away.</p>
      </div>
    </div>
    
    <hr class="my-4">
    
    <h3>Option 4: Link to External Playlists</h3>
    <p>
      If your recordings are already hosted elsewhere (YouTube, SoundCloud, etc.), you can create 
      a playlist on The Band Plan without uploading files:
    </p>
    <ol>
      <li>Go to your setlist page</li>
      <li>Look for the "Listen to the Set" form in the Setlist Actions panel</li>
      <li>Add links to your recordings hosted on other platforms</li>
      <li>The Band Plan will create a playlist for you</li>
    </ol>
    <p><strong>Note:</strong> This doesn't allow splitting, but it's a quick way to link your existing recordings to a setlist.</p>
    
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
    
    <h3>Questions or Issues?</h3>
    
    <p>
      If you're having trouble with recording, splitting, or uploading, or need advice on equipment, 
      please reach out for support. We're here to help you capture your best performances!
    </p>
  `;

  res.render("legal/document", {
    title: "Recording Instructions",
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

