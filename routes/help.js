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

// Help documents index page
router.get("/", (req, res) => {
  res.render("help/index-new", {
    title: "Help & Guides",
    pageTitle: "Help & Guides",
    marqueeTitle: "Help",
    currentUrl: req.originalUrl,
  });
});

// Recording Instructions - moved from legal
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

  res.render("help/document", {
    title: "Recording Instructions",
    pageTitle: "Recording Instructions",
    marqueeTitle: "Help",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

// Google Doc Formatting Guide - moved from legal
router.get("/google-doc-formatting", (req, res) => {
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

  res.render("help/document", {
    title: "Google Doc Formatting Guide",
    pageTitle: "Google Doc Formatting Guide",
    marqueeTitle: "Help",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

// Getting Started Guide
router.get("/getting-started", (req, res) => {
  const htmlContent = `
    <div class="alert alert-success">
      <h3>👋 Welcome to The Band Plan!</h3>
      <p class="mb-0">
        This guide will help you get started with managing your band, songs, and setlists. 
        Let's walk through the basics step by step.
      </p>
    </div>

    <h2>Quick Start: 5 Steps to Your First Setlist</h2>
    
    <ol class="mb-4">
      <li class="mb-3">
        <strong>Create Your Band</strong>
        <ul class="mt-2">
          <li>Click "Bands" in the navigation menu</li>
          <li>Click "Create New Band"</li>
          <li>Enter your band name and save</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Add Songs to Your Band</strong>
        <ul class="mt-2">
          <li>Go to your band page</li>
          <li>Click "Songs" tab</li>
          <li>Add songs one at a time, or import from a Google Doc</li>
          <li>Include title, artist, key, tempo, and any notes</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Create a Setlist</strong>
        <ul class="mt-2">
          <li>From your band page, click "Create Setlist"</li>
          <li>Give it a name and date</li>
          <li>Add songs from your repertoire</li>
          <li>Organize them into sets (Set 1, Set 2, etc.)</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Use Your Setlist</strong>
        <ul class="mt-2">
          <li><strong>Music Stand View:</strong> Full-screen lyrics/chords for performing</li>
          <li><strong>Rehearsal View:</strong> Access chord charts and documents while practicing</li>
          <li><strong>Audio Playlist:</strong> Listen to reference recordings</li>
          <li><strong>Print:</strong> Generate PDF for offline use</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Invite Your Band Members</strong>
        <ul class="mt-2">
          <li>Go to your band page</li>
          <li>Click "Invite Members"</li>
          <li>Enter their email addresses</li>
          <li>They'll receive an invitation to join</li>
        </ul>
      </li>
    </ol>

    <hr class="my-4">

    <h2>Key Features</h2>
    
    <h3>📚 Song Management</h3>
    <ul>
      <li><strong>Add songs individually</strong> with all the details you need</li>
      <li><strong>Import from Google Docs</strong> for bulk song entry</li>
      <li><strong>Add links</strong> to audio, MIDI, PDFs, YouTube, Spotify</li>
      <li><strong>Tag songs</strong> with genres, moods, and custom labels</li>
      <li><strong>Mark favorites</strong> and filter your repertoire</li>
      <li><strong>Private songs</strong> for personal use</li>
    </ul>
    
    <h3>🎵 Setlist Creation</h3>
    <ul>
      <li><strong>Drag and drop</strong> to reorder songs</li>
      <li><strong>Multiple sets</strong> (Set 1, Set 2, Encore, etc.)</li>
      <li><strong>Quick filters</strong> to find songs by key, tempo, or tag</li>
      <li><strong>Copy setlists</strong> to reuse for similar gigs</li>
      <li><strong>Finalize</strong> to lock and preserve your setlist</li>
    </ul>
    
    <h3>🎤 Performance Views</h3>
    <ul>
      <li><strong>Music Stand:</strong> Clean, full-screen view for performing</li>
      <li><strong>Rehearsal View:</strong> Access to all your charts and documents</li>
      <li><strong>Audio Playlist:</strong> Play through your songs with reference tracks</li>
      <li><strong>YouTube Playlist:</strong> Watch performances</li>
      <li><strong>MIDI Playlist:</strong> Play backing tracks</li>
      <li><strong>Lead Sheets:</strong> Print-friendly PDF charts</li>
    </ul>
    
    <h3>📄 Gig Documents</h3>
    <ul>
      <li><strong>Create chord charts</strong> for any song</li>
      <li><strong>Format with sections</strong> (Verse, Chorus, Bridge)</li>
      <li><strong>Print view</strong> for paper copies</li>
      <li><strong>Share with band</strong> for collaboration</li>
    </ul>
    
    <h3>🎙️ Recording</h3>
    <ul>
      <li><strong>Record directly in browser</strong> during your gig</li>
      <li><strong>Upload existing recordings</strong> (MP3, WAV, etc.)</li>
      <li><strong>Split into songs</strong> with visual waveform editor</li>
      <li><strong>Link to setlist</strong> for easy playback</li>
    </ul>

    <hr class="my-4">

    <h2>Tips for Success</h2>
    
    <div class="alert alert-info">
      <h4>💡 Best Practices</h4>
      <ul class="mb-0">
        <li><strong>Keep your song data complete</strong> - Add keys, tempos, and notes</li>
        <li><strong>Use consistent naming</strong> - Makes searching and filtering easier</li>
        <li><strong>Add links early</strong> - Audio, MIDI, and PDFs help you prepare</li>
        <li><strong>Test before the gig</strong> - Make sure everything works in performance mode</li>
        <li><strong>Invite your band early</strong> - Get everyone collaborating from the start</li>
        <li><strong>Create template setlists</strong> - Copy and modify for similar gigs</li>
      </ul>
    </div>

    <h2>Next Steps</h2>
    
    <p>Now that you understand the basics, explore these guides for more details:</p>
    <ul>
      <li><a href="/help/songs-and-setlists">Songs & Setlists Guide</a> - Master song organization</li>
      <li><a href="/help/recording-instructions">Recording Instructions</a> - Capture your performances</li>
      <li><a href="/help/gig-documents">Gig Documents Guide</a> - Create chord charts</li>
      <li><a href="/help/band-management">Band Management</a> - Collaborate effectively</li>
    </ul>

    <div class="alert alert-success mt-4">
      <h4>🎉 You're Ready!</h4>
      <p class="mb-0">
        You now know the basics of The Band Plan. Start by creating your band and adding a few songs. 
        The rest will follow naturally as you explore the features. Happy gigging!
      </p>
    </div>
  `;

  res.render("help/document", {
    title: "Getting Started with The Band Plan",
    pageTitle: "Getting Started",
    marqueeTitle: "Help",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

// Venue Booking Guide
router.get("/venue-booking", (req, res) => {
  const htmlContent = `
    <div class="alert alert-success">
      <h3>📍 Introduction</h3>
      <p class="mb-0">
        The Band Plan helps you discover venues, track booking communications, and manage gig opportunities. 
        This guide walks you through the entire process from finding venues to booking your gigs.
      </p>
    </div>

    <h2>Getting Started with Venue Booking</h2>
    
    <h3>Step 1: Find Venues</h3>
    <ol class="mb-4">
      <li class="mb-3">
        <strong>Browse the Venue Database</strong>
        <ul class="mt-2">
          <li>Click "Venues" in the main navigation</li>
          <li>Browse available venues or search by name/location</li>
          <li>Filter by city, state, venue type, or music style</li>
          <li>View venue details including contact info, capacity, and social media</li>
        </ul>
      </li>
      
      <li class="mb-3">
        <strong>Add Venues to Your Band</strong>
        <ul class="mt-2">
          <li>From your band page, go to the "Venues" tab</li>
          <li>Search for venues in the database and add them to your list</li>
          <li>Or create new venue entries if they're not in the database yet</li>
        </ul>
      </li>
    </ol>

    <h3>Step 2: Start an Opportunity</h3>
    <p>An "opportunity" represents your pursuit of a gig at a specific venue.</p>
    <ol class="mb-4">
      <li class="mb-3">
        <strong>Create a New Opportunity</strong>
        <ul class="mt-2">
          <li>Go to your band's venue detail page</li>
          <li>Click "Start New Opportunity"</li>
          <li>Give it a name (e.g., "Spring 2025 Booking", "Friday Night Residency")</li>
          <li>Select the type of your first interaction (email, phone, text, etc.)</li>
        </ul>
      </li>
    </ol>

    <h3>Step 3: Track Your Communications</h3>
    <p>Every time you reach out to a venue, log it as an interaction.</p>
    
    <h4>Interaction Types:</h4>
    <ul class="mb-3">
      <li><strong>Email</strong> - Email correspondence with booking managers</li>
      <li><strong>Phone Call</strong> - Calls to venue staff</li>
      <li><strong>Text/SMS</strong> - Text message conversations</li>
      <li><strong>In Person</strong> - Face-to-face meetings</li>
      <li><strong>Note</strong> - General notes and reminders</li>
      <li><strong>Social Media</strong> - Facebook Messenger, Instagram DMs, etc.</li>
    </ul>

    <h4>What to Log:</h4>
    <ul class="mb-4">
      <li><strong>Message Content</strong> - What you said/wrote to them</li>
      <li><strong>Previous Response</strong> - Their last response or status</li>
      <li><strong>Outcome</strong> - Result of this interaction:
        <ul class="mt-2">
          <li>Left Message</li>
          <li>Got Response</li>
          <li>Scheduled Follow-up</li>
          <li>Booked</li>
          <li>Rejected</li>
        </ul>
      </li>
      <li><strong>Next Steps</strong> - What you need to do next</li>
      <li><strong>Notes</strong> - Any additional context or details</li>
    </ul>

    <h3>Step 4: Track Opportunity Status</h3>
    <p>As you communicate with venues, your opportunity status updates automatically:</p>
    
    <div class="card mb-3">
      <div class="card-body">
        <ul class="mb-0">
          <li><strong>Prospecting</strong> - Just added, haven't contacted yet</li>
          <li><strong>Contacted</strong> - Initial outreach made, waiting for response</li>
          <li><strong>Negotiating</strong> - Active conversation about booking</li>
          <li><strong>Need Confirmation</strong> - Details agreed upon, awaiting final confirmation</li>
          <li><strong>Booked</strong> - Gig is confirmed! 🎉</li>
          <li><strong>Archived</strong> - Not pursuing this opportunity anymore</li>
        </ul>
      </div>
    </div>

    <h3>Step 5: Convert to a Gig</h3>
    <p>When an opportunity is booked with a date, a gig record is automatically created!</p>
    <ul class="mb-4">
      <li>The gig appears on your band's gigs calendar</li>
      <li>You can add load-in time, sound check, start/end times</li>
      <li>Link it to a setlist for easy performance access</li>
      <li>Track fee and payment details</li>
    </ul>

    <hr class="my-4">

    <h2>Best Practices for Venue Booking</h2>

    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">🎯 Initial Contact</h4>
        <ul class="mb-0">
          <li><strong>Research first</strong> - Check their music style, capacity, typical booking process</li>
          <li><strong>Be professional</strong> - Use proper grammar, be polite and concise</li>
          <li><strong>Include essentials</strong> - Band name, genre, website/samples, availability</li>
          <li><strong>Ask about process</strong> - How do they book? Who should you contact?</li>
        </ul>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">📞 Follow-Up Strategy</h4>
        <ul class="mb-0">
          <li><strong>Wait appropriately</strong> - Give venues 5-7 days to respond</li>
          <li><strong>Be persistent, not pushy</strong> - 2-3 follow-ups max</li>
          <li><strong>Try different channels</strong> - If email doesn't work, try phone or social media</li>
          <li><strong>Log everything</strong> - Keep detailed notes on what you tried and when</li>
        </ul>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">💼 When Negotiating</h4>
        <ul class="mb-0">
          <li><strong>Know your value</strong> - Research typical pay for similar venues</li>
          <li><strong>Be flexible</strong> - Dates, times, set length might need adjustment</li>
          <li><strong>Get it in writing</strong> - Confirm all details via email</li>
          <li><strong>Ask about logistics</strong> - Load-in time, parking, sound check, meals</li>
        </ul>
      </div>
    </div>

    <div class="card mb-3">
      <div class="card-body">
        <h4 class="card-title">✅ After Booking</h4>
        <ul class="mb-0">
          <li><strong>Confirm details</strong> - Date, time, fee, requirements</li>
          <li><strong>Add to calendar</strong> - The gig automatically appears on your schedule</li>
          <li><strong>Create setlist</strong> - Build your setlist for this venue</li>
          <li><strong>Stay in touch</strong> - Week-of confirmation, day-of check-in</li>
        </ul>
      </div>
    </div>

    <hr class="my-4">

    <h2>Venue Booking Workflow</h2>

    <div class="alert alert-info">
      <h4>📋 Complete Workflow Example</h4>
      <ol class="mb-0">
        <li><strong>Find venue:</strong> Search venues → Add to your band's venue list</li>
        <li><strong>Start opportunity:</strong> Click "Start New Opportunity" on venue page</li>
        <li><strong>First contact:</strong> Send email/call → Log interaction with outcome</li>
        <li><strong>Follow up:</strong> Wait for response → Log follow-up interactions</li>
        <li><strong>Negotiate:</strong> Discuss dates/pay → Log each conversation</li>
        <li><strong>Book it:</strong> Mark interaction outcome as "Booked" with gig date</li>
        <li><strong>Automatic gig creation:</strong> System creates gig record for your calendar</li>
        <li><strong>Prepare:</strong> Create setlist, rehearse, show up and rock!</li>
      </ol>
    </div>

    <h3>Tracking Multiple Venues</h3>
    <p>Working on booking several venues at once? The Band Plan keeps it all organized:</p>
    <ul>
      <li><strong>Opportunities Dashboard</strong> - See all your opportunities at a glance</li>
      <li><strong>Status at a glance</strong> - Color-coded badges show where each opportunity stands</li>
      <li><strong>Interaction history</strong> - Complete timeline of all communications</li>
      <li><strong>Next steps visible</strong> - Always know what to do next</li>
    </ul>

    <h3>Tips for Success</h3>
    
    <div class="alert alert-warning">
      <h4>⚠️ Common Mistakes to Avoid</h4>
      <ul class="mb-0">
        <li><strong>Not logging contacts</strong> - If you don't log it, you'll forget what happened</li>
        <li><strong>Giving up too soon</strong> - Sometimes it takes multiple attempts</li>
        <li><strong>Being too general</strong> - Personalize your outreach to each venue</li>
        <li><strong>No follow-through</strong> - Always do what you say you'll do</li>
        <li><strong>Forgetting to confirm</strong> - Confirm details a week before and day-of</li>
      </ul>
    </div>

    <h3>Venue Contact Information</h3>
    <p>The Band Plan stores multiple contact methods for each venue:</p>
    <ul>
      <li><strong>Email</strong> - Primary booking email</li>
      <li><strong>Phone</strong> - Main and alternate numbers</li>
      <li><strong>Website</strong> - Booking forms or information pages</li>
      <li><strong>Social Media</strong> - Facebook, Instagram, etc.</li>
      <li><strong>Messenger</strong> - Direct messaging platforms</li>
    </ul>
    <p>Use the contact method that works best for each venue - some prefer email, others respond faster to social media.</p>

    <h3>Building Venue Relationships</h3>
    <p>The best bookings come from strong venue relationships:</p>
    <ul>
      <li><strong>Show up on time</strong> - Professionalism matters</li>
      <li><strong>Promote the gig</strong> - Help them bring in customers</li>
      <li><strong>Be easy to work with</strong> - Flexible, prepared, and friendly</li>
      <li><strong>Follow up after</strong> - Thank them and ask about future dates</li>
      <li><strong>Stay in touch</strong> - Periodic check-ins even when not booking</li>
    </ul>

    <div class="alert alert-primary">
      <h4>💡 Pro Tip: Use the Data</h4>
      <p class="mb-0">
        The Band Plan tracks your entire communication history with each venue. Review your past 
        interactions before reaching out again to remind yourself what was discussed and show continuity 
        in your relationship with the venue.
      </p>
    </div>

    <h3>Questions?</h3>
    <p>
      If you need help with venue booking, opportunities, or tracking interactions, we're here to help!
    </p>
  `;

  res.render("help/document", {
    title: "Venue Booking Guide",
    pageTitle: "Venue Booking Guide",
    marqueeTitle: "Help",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

// Become a Moderator
router.get("/become-moderator", (req, res) => {
  const htmlContent = `
    <div class="alert alert-primary">
      <h3>🛡️ Join Our Community Moderation Team</h3>
      <p class="mb-0">
        Help us maintain and improve The Band Plan by becoming a moderator! Moderators play a crucial role 
        in keeping our database accurate, helping users, and ensuring quality across the platform.
      </p>
    </div>

    <h2>What Do Moderators Do?</h2>
    
    <h3>🎵 Song Database Management</h3>
    <ul class="mb-4">
      <li><strong>Edit Song Information</strong> - Correct titles, artists, keys, tempos, and other metadata</li>
      <li><strong>Merge Duplicates</strong> - Combine duplicate song entries to keep the database clean</li>
      <li><strong>Review Artist Data</strong> - Ensure artist information is accurate and complete</li>
      <li><strong>Maintain Data Quality</strong> - Fix formatting issues, standardize naming conventions</li>
    </ul>

    <h3>📍 Venue Database Management</h3>
    <ul class="mb-4">
      <li><strong>Review Venue Updates</strong> - Users suggest changes; moderators review and approve them</li>
      <li><strong>Edit Venue Information</strong> - Update contact info, addresses, capacity, music styles</li>
      <li><strong>Verify Venue Data</strong> - Ensure venue details are current and accurate</li>
      <li><strong>Add New Venues</strong> - Help expand the venue database with verified entries</li>
      <li><strong>Handle Venue Changes</strong> - Process closures, reopenings, ownership changes</li>
    </ul>

    <h3>👥 User Management</h3>
    <ul class="mb-4">
      <li><strong>Review User Accounts</strong> - Monitor account activity and address issues</li>
      <li><strong>Grant Permissions</strong> - Enable special features for trusted users</li>
      <li><strong>Community Support</strong> - Help users with questions and technical issues</li>
    </ul>

    <h3>📊 Platform Health</h3>
    <ul class="mb-4">
      <li><strong>Monitor Dashboard</strong> - Track platform statistics and activity</li>
      <li><strong>Identify Issues</strong> - Spot problems with data quality or user experience</li>
      <li><strong>Suggest Improvements</strong> - Share ideas for making The Band Plan better</li>
    </ul>

    <hr class="my-4">

    <h2>Who Should Become a Moderator?</h2>

    <div class="alert alert-success">
      <h4>✨ Ideal Moderator Qualities</h4>
      <ul class="mb-0">
        <li><strong>Active user</strong> - Regular user of The Band Plan with good understanding of features</li>
        <li><strong>Attention to detail</strong> - Careful about data accuracy and consistency</li>
        <li><strong>Community-minded</strong> - Want to help other musicians succeed</li>
        <li><strong>Reliable</strong> - Can commit to regular participation</li>
        <li><strong>Good judgment</strong> - Fair and thoughtful when reviewing changes</li>
        <li><strong>Communicative</strong> - Responsive to user questions and team discussions</li>
      </ul>
    </div>

    <h3>Time Commitment</h3>
    <p>We understand you're a busy musician! Moderator work is flexible:</p>
    <ul>
      <li><strong>No minimum hours</strong> - Contribute when you have time</li>
      <li><strong>Typically 2-5 hours/week</strong> - Review changes, respond to questions, clean up data</li>
      <li><strong>Async work</strong> - Do it on your schedule, not on ours</li>
      <li><strong>Team collaboration</strong> - Work with other moderators to share the load</li>
    </ul>

    <h3>What You Get</h3>
    <ul class="mb-4">
      <li><strong>Advanced permissions</strong> - Edit songs, venues, and manage users</li>
      <li><strong>Moderator badge</strong> - Recognition in the community</li>
      <li><strong>Direct input</strong> - Help shape the future of The Band Plan</li>
      <li><strong>Early access</strong> - Try new features before public release</li>
      <li><strong>Community impact</strong> - Help thousands of musicians succeed</li>
      <li><strong>Networking</strong> - Connect with other active musicians and moderators</li>
    </ul>

    <hr class="my-4">

    <h2>How to Apply</h2>

    <div class="card mb-4">
      <div class="card-body">
        <h4 class="card-title">📧 Application Process</h4>
        <ol class="mb-0">
          <li class="mb-2"><strong>Email us</strong> at <a href="mailto:support@thebandplan.com">support@thebandplan.com</a></li>
          <li class="mb-2"><strong>Include the following:</strong>
            <ul class="mt-2">
              <li>Your username on The Band Plan</li>
              <li>How long you've been using the platform</li>
              <li>Why you want to be a moderator</li>
              <li>What skills or experience you bring</li>
              <li>How much time you can commit per week</li>
            </ul>
          </li>
          <li class="mb-2"><strong>We'll review your application</strong> - Usually within 5-7 days</li>
          <li class="mb-2"><strong>If accepted:</strong> We'll enable your moderator permissions and provide training/guidance</li>
        </ol>
      </div>
    </div>

    <h3>What We Look For</h3>
    <div class="alert alert-info">
      <ul class="mb-0">
        <li><strong>Active account</strong> - Regular usage and engagement with the platform</li>
        <li><strong>Quality contributions</strong> - Good data entry, helpful to others</li>
        <li><strong>Good standing</strong> - No history of policy violations</li>
        <li><strong>Clear communication</strong> - Well-written application showing attention to detail</li>
        <li><strong>Community spirit</strong> - Genuine desire to help, not just seeking status</li>
      </ul>
    </div>

    <h3>Moderator Guidelines</h3>
    <p>As a moderator, you'll be expected to:</p>
    <ul class="mb-4">
      <li><strong>Be fair and impartial</strong> - Apply standards consistently</li>
      <li><strong>Respect privacy</strong> - Handle user data responsibly</li>
      <li><strong>Communicate clearly</strong> - Explain decisions when rejecting changes</li>
      <li><strong>Act promptly</strong> - Review pending changes in a timely manner</li>
      <li><strong>Collaborate</strong> - Work with other moderators on difficult decisions</li>
      <li><strong>Stay current</strong> - Keep up with platform updates and policies</li>
    </ul>

    <hr class="my-4">

    <h2>Frequently Asked Questions</h2>

    <h4>Do I get paid?</h4>
    <p>Moderator positions are currently volunteer. We're a community-driven platform and appreciate your contribution!</p>

    <h4>Can I lose moderator status?</h4>
    <p>Yes, if you're inactive for an extended period or violate community guidelines, moderator status may be revoked.</p>

    <h4>Can I still use The Band Plan normally?</h4>
    <p>Absolutely! Your band management, setlists, and all other features work exactly the same. You just have additional admin capabilities.</p>

    <h4>What if I make a mistake?</h4>
    <p>Don't worry! Changes can be reversed, and we have safeguards in place. We'd rather have engaged moderators who occasionally make mistakes than perfectionists who are afraid to act.</p>

    <h4>How many moderators do you need?</h4>
    <p>We're always open to quality moderators! As the platform grows, we need more help maintaining data quality.</p>

    <div class="alert alert-success mt-4">
      <h4>🎉 Ready to Apply?</h4>
      <p class="mb-0">
        Email us at <strong><a href="mailto:support@thebandplan.com">support@thebandplan.com</a></strong> 
        with your application. We're excited to hear from you and appreciate your interest in helping 
        The Band Plan community!
      </p>
    </div>
  `;

  res.render("help/document", {
    title: "Become a Moderator",
    pageTitle: "Become a Moderator",
    marqueeTitle: "Help",
    content: htmlContent,
    currentUrl: req.originalUrl,
  });
});

// Placeholder routes for other help topics
const placeholderTopics = [
  { route: "songs-and-setlists", title: "Songs & Setlists Guide" },
  { route: "gig-documents", title: "Gig Documents Guide" },
  { route: "band-management", title: "Band Management Guide" },
];

placeholderTopics.forEach((topic) => {
  router.get(`/${topic.route}`, (req, res) => {
    const htmlContent = `
      <div class="alert alert-info">
        <h3>📝 ${topic.title}</h3>
        <p class="mb-0">This guide is coming soon! Check back later for detailed information about this topic.</p>
      </div>
      <p>In the meantime, check out our <a href="https://bagus.org/setlists-manager/setlists-manager-tutorial.html" target="_blank">video tutorials</a> or explore other help topics.</p>
      <p><a href="/help" class="btn btn-primary">← Back to Help Center</a></p>
    `;

    res.render("help/document", {
      title: topic.title,
      pageTitle: topic.title,
      marqueeTitle: "Help",
      content: htmlContent,
      currentUrl: req.originalUrl,
    });
  });
});

module.exports = router;

