# Peaks.js Migration Guide

## 🎯 **Why Migrate from WaveSurfer.js to Peaks.js?**

### **Current Issues with WaveSurfer.js:**

- ❌ **Large File Failures**: 269MB+ files fail to load
- ❌ **Zoom Problems**: Gets stuck, needs reset button workarounds
- ❌ **Loading Reliability**: "Failed to fetch" errors on production
- ❌ **Mobile Issues**: Poor performance on iOS Safari
- ❌ **Memory Issues**: Struggles with long recordings

### **Peaks.js Advantages:**

- ✅ **Large File Support**: Designed for BBC-scale audio files
- ✅ **Reliable Loading**: More robust file handling
- ✅ **Smooth Zoom**: Predictable zoom behavior
- ✅ **Better Performance**: Optimized for long recordings
- ✅ **Mobile Friendly**: Better iOS/Safari support
- ✅ **Dual Views**: Overview + zoomed waveform

---

## 📊 **Side-by-Side Comparison**

| Feature                    | WaveSurfer.js            | Peaks.js                         | Winner         |
| -------------------------- | ------------------------ | -------------------------------- | -------------- |
| **Large File Performance** | ❌ Struggles with 200MB+ | ✅ Designed for large files      | **Peaks.js**   |
| **Zoom Behavior**          | ⚠️ Can get stuck         | ✅ Smooth, predictable           | **Peaks.js**   |
| **Loading Reliability**    | ❌ Fails on large files  | ✅ More reliable                 | **Peaks.js**   |
| **Bundle Size**            | 📦 ~200KB                | 📦 ~150KB + deps                 | **Tie**        |
| **Documentation**          | ✅ Extensive examples    | ✅ BBC-quality docs              | **Tie**        |
| **Region Selection**       | ✅ Built-in regions      | ✅ Segments & markers            | **Tie**        |
| **Mobile Support**         | ⚠️ iOS Safari issues     | ✅ Better mobile                 | **Peaks.js**   |
| **Dependencies**           | ✅ Minimal               | ⚠️ Requires Konva, waveform-data | **WaveSurfer** |

---

## 🚀 **Migration Steps**

### **Step 1: Install Dependencies**

```bash
npm install peaks.js konva waveform-data
```

### **Step 2: Update HTML**

```html
<!-- Replace WaveSurfer scripts -->
<script src="https://cdn.jsdelivr.net/npm/konva@9/konva.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/waveform-data@4.4.0/dist/waveform-data.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/peaks.js@3.4.0/dist/peaks.min.js"></script>
```

### **Step 3: Update Container Structure**

```html
<!-- Overview waveform -->
<div id="overview-container" style="height: 100px;"></div>

<!-- Zoomed waveform -->
<div id="zoomview-container" style="height: 200px;"></div>

<!-- Hidden audio element -->
<audio id="audio" preload="metadata" style="display: none;"></audio>
```

### **Step 4: Replace JavaScript**

#### **WaveSurfer.js (Current):**

```javascript
const wavesurfer = WaveSurfer.create({
  container: "#waveform",
  waveColor: "#6f42c1",
  progressColor: "#6f42c1",
  cursorColor: "#dc3545",
  height: 200,
  normalize: true,
  backend: "MediaElement",
  plugins: [wsRegions, WaveSurfer.Timeline.create()],
});

wavesurfer.load("<%= recording.filePath %>");
```

#### **Peaks.js (New):**

```javascript
const peaks = Peaks.init({
  container: document.getElementById("zoomview-container"),
  mediaElement: document.getElementById("audio"),
  webAudio: {
    audioContext: new AudioContext(),
  },
  overview: {
    container: document.getElementById("overview-container"),
    waveformColor: "#6f42c1",
    playedWaveformColor: "#6f42c1",
  },
  zoomview: {
    container: document.getElementById("zoomview-container"),
    waveformColor: "#6f42c1",
    playedWaveformColor: "#6f42c1",
  },
  segments: {
    enableSegmentEditing: true,
    enableSegmentDeletion: true,
    enableSegmentResizing: true,
  },
});

// Load audio file
document.getElementById("audio").src = "<%= recording.filePath %>";
```

---

## 🔄 **API Mapping**

| WaveSurfer.js                     | Peaks.js                             | Notes                   |
| --------------------------------- | ------------------------------------ | ----------------------- |
| `wavesurfer.play()`               | `peaks.player.play()`                | Playback control        |
| `wavesurfer.pause()`              | `peaks.player.pause()`               | Playback control        |
| `wavesurfer.zoom(level)`          | `peaks.zoom.setZoom(level)`          | Zoom control            |
| `wavesurfer.zoom(false)`          | `peaks.zoom.setZoom(1)`              | Reset zoom              |
| `wsRegions.addRegion()`           | `peaks.segments.addSegment()`        | Region/segment creation |
| `wsRegions.clearRegions()`        | `peaks.segments.removeAllSegments()` | Clear all regions       |
| `wavesurfer.on('region-created')` | `peaks.on('segments.add')`           | Event handling          |

---

## 🎵 **Key Differences**

### **1. Dual Waveform Views**

- **WaveSurfer**: Single waveform view
- **Peaks.js**: Overview + zoomed view (like audio editing software)

### **2. Segment vs Region**

- **WaveSurfer**: "Regions" for marking areas
- **Peaks.js**: "Segments" for marking areas (same concept, different name)

### **3. Event Handling**

- **WaveSurfer**: `wavesurfer.on('event')`
- **Peaks.js**: `peaks.on('event')` (similar but different event names)

### **4. Zoom Behavior**

- **WaveSurfer**: Can get stuck, needs workarounds
- **Peaks.js**: Smooth, predictable zoom with proper reset

---

## 🧪 **Testing Strategy**

### **Phase 1: Prototype**

1. Create `recording-split-peaks.ejs` alongside current version
2. Test with small files (< 50MB)
3. Verify basic functionality (play, pause, zoom, segments)

### **Phase 2: Large File Testing**

1. Test with your 269MB file
2. Verify loading reliability
3. Test zoom behavior
4. Test segment creation/editing

### **Phase 3: Integration**

1. Replace WaveSurfer routes with Peaks.js
2. Update all event handlers
3. Test with real setlist data
4. Verify song assignment functionality

---

## 📈 **Expected Benefits**

### **Immediate Improvements:**

- ✅ **Reliable Loading**: No more "Failed to fetch" errors
- ✅ **Better Zoom**: Smooth zoom without getting stuck
- ✅ **Large File Support**: Handle 269MB+ files without issues

### **Long-term Benefits:**

- ✅ **Better Performance**: More efficient memory usage
- ✅ **Mobile Support**: Better iOS/Safari compatibility
- ✅ **Professional UI**: Dual waveform views like pro audio software
- ✅ **Future-proof**: BBC-maintained, actively developed

---

## 🎯 **Recommendation**

**Yes, migrate to Peaks.js!**

The benefits clearly outweigh the migration effort:

- **Solves your current problems** (large files, zoom issues, loading failures)
- **Better user experience** (smooth zoom, reliable loading)
- **Future-proof** (BBC-maintained, designed for large files)
- **Professional features** (dual waveform views)

**Migration effort**: ~2-3 days
**Risk**: Low (can keep WaveSurfer as fallback)
**Benefit**: High (solves major pain points)

---

## 🚀 **Next Steps**

1. **Review the prototype** (`recording-split-peaks-prototype.ejs`)
2. **Test with your 269MB file** to verify it loads
3. **Create a test route** to compare side-by-side
4. **Plan the migration** timeline
5. **Implement gradually** (prototype → test → replace)

**Ready to start the migration?** 🎵
