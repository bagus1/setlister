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
    this.isProcessing = false;

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
   * Check available memory before starting recording
   */
  async checkMemoryBeforeRecording() {
    // Check if we have memory API available
    if ("memory" in performance) {
      const memory = performance.memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

      console.log("Memory status:", {
        used: `${usedMB.toFixed(1)}MB`,
        total: `${totalMB.toFixed(1)}MB`,
        limit: `${limitMB.toFixed(1)}MB`,
        available: `${(limitMB - usedMB).toFixed(1)}MB`,
      });

      // Warn if memory usage is high (>80% of limit)
      const usagePercent = (usedMB / limitMB) * 100;
      if (usagePercent > 80) {
        const availableMB = limitMB - usedMB;
        return {
          warning: true,
          message: `Low memory available (${availableMB.toFixed(1)}MB). Long recordings may fail. Consider closing other tabs.`,
          availableMB: availableMB,
          usagePercent: usagePercent,
        };
      }

      return {
        warning: false,
        availableMB: limitMB - usedMB,
        usagePercent: usagePercent,
      };
    }

    // Fallback: Check if we can create a test blob
    try {
      const testBlob = new Blob([new ArrayBuffer(10 * 1024 * 1024)]); // 10MB test
      return { warning: false, availableMB: "unknown" };
    } catch (error) {
      return {
        warning: true,
        message:
          "Unable to allocate memory for recording. Please close other tabs and try again.",
        availableMB: 0,
      };
    }
  }

  /**
   * Start a new recording
   */
  async startRecording(setlistId, setlistTitle) {
    try {
      // Check memory before starting
      const memoryCheck = await this.checkMemoryBeforeRecording();
      if (memoryCheck.warning) {
        const proceed = confirm(
          `${memoryCheck.message}\n\nDo you want to continue anyway?`
        );
        if (!proceed) {
          return;
        }
      }

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
   * Get actual duration from audio blob by loading it
   */
  getAudioDuration(blob) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(Math.floor(audio.duration));
        URL.revokeObjectURL(audio.src);
      });
      audio.addEventListener("error", () => {
        // Fallback to elapsed time if we can't read the audio
        resolve(Math.floor((Date.now() - this.startTime) / 1000));
        URL.revokeObjectURL(audio.src);
      });
      audio.src = URL.createObjectURL(blob);
    });
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

    // Show processing modal
    this.showProcessingModal();

    // Add beforeunload warning
    this.isProcessing = true;
    window.addEventListener("beforeunload", this.beforeUnloadHandler);

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

          this.updateProcessingStatus("Creating audio file from recording...");

          // Create blob from collected chunks
          const audioBlob = new Blob(this.audioChunks, {
            type: this.mediaRecorder.mimeType || "audio/webm",
          });

          this.updateProcessingStatus("Calculating recording duration...");

          // Calculate actual duration from the audio blob
          // We'll get the real duration from the audio file itself
          const duration = await this.getAudioDuration(audioBlob);

          // Show length warning for recordings over 1 hour
          if (duration > 3600) {
            // 1 hour in seconds
            const warningElement = document.getElementById(
              "recordingLengthWarning"
            );
            if (warningElement) {
              const hours = Math.floor(duration / 3600);
              const minutes = Math.floor((duration % 3600) / 60);
              warningElement.innerHTML = `<i class="bi bi-info-circle"></i> <strong>Long Recording:</strong> This recording is ${hours}h ${minutes}m. Processing may take several minutes.`;
              warningElement.style.display = "block";
            }
          }

          this.updateProcessingStatus("Saving backup copy...");

          // Save to IndexedDB as backup before upload
          await this.saveRecordingToIndexedDB(
            audioBlob,
            recordingData.setlistId,
            duration
          );

          this.updateProcessingStatus("Preparing for upload...");

          // Stop timer and animation (but keep localStorage for now)
          this.cleanupResources();

          this.updateProcessingStatus("Uploading to server...");

          // Upload to server
          await this.uploadRecording(
            audioBlob,
            recordingData.setlistId,
            duration
          );

          this.updateProcessingStatus("Upload complete! Redirecting...");

          resolve();
        } catch (error) {
          console.error("Error processing recording:", error);
          this.hideProcessingModal();
          this.isProcessing = false;
          window.removeEventListener("beforeunload", this.beforeUnloadHandler);

          // Show retry modal instead of cleaning up
          this.showRetryModal(
            error.message ||
              "Failed to process recording. Your recording has been saved locally."
          );

          resolve();
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Upload recording to server (with chunked upload for large files)
   */
  async uploadRecording(audioBlob, setlistId, duration) {
    // Check if file is large enough to use chunked upload (>100MB)
    const CHUNK_THRESHOLD = 100 * 1024 * 1024; // 100MB

    if (audioBlob.size > CHUNK_THRESHOLD) {
      console.log("Large file detected, using chunked upload...");
      return await this.uploadRecordingChunked(audioBlob, setlistId, duration);
    } else {
      return await this.uploadRecordingRegular(audioBlob, setlistId, duration);
    }
  }

  /**
   * Regular upload for smaller files
   */
  async uploadRecordingRegular(audioBlob, setlistId, duration) {
    const formData = new FormData();
    formData.append("audio", audioBlob, `recording-${Date.now()}.webm`);
    formData.append("duration", duration);

    // Include bestMemberId if stored (for attribution to member with available space)
    const bestMemberId = localStorage.getItem(`bestMemberId_${setlistId}`);
    if (bestMemberId) {
      formData.append("bestMemberId", bestMemberId);
      // Clear after use
      localStorage.removeItem(`bestMemberId_${setlistId}`);
    }

    console.log("Uploading recording:", {
      blobSize: audioBlob.size,
      blobType: audioBlob.type,
      setlistId,
      duration,
      chunksCount: this.audioChunks.length,
    });

    try {
      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          this.updateProcessingStatus(
            `Uploading to server... ${Math.round(percentComplete)}%`
          );
        }
      });

      // Handle completion
      const response = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              ok: true,
              status: xhr.status,
              statusText: xhr.statusText,
              json: () => Promise.resolve(JSON.parse(xhr.responseText)),
              text: () => Promise.resolve(xhr.responseText),
            });
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Upload timeout"));

        xhr.open("POST", `/setlists/${setlistId}/recordings`);
        xhr.send(formData);
      });

      console.log(
        "Upload response status:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        // Try to get error message from response
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: await response.text() };
        }

        console.error("Upload error response:", errorData);

        // Show user-friendly error message
        let userMessage = "Upload failed. Please try again.";

        if (response.status === 413) {
          userMessage =
            errorData.message ||
            "Your storage quota has been exceeded. Please upgrade your plan or delete old recordings.";
        } else if (response.status === 500) {
          userMessage =
            errorData.message ||
            "There was a server error. Please try again or contact support.";
        } else if (errorData.message) {
          userMessage = errorData.message;
        }

        throw new Error(userMessage);
      }

      const result = await response.json();
      console.log("Upload successful:", result);

      // Clear IndexedDB chunks
      await this.clearChunksFromIndexedDB(setlistId);

      // Clear backup recording from IndexedDB
      await this.clearRecordingBackup(setlistId);

      // Clear state
      localStorage.removeItem("activeRecording");

      // Remove beforeunload warning
      this.isProcessing = false;
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);

      // Hide processing modal
      this.hideProcessingModal();

      // Extract bandId from current URL
      const currentUrl = window.location.href;
      const bandsMatch = currentUrl.match(/\/bands\/(\d+)\//);
      const bandId = bandsMatch ? bandsMatch[1] : "1"; // Fallback to 1 if not found

      // Redirect to recording detail page
      window.location.href = `/bands/${bandId}/setlists/${setlistId}/recordings/${result.recordingId}`;
    } catch (error) {
      console.error("Upload failed:", error);
      this.hideProcessingModal();
      this.isProcessing = false;
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
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

  /**
   * Show processing modal overlay
   */
  showProcessingModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById("recordingProcessingModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "recordingProcessingModal";
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;
      modal.innerHTML = `
        <div style="background: white; padding: 40px; border-radius: 10px; text-align: center; max-width: 500px;">
          <div class="spinner-border text-primary mb-3" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
          </div>
          <h4 class="mb-3">Processing Your Recording...</h4>
          <div id="processingStatus" class="mb-3">
            <p class="text-muted mb-2">Preparing recording for upload...</p>
          </div>
          <div id="recordingLengthWarning" class="alert alert-info mt-3 mb-3" style="display: none;">
            <i class="bi bi-info-circle"></i> <strong>Long Recording:</strong> This recording is over 1 hour. Processing may take several minutes.
          </div>
          <p class="text-muted mb-2">Please don't close this window or navigate away.</p>
          <p class="text-muted"><small>Processing may take up to 5 minutes for long recordings.</small></p>
          <div class="alert alert-warning mt-3 mb-0">
            <i class="bi bi-exclamation-triangle"></i> Your recording will be lost if you leave this page!
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = "flex";
    }
  }

  /**
   * Update processing status message
   */
  updateProcessingStatus(message) {
    const statusElement = document.getElementById("processingStatus");
    if (statusElement) {
      statusElement.innerHTML = `<p class="text-muted mb-2">${message}</p>`;
    }
  }

  /**
   * Show retry modal when upload fails
   */
  showRetryModal(errorMessage) {
    // Remove existing retry modal if it exists
    const existingModal = document.getElementById("recordingRetryModal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "recordingRetryModal";
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="background: white; padding: 40px; border-radius: 10px; text-align: center; max-width: 500px;">
        <div class="text-danger mb-3" style="font-size: 3rem;">
          <i class="bi bi-exclamation-triangle"></i>
        </div>
        <h4 class="mb-3 text-danger">Upload Failed</h4>
        <div class="alert alert-danger mb-3">
          ${errorMessage}
        </div>
        <p class="text-muted mb-4">Your recording has been saved locally and can be retried.</p>
        <div class="d-flex gap-2 justify-content-center">
          <button id="retryUploadBtn" class="btn btn-primary">
            <i class="bi bi-arrow-clockwise"></i> Try Again
          </button>
          <button id="cancelRetryBtn" class="btn btn-outline-secondary">
            <i class="bi bi-x-circle"></i> Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    document.getElementById("retryUploadBtn").addEventListener("click", () => {
      this.retryUpload();
    });

    document.getElementById("cancelRetryBtn").addEventListener("click", () => {
      this.cancelRetry();
    });
  }

  /**
   * Hide retry modal
   */
  hideRetryModal() {
    const modal = document.getElementById("recordingRetryModal");
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Retry the upload
   */
  async retryUpload() {
    this.hideRetryModal();

    // Get the recording data from localStorage
    const recordingData = JSON.parse(localStorage.getItem("activeRecording"));
    if (!recordingData) {
      alert("Recording data not found. Please try recording again.");
      return;
    }

    // Get the backup from IndexedDB
    try {
      const backupData = await this.getRecordingBackup(recordingData.setlistId);
      if (!backupData) {
        alert("Recording backup not found. Please try recording again.");
        return;
      }

      // Show processing modal again
      this.showProcessingModal();
      this.isProcessing = true;
      window.addEventListener("beforeunload", this.beforeUnloadHandler);

      this.updateProcessingStatus("Retrying upload...");

      // Retry the upload
      const result = await this.uploadRecording(
        backupData.audioBlob,
        recordingData.setlistId,
        backupData.duration
      );

      this.updateProcessingStatus("Upload complete! Redirecting...");

      // Clear everything on success
      await this.clearRecordingBackup(recordingData.setlistId);
      localStorage.removeItem("activeRecording");
      this.isProcessing = false;
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);

      // Extract bandId from current URL
      const currentUrl = window.location.href;
      const bandsMatch = currentUrl.match(/\/bands\/(\d+)\//);
      const bandId = bandsMatch ? bandsMatch[1] : "1"; // Fallback to 1 if not found

      // Redirect to recording detail page
      window.location.href = `/bands/${bandId}/setlists/${recordingData.setlistId}/recordings/${result.recordingId}`;
    } catch (error) {
      console.error("Retry upload failed:", error);
      this.hideProcessingModal();
      this.isProcessing = false;
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);

      // Show retry modal again
      this.showRetryModal(
        error.message || "Retry failed. Please try again or contact support."
      );
    }
  }

  /**
   * Cancel retry and clean up
   */
  cancelRetry() {
    this.hideRetryModal();
    this.cleanup();
  }

  /**
   * Get recording backup from IndexedDB
   */
  async getRecordingBackup(setlistId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("RecordingBackups", 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["backups"], "readonly");
        const store = transaction.objectStore("backups");
        const getRequest = store.get(setlistId);

        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  /**
   * Hide processing modal
   */
  hideProcessingModal() {
    const modal = document.getElementById("recordingProcessingModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  /**
   * Browser beforeunload handler
   */
  beforeUnloadHandler = (e) => {
    if (this.isProcessing) {
      e.preventDefault();
      e.returnValue =
        "Your recording is still processing and will be lost if you leave!";
      return e.returnValue;
    }
  };

  /**
   * Save recording blob to IndexedDB as backup
   */
  async saveRecordingToIndexedDB(audioBlob, setlistId, duration) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("RecordingBackups", 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("backups")) {
          db.createObjectStore("backups", { keyPath: "setlistId" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["backups"], "readwrite");
        const store = transaction.objectStore("backups");

        store.put({
          setlistId: setlistId,
          audioBlob: audioBlob,
          duration: duration,
          timestamp: Date.now(),
        });

        transaction.oncomplete = () => {
          console.log("Recording backup saved to IndexedDB");
          resolve();
        };

        transaction.onerror = () => reject(transaction.error);
      };
    });
  }

  /**
   * Clear recording backup from IndexedDB
   */
  async clearRecordingBackup(setlistId) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("RecordingBackups", 1);

      request.onerror = () => {
        console.warn("Could not open IndexedDB to clear backup");
        resolve(); // Don't fail if we can't clear
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["backups"], "readwrite");
        const store = transaction.objectStore("backups");

        store.delete(setlistId);

        transaction.oncomplete = () => {
          console.log("Recording backup cleared from IndexedDB");
          resolve();
        };

        transaction.onerror = () => {
          console.warn("Could not clear recording backup");
          resolve(); // Don't fail if we can't clear
        };
      };
    });
  }

  /**
   * Chunked upload for large files
   */
  async uploadRecordingChunked(audioBlob, setlistId, duration) {
    try {
      // Get bestMemberId if stored (for attribution to member with available space)
      const bestMemberId = localStorage.getItem(`bestMemberId_${setlistId}`);

      // Create a file-like object for the ChunkedUploader
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      const uploader = new ChunkedUploader(file, bestMemberId);

      const result = await uploader.uploadChunks(setlistId, (progress) => {
        this.updateProcessingStatus(
          `Uploading chunks... ${progress.percentage}% (${progress.loaded}/${progress.total} chunks)`
        );
      });

      console.log("Chunked upload successful:", result);

      // Clear bestMemberId after use
      if (bestMemberId) {
        localStorage.removeItem(`bestMemberId_${setlistId}`);
      }

      return result;
    } catch (error) {
      throw new Error(`Chunked upload failed: ${error.message}`);
    }
  }
}

// Initialize global instance when DOM is ready
let recordingManager;

document.addEventListener("DOMContentLoaded", function () {
  recordingManager = new RecordingManager();
});

// Global functions for button onclick handlers
function startRecording(setlistId, bestMemberId) {
  const setlistTitle =
    document.querySelector("h1")?.textContent || "Untitled Setlist";
  // Store bestMemberId if provided (for attribution to member with available space)
  if (bestMemberId) {
    localStorage.setItem(`bestMemberId_${setlistId}`, bestMemberId);
  }
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

// Note: No beforeunload warning needed since recording persists via IndexedDB
// Users can navigate freely within the site and the recording continues
// The floating widget and localStorage state track the active recording
