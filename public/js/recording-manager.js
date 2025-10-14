/**
 * Recording Manager - Handles in-browser audio recording with persistent state
 * Allows users to record their sets while navigating the site
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

    // Check if recording is in progress on page load
    this.checkExistingRecording();
  }

  /**
   * Check if there's an active recording when page loads
   * Resumes recording UI if found
   */
  async checkExistingRecording() {
    const recordingState = localStorage.getItem("activeRecording");

    if (recordingState) {
      const data = JSON.parse(recordingState);

      // Recording was in progress - resume UI
      await this.resumeRecording(data);
    }
  }

  /**
   * Start a new recording
   */
  async startRecording(setlistId, setlistTitle) {
    try {
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

      // Collect audio chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
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

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
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
  cleanup() {
    this.cleanupResources();

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
