/**
 * Recording Manager - Handles in-browser audio recording with persistent state
 * Allows users to record their sets while navigating the site
 * Uses IndexedDB to persist audio chunks across page navigations
 */

class RecordingManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animationId = null;
    this.db = null;
    this.chunkCounter = 0;

    // Initialize IndexedDB
    this.initIndexedDB().then(() => {
      // Check if recording is in progress on page load
      this.checkExistingRecording();
    });
  }

  /**
   * Initialize IndexedDB for storing audio chunks
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("RecordingDB", 1);

      request.onerror = () => {
        console.error("IndexedDB error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for audio chunks
        if (!db.objectStoreNames.contains("audioChunks")) {
          const objectStore = db.createObjectStore("audioChunks", {
            keyPath: "id",
          });
          objectStore.createIndex("recordingId", "recordingId", {
            unique: false,
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * Save audio chunk to IndexedDB
   */
  async saveChunkToIndexedDB(chunk, recordingId) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["audioChunks"], "readwrite");
      const objectStore = transaction.objectStore("audioChunks");

      const chunkData = {
        id: `${recordingId}-${this.chunkCounter++}`,
        recordingId: recordingId,
        timestamp: Date.now(),
        data: chunk,
      };

      const request = objectStore.add(chunkData);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error("Error saving chunk to IndexedDB:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Load all chunks for a recording from IndexedDB
   */
  async loadChunksFromIndexedDB(recordingId) {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["audioChunks"], "readonly");
      const objectStore = transaction.objectStore("audioChunks");
      const index = objectStore.index("recordingId");
      const request = index.getAll(recordingId);

      request.onsuccess = () => {
        const chunks = request.result
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((item) => item.data);
        console.log(`Loaded ${chunks.length} chunks from IndexedDB`);
        resolve(chunks);
      };

      request.onerror = () => {
        console.error("Error loading chunks from IndexedDB:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all chunks for a recording from IndexedDB
   */
  async clearChunksFromIndexedDB(recordingId) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["audioChunks"], "readwrite");
      const objectStore = transaction.objectStore("audioChunks");
      const index = objectStore.index("recordingId");
      const request = index.getAllKeys(recordingId);

      request.onsuccess = () => {
        const keys = request.result;
        const deleteTransaction = this.db.transaction(
          ["audioChunks"],
          "readwrite"
        );
        const deleteStore = deleteTransaction.objectStore("audioChunks");

        keys.forEach((key) => deleteStore.delete(key));

        deleteTransaction.oncomplete = () => {
          console.log(`Cleared ${keys.length} chunks from IndexedDB`);
          resolve();
        };
      };

      request.onerror = () => {
        console.error("Error clearing chunks from IndexedDB:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if there's an active recording when page loads
   * Resumes recording UI if found
   */
  async checkExistingRecording() {
    const recordingState = localStorage.getItem("activeRecording");

    if (recordingState) {
      const data = JSON.parse(recordingState);

      // Check if there are saved chunks in IndexedDB
      const savedChunks = await this.loadChunksFromIndexedDB(data.setlistId);
      console.log(
        `Found active recording with ${savedChunks.length} saved chunks`
      );

      // Recording was in progress - resume UI
      await this.resumeRecording(data);
    }
  }

  /**
   * Start a new recording
   */
  async startRecording(setlistId, setlistTitle) {
    try {
      // Clear any old chunks from previous recordings of this setlist
      await this.clearChunksFromIndexedDB(setlistId);
      this.chunkCounter = 0;

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Keep natural sound
          noiseSuppression: false, // Don't alter the recording
          sampleRate: 44100, // CD quality
        },
      });

      // Determine best audio format
      const mimeType = this.getSupportedMimeType();

      // Create recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      });

      // Collect audio chunks and save to IndexedDB
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          // Save to IndexedDB for persistence
          await this.saveChunkToIndexedDB(event.data, setlistId);
        }
      };

      // Handle recording errors
      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        alert("Recording error occurred. Please try again.");
        this.cleanup();
      };

      // Start recording (collect data every second)
      this.mediaRecorder.start(1000);
      this.startTime = Date.now();

      // Save state to localStorage
      localStorage.setItem(
        "activeRecording",
        JSON.stringify({
          setlistId,
          setlistTitle,
          startTime: this.startTime,
          status: "recording",
        })
      );

      // Show widget
      this.showWidget(setlistTitle);
      this.startTimer();

      // Start waveform visualization
      this.startWaveformVisualization();

      console.log("Recording started successfully");
    } catch (error) {
      console.error("Recording error:", error);

      if (error.name === "NotAllowedError") {
        alert(
          "Microphone access denied. Please allow microphone access in your browser settings."
        );
      } else if (error.name === "NotFoundError") {
        alert(
          "No microphone found. Please connect a microphone and try again."
        );
      } else {
        alert(
          "Could not start recording. Please check your microphone and try again."
        );
      }
    }
  }

  /**
   * Get supported MIME type for recording
   */
  getSupportedMimeType() {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ""; // Browser will use default
  }

  /**
   * Resume recording UI after page navigation
   */
  async resumeRecording(data) {
    try {
      // Load previously recorded chunks from IndexedDB
      const savedChunks = await this.loadChunksFromIndexedDB(data.setlistId);
      this.audioChunks = savedChunks;
      this.chunkCounter = savedChunks.length;
      console.log(`Resumed with ${this.audioChunks.length} saved chunks`);

      // Request microphone access again
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });

      const mimeType = this.getSupportedMimeType();

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          // Save to IndexedDB for persistence
          await this.saveChunkToIndexedDB(event.data, data.setlistId);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        this.cleanup();
      };

      this.mediaRecorder.start(1000);
      this.startTime = data.startTime;

      this.showWidget(data.setlistTitle);
      this.startTimer();
      this.startWaveformVisualization();

      console.log("Recording resumed successfully");
    } catch (error) {
      console.error("Could not resume recording:", error);
      // Clean up orphaned state
      localStorage.removeItem("activeRecording");
      alert("Could not resume recording. The recording has been stopped.");
    }
  }

  /**
   * Show the recording widget
   */
  showWidget(setlistTitle) {
    const widget = document.getElementById("recordingWidget");
    if (widget) {
      widget.style.display = "block";
      const titleElement = widget.querySelector(".setlist-name");
      if (titleElement) {
        titleElement.textContent = setlistTitle;
      }
    }
  }

  /**
   * Start the recording timer
   */
  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      const formatted = this.formatTime(elapsed);

      const timer = document.getElementById("recordingTimer");
      const miniTimer = document.getElementById("miniTimer");

      if (timer) timer.textContent = formatted;
      if (miniTimer) miniTimer.textContent = formatted.substring(0, 5); // MM:SS
    }, 1000);
  }

  /**
   * Format milliseconds to HH:MM:SS
   */
  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  /**
   * Start waveform visualization
   */
  startWaveformVisualization() {
    const canvas = document.getElementById("miniWaveform");
    if (!canvas) return;

    const canvasCtx = canvas.getContext("2d");
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(this.stream);

    source.connect(this.analyser);
    this.analyser.fftSize = 256;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = "#f8f9fa";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#dc3545";
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  }

  /**
   * Stop recording and upload
   */
  async stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
      console.warn("No active recording to stop");
      return;
    }

    // Show loading state
    const widget = document.getElementById("recordingWidget");
    if (widget) {
      const stopBtn = widget.querySelector(".stop-recording-btn");
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.innerHTML =
          '<i class="bi bi-hourglass-split"></i> Processing...';
      }
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        try {
          // Get recording data BEFORE cleanup
          const recordingData = JSON.parse(
            localStorage.getItem("activeRecording")
          );

          if (!recordingData) {
            throw new Error("Recording data not found");
          }

          // Calculate duration
          const duration = Math.floor((Date.now() - this.startTime) / 1000);

          // Create blob from collected chunks
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder.mimeType || "audio/webm",
          });

          // Stop timer and animation (but keep localStorage for now)
          this.cleanupResources();

          // Upload to server
          await this.uploadRecording(
            audioBlob,
            recordingData.setlistId,
            duration
          );

          resolve();
        } catch (error) {
          console.error("Error processing recording:", error);
          alert("Failed to process recording. Please try again.");
          this.cleanup();
          resolve();
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Upload recording to server
   */
  async uploadRecording(audioBlob, setlistId, duration) {
    const formData = new FormData();
    formData.append("audio", audioBlob, `recording-${Date.now()}.webm`);
    formData.append("duration", duration);

    console.log("Uploading recording:", {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      setlistId,
      duration,
      chunksCount: this.audioChunks.length,
    });

    try {
      const response = await fetch(`/setlists/${setlistId}/recordings`, {
        method: "POST",
        body: formData,
      });

      console.log(
        "Upload response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        // Try to get error message from response
        const errorText = await response.text();
        console.error("Upload error response:", errorText);
        throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Upload successful:", result);

      // Clear IndexedDB chunks
      await this.clearChunksFromIndexedDB(setlistId);

      // Clear state
      localStorage.removeItem("activeRecording");

      // Redirect to split page
      window.location.href = `/setlists/${setlistId}/recordings/${result.recordingId}/split`;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  }

  /**
   * Clean up recording resources (including localStorage)
   */
  async cleanup() {
    this.cleanupResources();

    // Clear IndexedDB chunks
    const recordingState = localStorage.getItem("activeRecording");
    if (recordingState) {
      try {
        const data = JSON.parse(recordingState);
        await this.clearChunksFromIndexedDB(data.setlistId);
      } catch (error) {
        console.error("Error clearing IndexedDB during cleanup:", error);
      }
    }

    // Clear state
    localStorage.removeItem("activeRecording");
  }

  /**
   * Clean up recording resources (without clearing localStorage)
   */
  cleanupResources() {
    // Stop timer
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Stop all audio tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Hide widget
    const widget = document.getElementById("recordingWidget");
    if (widget) {
      widget.style.display = "none";
    }

    // Reset chunks
    this.audioChunks = [];
    this.chunkCounter = 0;
  }

  /**
   * Toggle widget between minimized and expanded
   */
  toggleMinimize() {
    const widget = document.getElementById("recordingWidget");
    if (!widget) return;

    widget.classList.toggle("minimized");

    const body = widget.querySelector(".widget-body");
    const minimized = widget.querySelector(".widget-minimized");

    if (widget.classList.contains("minimized")) {
      if (body) body.style.display = "none";
      if (minimized) minimized.style.display = "flex";
    } else {
      if (body) body.style.display = "block";
      if (minimized) minimized.style.display = "none";
    }
  }
}

// Initialize global instance when DOM is ready
let recordingManager;

document.addEventListener("DOMContentLoaded", function () {
  recordingManager = new RecordingManager();
});

// Global functions for button onclick handlers
function startRecording(setlistId) {
  const setlistTitle =
    document.querySelector("h1")?.textContent || "Untitled Setlist";
  if (recordingManager) {
    recordingManager.startRecording(setlistId, setlistTitle);
  }
}

function stopRecording() {
  if (recordingManager) {
    recordingManager.stopRecording();
  }
}

function toggleWidget() {
  if (recordingManager) {
    recordingManager.toggleMinimize();
  }
}

// Warn before leaving page if recording
window.addEventListener("beforeunload", (e) => {
  if (localStorage.getItem("activeRecording")) {
    e.preventDefault();
    e.returnValue = "Recording in progress. Are you sure you want to leave?";
    return e.returnValue;
  }
});
