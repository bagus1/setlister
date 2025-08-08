# YouTube Player Feature Plans

## Overview
Create a sequential YouTube video player that automatically plays songs from a setlist using existing song links. This will help bands practice their setlists with the actual songs.

## Implementation Approaches

### Method 1: Manual Video Switching (Recommended Starting Point)
**Status:** Primary approach to implement first

**How it works:**
- When one video ends, programmatically load the next one
- Use YouTube iframe API with `onStateChange` event
- Brief pause between videos (actually beneficial for musicians)

**Code example:**
```javascript
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        // Video finished, load next one
        loadNextVideo();
    }
}

function loadNextVideo() {
    const nextVideoId = playlist[currentIndex + 1];
    if (nextVideoId) {
        player.loadVideoById(nextVideoId);
        currentIndex++;
        updatePlaylistUI();
    }
}
```

**Pros:**
- ✅ Reliable - Works consistently across browsers
- ✅ Simple - Easy to implement and debug
- ✅ Flexible - Can add custom features (pause between sets, etc.)
- ✅ User-friendly - Clear indication of what's happening

**Cons:**
- Brief pause between videos
- User sees loading state

---

### Method 2: Queue API (YouTube's Official Method)
**Status:** Secondary approach to try

**How it works:**
- Use YouTube's built-in queue functionality
- Load multiple videos into a single player instance

**Code example:**
```javascript
function queueNextVideos() {
    const videoIds = playlist.map(song => song.videoId);
    player.loadPlaylist({
        playlist: videoIds,
        index: 0,
        startSeconds: 0
    });
}
```

**Pros:**
- Official YouTube feature
- Smoother transitions
- Less custom code needed

**Cons:**
- Still has some autoplay restrictions
- Less control over playback behavior

---

### Method 3: Hidden Player + Custom UI
**Status:** Advanced approach for later

**How it works:**
- Hide the YouTube player, create custom controls
- Full control over the user interface

**Code example:**
```javascript
const player = new YT.Player('hidden-player', {
    height: '0',
    width: '0',
    videoId: currentVideoId,
    events: {
        'onStateChange': onPlayerStateChange
    }
});

// Custom play/pause/next buttons that control the hidden player
```

**Pros:**
- Full control over UI
- Can add custom features
- Consistent branding

**Cons:**
- More complex implementation
- Need to build all controls from scratch

---

### Method 4: Multiple Players (Advanced)
**Status:** Most complex approach

**How it works:**
- Pre-load next video in hidden player
- Swap between players for seamless transitions

**Code example:**
```javascript
let currentPlayer = new YT.Player('player1', { videoId: video1 });
let nextPlayer = new YT.Player('player2', { videoId: video2 });

function swapPlayers() {
    currentPlayer.pauseVideo();
    nextPlayer.playVideo();
    // Update references and pre-load next
}
```

**Pros:**
- Seamless transitions
- No loading delays

**Cons:**
- Resource intensive
- Complex state management
- Multiple iframe instances

---

## Implementation Plan

### Phase 1: Basic Sequential Player (Method 1)
**Branch:** `feature/youtube-player-basic`

**Tasks:**
1. Create new route `/setlists/:id/player`
2. Query setlist songs and extract YouTube links
3. Build basic player interface with YouTube iframe
4. Implement manual video switching
5. Add play/pause/next/previous controls
6. Show current song and progress

**Features:**
- Play all songs in setlist order
- Manual controls (play, pause, next, previous)
- Current song indicator
- Progress through setlist

### Phase 2: Enhanced Player Features
**Branch:** `feature/youtube-player-enhanced`

**Tasks:**
1. Add set-based grouping (play all Set 1, then Set 2, etc.)
2. Implement practice mode (loop individual songs or sets)
3. Add tempo controls (speed up/slow down videos)
4. Show lyrics overlay from song links
5. Add band member notes/timestamps

**Features:**
- Set-based playback
- Practice modes
- Tempo controls
- Lyrics display
- Notes/timestamps

### Phase 3: YouTube Playlist Creation
**Branch:** `feature/youtube-playlist-creation`

**Tasks:**
1. Research YouTube Data API v3
2. Implement OAuth2 for user YouTube accounts
3. Create "Generate YouTube Playlist" feature
4. Handle API quotas and rate limiting
5. Add playlist sharing capabilities

**Features:**
- Create native YouTube playlists
- Share playlists with band members
- Mobile-friendly (uses native YouTube app)

### Phase 4: Multi-Platform Integration
**Branch:** `feature/multi-platform-player`

**Tasks:**
1. Add Spotify integration for audio-only options
2. Add Apple Music integration
3. Support for other streaming services
4. Unified player interface

**Features:**
- Multiple streaming service support
- Audio-only options for practice
- Unified interface

---

## Technical Requirements

### Database
- Use existing `Link` model with `type: 'youtube'`
- No new database changes needed initially

### API Requirements
- YouTube iframe API (no API key needed for basic player)
- YouTube Data API v3 (for playlist creation - requires API key)

### Frontend
- YouTube iframe API JavaScript library
- Custom player controls
- Responsive design for mobile/tablet

### Backend
- New route for player page
- Query setlist songs with YouTube links
- Band member access control

---

## Testing Strategy

### Prerequisites
1. Add more YouTube links to songs in the database
2. Create test setlists with various YouTube link configurations
3. Test with different browsers and devices

### Test Cases
1. **Basic playback:** Play through a setlist with YouTube links
2. **Manual controls:** Test play, pause, next, previous
3. **Edge cases:** Setlists with no YouTube links, mixed link types
4. **Mobile testing:** Responsive design and touch controls
5. **Performance:** Multiple videos, long setlists

### Success Criteria
- Player loads and plays videos reliably
- Controls work as expected
- Good user experience on mobile devices
- Handles edge cases gracefully

---

## Future Enhancements

### Advanced Features
- **Smart link detection:** Auto-detect YouTube URLs from various link types
- **Offline caching:** Cache video metadata locally
- **Band collaboration:** Multiple users can control the same player
- **Practice analytics:** Track practice sessions and song performance

### Integration Ideas
- **Setlist timing:** Sync with actual performance timing
- **Vocal cues:** Highlight vocalist sections
- **Instrument-specific views:** Different interfaces for different band members
- **Recording integration:** Record practice sessions

---

## Notes
- Start with Method 1 (Manual Video Switching) as it's most reliable
- Test thoroughly with real YouTube links before implementing
- Consider bandwidth usage for mobile users
- Plan for YouTube API changes and restrictions
- Keep the feature optional - not all songs need YouTube links 