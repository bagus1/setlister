// Setlist Editor JavaScript
class SetlistEditor {
  constructor(setlistId) {
    this.setlistId = setlistId;
    this.socket = io();
    this.isDragging = false;
    this.draggedElement = null;
    this.sortableActive = false;
    this.hasCriticalChanges = false;
    this.saveTimeout = null;

    this.init();
  }

  init() {
    this.setupSocketConnection();
    this.setupDragAndDrop();
    this.setupEventListeners();

    // Set up event listeners for existing X buttons
    this.setupExistingRemoveButtons();
  }

  setupSocketConnection() {
    this.socket.emit("join-setlist", this.setlistId);

    this.socket.on("setlist-updated", (data) => {
      this.handleRemoteUpdate(data);
    });

    window.addEventListener("beforeunload", () => {
      this.socket.emit("leave-setlist", this.setlistId);
    });
  }

  setupDragAndDrop() {
    // Make band songs draggable
    document.querySelectorAll(".band-song").forEach((song) => {
      this.makeDraggable(song);
    });

    // Setup drop zones
    document.querySelectorAll(".drop-zone").forEach((zone) => {
      this.setupDropZone(zone);
    });

    // Make existing setlist songs draggable
    document.querySelectorAll(".setlist-song").forEach((song) => {
      this.makeDraggable(song);
    });
  }

  makeDraggable(element) {
    element.draggable = true;

    element.addEventListener("dragstart", (e) => {
      this.isDragging = true;
      this.draggedElement = element;
      element.classList.add("dragging");

      e.dataTransfer.setData("text/plain", "");
      e.dataTransfer.effectAllowed = "move";
    });

    element.addEventListener("dragend", (e) => {
      this.isDragging = false;

      // Comprehensive style cleanup
      this.clearDragStyles(element);

      this.draggedElement = null;
    });
  }

  setupDropZone(zone) {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      zone.classList.add("drag-over");
    });

    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove("drag-over");
      }
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");

      if (this.draggedElement) {
        // Calculate drop position
        const dropPosition = this.calculateDropPosition(zone, e.clientY);
        this.handleDrop(zone, dropPosition);
      }
    });
  }

  calculateDropPosition(dropZone, clientY) {
    const songs = dropZone.querySelectorAll(".setlist-song");
    if (songs.length === 0) {
      return 0; // First song in empty set
    }

    const dropZoneRect = dropZone.getBoundingClientRect();
    const dropZoneTop = dropZoneRect.top;

    // Find the closest song element
    for (let i = 0; i < songs.length; i++) {
      const songRect = songs[i].getBoundingClientRect();
      const songMiddle = songRect.top + songRect.height / 2;

      if (clientY < songMiddle) {
        return i; // Insert before this song
      }
    }

    return songs.length; // Insert at the end
  }

  handleDrop(dropZone, dropPosition) {
    // Don't handle if SortableJS is managing the drag
    if (this.sortableActive) {
      return;
    }

    const songId = this.draggedElement.dataset.songId;
    const setName = dropZone.dataset.setName;

    // Ensure dragging class is removed
    this.draggedElement.classList.remove("dragging");
    this.clearDragStyles(this.draggedElement);

    // Check if this is a reorder within the same set (handled by SortableJS)
    if (
      this.draggedElement.classList.contains("setlist-song") &&
      this.draggedElement.parentElement === dropZone
    ) {
      // This is a reorder within the same set, let SortableJS handle it
      return;
    }

    // Check if song already exists in this set to prevent duplicates
    const existingSong = dropZone.querySelector(
      `.setlist-song[data-song-id="${songId}"]`
    );
    if (existingSong) {
      // Song already exists in this set, don't add duplicate
      return;
    }

    // Clone the song element for the setlist
    const songClone = this.createSetlistSong(this.draggedElement, setName);

    // Insert at the specific position
    const songs = dropZone.querySelectorAll(".setlist-song");
    if (dropPosition === 0) {
      dropZone.insertBefore(songClone, dropZone.firstChild);
    } else if (dropPosition >= songs.length) {
      dropZone.appendChild(songClone);
    } else {
      dropZone.insertBefore(songClone, songs[dropPosition]);
    }

    dropZone.classList.add("has-songs");

    // Make the new song draggable
    this.makeDraggable(songClone);

    // Remove from band songs if it came from there (not from another set)
    if (this.draggedElement.classList.contains("band-song")) {
      this.draggedElement.style.display = "none"; // Hide immediately
      setTimeout(() => {
        if (this.draggedElement) {
          this.draggedElement.remove(); // Remove after a short delay
        }
      }, 100);
    } else if (this.draggedElement.classList.contains("setlist-song")) {
      // If moving from another set, remove from original location
      const originalDropZone = this.draggedElement.parentElement;
      this.draggedElement.remove();

      // Update original set display
      if (originalDropZone) {
        this.updateSetDisplay(originalDropZone.dataset.setName);
        if (originalDropZone.children.length === 0) {
          originalDropZone.classList.remove("has-songs");
        }
      }
    }

    // Update set display
    this.updateSetDisplay(setName);

    // Broadcast update with the actual position
    const actualPosition = Array.from(
      dropZone.querySelectorAll(".setlist-song")
    ).indexOf(songClone);
    this.broadcastUpdate("song-added", {
      songId,
      setName,
      position: actualPosition,
    });

    // Mark as critical change and auto-save
    this.hasCriticalChanges = true;
    this.autoSave();
  }

  createSetlistSong(originalSong, setName) {
    const clone = originalSong.cloneNode(true);
    clone.classList.remove("band-song");
    clone.classList.add("setlist-song");

    // Get the song title element and modify its structure
    const titleElement = clone.querySelector(".song-title");
    if (titleElement) {
      // Create a container for title and remove button
      const titleContainer = document.createElement("div");
      titleContainer.className = "d-flex align-items-center";
      titleContainer.style.minHeight = "1.2em";

      // Create the title with overflow hidden
      const titleText = document.createElement("div");
      titleText.className = "song-title-text";
      titleText.style.overflow = "hidden";
      titleText.style.textOverflow = "ellipsis";
      titleText.style.whiteSpace = "nowrap";
      titleText.style.flex = "1";
      titleText.textContent = titleElement.textContent;

      // Create small remove button
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-sm btn-outline-danger ms-2";
      removeBtn.style.fontSize = "0.7rem";
      removeBtn.style.padding = "0.1rem 0.3rem";
      removeBtn.style.lineHeight = "1";
      removeBtn.innerHTML = '<i class="bi bi-x"></i>';
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.removeSongFromSet(clone, setName);
      });

      // Assemble the new structure
      titleContainer.appendChild(titleText);
      titleContainer.appendChild(removeBtn);

      // Replace the original title element
      titleElement.parentNode.replaceChild(titleContainer, titleElement);
    } else {
      // Fallback if no title element found - add button at the end
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-sm btn-outline-danger ms-2";
      removeBtn.style.fontSize = "0.7rem";
      removeBtn.style.padding = "0.1rem 0.3rem";
      removeBtn.innerHTML = '<i class="bi bi-x"></i>';
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log(
          "[X BUTTON FALLBACK] Clicked, calling removeSongFromSet with:",
          { clone, setName }
        );
        console.log("[X BUTTON FALLBACK] clone is:", clone);
        console.log(
          "[X BUTTON FALLBACK] clone.dataset.songId:",
          clone.dataset.songId
        );
        this.removeSongFromSet(clone, setName);
      });
      clone.appendChild(removeBtn);
    }

    return clone;
  }

  removeSongFromSet(songElement, setName) {
    console.log("[REMOVE] removeSongFromSet called:", {
      setName,
      songId: songElement.dataset.songId,
    });

    const songId = songElement.dataset.songId;
    const songTime = songElement.dataset.songTime;
    const dropZone = songElement.parentElement;

    // Handle different removal logic based on set
    if (setName === "Maybe") {
      // Remove completely from maybe and restore to band songs
      songElement.remove();
      // Call restore after removing from DOM so the check works correctly
      setTimeout(() => {
        this.restoreToBandSongs(songId, songTime);
      }, 0);
    } else {
      // Move to maybe if removing from regular set
      console.log("[REMOVE] Moving from", setName, "to Maybe");
      const maybeZone = document.querySelector(
        '.drop-zone[data-set-name="Maybe"]'
      );
      if (maybeZone) {
        maybeZone.appendChild(songElement);
        maybeZone.classList.add("has-songs");

        // Update the remove button's event listener to use "Maybe" as the setName
        const removeBtn = songElement.querySelector(".btn-outline-danger");
        if (removeBtn) {
          // Remove the old event listener and add a new one
          const newRemoveBtn = removeBtn.cloneNode(true);
          removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
          newRemoveBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.removeSongFromSet(songElement, "Maybe");
          });
        } else {
          console.error(
            "[REMOVE] Could not find remove button in song element"
          );
        }
      }
    }

    // Update displays
    this.updateSetDisplay(setName);
    if (setName !== "Maybe") {
      this.updateSetDisplay("Maybe");
    }

    // Check if drop zone is empty
    if (dropZone.children.length === 0) {
      dropZone.classList.remove("has-songs");
    }

    // Broadcast update
    this.broadcastUpdate("song-removed", {
      songId,
      fromSet: setName,
    });

    // Auto-save
    this.hasCriticalChanges = true;
    this.autoSave();
  }

  restoreToBandSongs(songId, songTime) {
    // Check if song is already visible in band songs area
    const bandSongsContainer = document.querySelector(".col-md-4 .card-body");
    const existingBandSong = bandSongsContainer?.querySelector(
      `.band-song[data-song-id="${songId}"]`
    );
    if (existingBandSong && existingBandSong.offsetParent !== null) {
      console.log("[RESTORE] Song already visible in band songs, skipping");
      return; // Already there and visible, don't duplicate
    }

    // Check if song is still in any other set (should be 0 since we removed it from Maybe)
    const songInOtherSets = document.querySelectorAll(
      `.setlist-song[data-song-id="${songId}"]`
    );
    if (songInOtherSets.length > 0) {
      return; // Still in use elsewhere, don't restore
    }

    // Fetch song details from server and recreate band song element
    this.fetchAndRestoreSong(songId);
  }

  async fetchAndRestoreSong(songId) {
    try {
      const response = await fetch(`/songs/api/song/${songId}`);

      if (!response.ok) {
        console.error(
          "[RESTORE] API request failed:",
          response.status,
          response.statusText
        );
        return;
      }

      const song = await response.json();

      // Create band song element
      const bandSongElement = this.createBandSongElement(song);

      // Add to band songs area - use more specific selector
      const bandSongsContainer = document.querySelector(".col-md-4 .card-body");
      if (bandSongsContainer) {
        // Insert in alphabetical order
        const existingSongs = Array.from(
          bandSongsContainer.querySelectorAll(".band-song")
        );
        let insertPosition = existingSongs.length;

        // Validate that all existing songs are still valid DOM nodes
        const validExistingSongs = existingSongs.filter(
          (song) =>
            song && song.parentNode && song.parentNode === bandSongsContainer
        );

        for (let i = 0; i < validExistingSongs.length; i++) {
          const existingTitle = validExistingSongs[i]
            .querySelector(".song-title")
            ?.textContent?.trim();
          if (existingTitle && song.title.localeCompare(existingTitle) < 0) {
            insertPosition = i;
            break;
          }
        }

        if (insertPosition < validExistingSongs.length) {
          try {
            bandSongsContainer.insertBefore(
              bandSongElement,
              validExistingSongs[insertPosition]
            );
          } catch (insertError) {
            console.warn(
              "[RESTORE] Insert before failed, appending to end:",
              insertError
            );
            bandSongsContainer.appendChild(bandSongElement);
          }
        } else {
          bandSongsContainer.appendChild(bandSongElement);
        }

        // Make it draggable
        this.makeDraggable(bandSongElement);
      } else {
        console.error("[RESTORE] Could not find band songs container");
      }
    } catch (error) {
      console.error("Error restoring song to band songs:", error);
    }
  }

  createBandSongElement(song) {
    const songCard = document.createElement("div");
    songCard.className = "song-card band-song";
    songCard.setAttribute("data-song-id", song.id);
    songCard.setAttribute("data-song-time", song.time || 0);

    let artistHtml = "";
    if (song.Artists && song.Artists.length > 0) {
      artistHtml = `<div class="song-artist">by ${song.Artists[0].name}</div>`;
    }

    let vocalistHtml = "";
    if (song.Vocalist) {
      vocalistHtml = `<span class="song-vocalist">${song.Vocalist.name}</span>`;
    }

    let keyHtml = "";
    if (song.key) {
      keyHtml = `<span class="song-key">${song.key}</span>`;
    }

    let linksHtml = "";
    if (song.Links && song.Links.length > 0) {
      linksHtml = `<i class="bi bi-link-45deg text-primary" title="Has links"></i>`;
    }

    let docsHtml = "";
    if (song.GigDocuments && song.GigDocuments.length > 0) {
      docsHtml = `<i class="bi bi-file-earmark-text text-success" title="Has gig documents"></i>`;
    }

    let timeHtml = "";
    if (song.time) {
      const minutes = Math.floor(song.time / 60);
      const seconds = (song.time % 60).toString().padStart(2, "0");
      timeHtml = `<span class="song-time">${minutes}:${seconds}</span>`;
    }

    songCard.innerHTML = `
            <div class="song-title">${song.title}</div>
            ${artistHtml}
            <div class="d-flex justify-content-between align-items-center mt-2">
                <div class="d-flex align-items-center gap-2">
                    ${vocalistHtml}
                    ${keyHtml}
                    ${linksHtml}
                    ${docsHtml}
                </div>
                ${timeHtml}
            </div>
        `;

    return songCard;
  }

  updateSetDisplay(setName) {
    const dropZone = document.querySelector(
      `.drop-zone[data-set-name="${setName}"]`
    );
    const songs = dropZone.querySelectorAll(".setlist-song");

    // Update set time if not Maybe
    if (setName !== "Maybe") {
      let totalTime = 0;
      songs.forEach((song) => {
        const time = parseInt(song.dataset.songTime) || 0;
        totalTime += time;
      });

      const timeDisplay = document.querySelector(
        `.set-time[data-set="${setName}"]`
      );
      if (timeDisplay) {
        timeDisplay.textContent = this.formatTime(totalTime);
      }
    }

    // Update song count
    const countDisplay = document.querySelector(
      `.song-count[data-set="${setName}"]`
    );
    if (countDisplay) {
      countDisplay.textContent = `(${songs.length} songs)`;
    }
  }

  formatTime(seconds) {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  broadcastUpdate(action, data) {
    this.socket.emit("setlist-update", {
      setlistId: this.setlistId,
      action,
      data,
    });
  }

  handleRemoteUpdate(updateData) {
    // Handle updates from other users

    const { action, data } = updateData;

    switch (action) {
      case "song-added":
        this.handleRemoteSongAdded(data);
        break;
      case "song-removed":
        this.handleRemoteSongRemoved(data);
        break;
      case "song-moved":
        this.handleRemoteSongMoved(data);
        break;
    }
  }

  handleRemoteSongAdded(data) {
    const { songId, setName, position } = data;

    // Check if song is already in the target set
    const targetZone = document.querySelector(
      `.drop-zone[data-set-name="${setName}"]`
    );
    const existingSong = targetZone.querySelector(
      `.setlist-song[data-song-id="${songId}"]`
    );

    if (existingSong) {
      return; // Already there, don't duplicate
    }

    // Find the song in band songs or another set
    let sourceSong = document.querySelector(
      `.band-song[data-song-id="${songId}"]`
    );
    if (!sourceSong) {
      sourceSong = document.querySelector(
        `.setlist-song[data-song-id="${songId}"]`
      );
    }

    if (sourceSong) {
      // Create new setlist song
      const songClone = this.createSetlistSong(sourceSong, setName);

      // Insert at the specified position
      if (position === 0) {
        targetZone.insertBefore(songClone, targetZone.firstChild);
      } else {
        const songs = targetZone.querySelectorAll(".setlist-song");
        if (position < songs.length) {
          targetZone.insertBefore(songClone, songs[position]);
        } else {
          targetZone.appendChild(songClone);
        }
      }

      // Make it draggable
      this.makeDraggable(songClone);

      // Update displays
      targetZone.classList.add("has-songs");
      this.updateSetDisplay(setName);

      // Remove from source if it was a band song
      if (sourceSong.classList.contains("band-song")) {
        sourceSong.style.display = "none";
        setTimeout(() => sourceSong.remove(), 100);
      } else if (sourceSong.classList.contains("setlist-song")) {
        // Remove from original set
        const originalZone = sourceSong.parentElement;
        sourceSong.remove();

        if (originalZone.children.length === 0) {
          originalZone.classList.remove("has-songs");
        }
        this.updateSetDisplay(originalZone.dataset.setName);
      }

      // Visual feedback
      this.highlightElement(songClone);
    }

    // Auto-save the changes
    this.autoSave();
  }

  handleRemoteSongRemoved(data) {
    const { songId, fromSet } = data;

    // Debug: Check all songs with this ID in the DOM
    const allSongsWithId = document.querySelectorAll(
      `[data-song-id="${songId}"]`
    );
    console.log(
      "[REMOTE REMOVE] All songs with ID:",
      Array.from(allSongsWithId).map((el) => ({
        className: el.className,
        parentSet: el.parentElement?.dataset?.setName || "unknown",
      }))
    );

    const songElement = document.querySelector(
      `.setlist-song[data-song-id="${songId}"]`
    );
    if (!songElement) {
      console.log(
        "[REMOTE REMOVE] Song not found, all setlist songs:",
        Array.from(document.querySelectorAll(".setlist-song")).map((el) => ({
          id: el.dataset.songId,
          set: el.parentElement?.dataset?.setName || "unknown",
        }))
      );
      return;
    }

    // Handle different removal logic based on set
    if (fromSet === "Maybe") {
      // Remove completely and restore to band songs
      songElement.remove();
      this.restoreToBandSongs(songId, songElement.dataset.songTime);
    } else {
      // Move to maybe if removing from regular set
      const maybeZone = document.querySelector(
        '.drop-zone[data-set-name="Maybe"]'
      );
      if (maybeZone) {
        maybeZone.appendChild(songElement);
        maybeZone.classList.add("has-songs");
      } else {
        console.log(`[REMOTE REMOVE] Maybe zone not found`);
      }
    }

    // Update displays
    this.updateSetDisplay(fromSet);
    if (fromSet !== "Maybe") {
      this.updateSetDisplay("Maybe");
    }

    // Check if original set is empty
    const originalZone = document.querySelector(
      `.drop-zone[data-set-name="${fromSet}"]`
    );
    if (originalZone && originalZone.children.length === 0) {
      originalZone.classList.remove("has-songs");
    }

    // Auto-save the changes
    this.autoSave();
  }

  handleRemoteSongMoved(data) {
    const { songId, fromSet, toSet, position } = data;

    const songElement = document.querySelector(
      `.setlist-song[data-song-id="${songId}"]`
    );
    if (!songElement) {
      return;
    }

    const targetZone = document.querySelector(
      `.drop-zone[data-set-name="${toSet}"]`
    );
    if (!targetZone) {
      return;
    }

    // For moves within the same set, we need to handle the position calculation differently
    if (fromSet === toSet) {
      // Get all songs in the target zone (excluding the one being moved)
      const allSongs = Array.from(targetZone.querySelectorAll(".setlist-song"));
      const currentIndex = allSongs.indexOf(songElement);

      // Remove the song temporarily to calculate the correct position
      songElement.remove();

      // Re-insert at the correct position
      const remainingSongs = targetZone.querySelectorAll(".setlist-song");

      if (position === 0) {
        targetZone.insertBefore(songElement, targetZone.firstChild);
      } else if (position >= remainingSongs.length) {
        targetZone.appendChild(songElement);
      } else {
        targetZone.insertBefore(songElement, remainingSongs[position]);
      }
    } else {
      // Moving between different sets
      // Remove from source set first
      const sourceZone = document.querySelector(
        `.drop-zone[data-set-name="${fromSet}"]`
      );
      if (sourceZone) {
        songElement.remove();

        // Update source set display
        this.updateSetDisplay(fromSet);
        if (sourceZone.children.length === 0) {
          sourceZone.classList.remove("has-songs");
        }
      }

      // Insert into target set
      const songs = targetZone.querySelectorAll(".setlist-song");

      if (position === 0) {
        targetZone.insertBefore(songElement, targetZone.firstChild);
      } else if (position >= songs.length) {
        targetZone.appendChild(songElement);
      } else {
        targetZone.insertBefore(songElement, songs[position]);
      }
    }

    // Update displays
    targetZone.classList.add("has-songs");
    this.updateSetDisplay(toSet);

    // Visual feedback
    this.highlightElement(songElement);

    // Auto-save the changes
    this.autoSave();
  }

  highlightElement(element) {
    // Add a brief highlight effect
    element.style.transition = "background-color 0.3s ease";
    element.style.backgroundColor = "#fff3cd";

    setTimeout(() => {
      element.style.backgroundColor = "";
      element.style.transition = "";
    }, 1000);
  }

  autoSave() {
    // Clear any existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Save immediately for critical changes, debounce for minor changes
    const shouldSaveImmediately = this.hasCriticalChanges;
    this.hasCriticalChanges = false;

    if (shouldSaveImmediately) {
      this.saveSetlist();
    } else {
      // Debounce auto-save for minor changes
      this.saveTimeout = setTimeout(() => {
        this.saveSetlist();
      }, 1000); // Reduced from 2000ms to 1000ms for faster saves
    }
  }

  saveSetlist() {
    const sets = {};

    document.querySelectorAll(".drop-zone").forEach((zone) => {
      const setName = zone.dataset.setName;
      const songs = Array.from(zone.querySelectorAll(".setlist-song")).map(
        (song) => parseInt(song.dataset.songId)
      );
      sets[setName] = songs;
    });

    fetch(`/setlists/${this.setlistId}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sets }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showSaveStatus("saved");
        } else {
          this.showSaveStatus("error");
          console.error("[SAVE] Server returned error:", data.error);
        }
      })
      .catch((error) => {
        console.error("[SAVE] Save error:", error);
        this.showSaveStatus("error");
      });
  }

  showSaveStatus(status) {
    const statusElement = document.getElementById("save-status");
    if (statusElement) {
      statusElement.className = `badge ${status === "saved" ? "bg-success" : "bg-danger"}`;
      statusElement.textContent = status === "saved" ? "Saved" : "Error saving";

      setTimeout(() => {
        statusElement.className = "badge bg-secondary";
        statusElement.textContent = "Auto-saving...";
      }, 2000);
    }
  }

  setupEventListeners() {
    // Manual save button
    const saveBtn = document.getElementById("save-setlist");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.saveSetlist();
      });
    }

    // Reorder within sets using SortableJS
    document.querySelectorAll(".drop-zone").forEach((zone) => {
      new Sortable(zone, {
        group: {
          name: "setlist-songs",
          pull: true,
          put: true,
        },
        animation: 150,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        filter: ".band-song", // Don't let SortableJS handle band songs
        preventOnFilter: false, // Allow our custom handler for band songs
        onStart: (evt) => {
          // Disable our custom drag handlers when SortableJS is active
          this.sortableActive = true;

          // Clean up any existing drag styles
          this.clearDragStyles(evt.item);
        },
        onEnd: (evt) => {
          // Re-enable our custom drag handlers
          this.sortableActive = false;

          // Ensure drag styles are cleaned up
          this.clearDragStyles(evt.item);

          // Clean up any other dragged elements that might be lingering
          document
            .querySelectorAll(".setlist-song, .band-song")
            .forEach((el) => {
              this.clearDragStyles(el);
            });

          // Update displays for both source and target sets
          const fromSet = evt.from.dataset.setName;
          const toSet = evt.to.dataset.setName;

          if (fromSet) {
            this.updateSetDisplay(fromSet);
            if (evt.from.children.length === 0) {
              evt.from.classList.remove("has-songs");
            }
          }

          if (toSet && toSet !== fromSet) {
            this.updateSetDisplay(toSet);
            evt.to.classList.add("has-songs");
          }

          // Broadcast the move (both between sets and reordering within same set)
          const songId = evt.item.dataset.songId;
          const newPosition = Array.from(
            evt.to.querySelectorAll(".setlist-song")
          ).indexOf(evt.item);

          this.broadcastUpdate("song-moved", {
            songId,
            fromSet,
            toSet,
            position: newPosition,
          });

          // Mark as critical change and auto-save
          this.hasCriticalChanges = true;
          this.autoSave();
        },
      });
    });
  }

  setupExistingRemoveButtons() {
    document
      .querySelectorAll(".setlist-song .btn-outline-danger")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const songElement = button.closest(".setlist-song");
          const setName = songElement.parentElement.dataset.setName;
          const songId = songElement.dataset.songId;
          this.removeSongFromSet(songElement, setName);
        });
      });
  }

  clearDragStyles(element) {
    if (element) {
      element.classList.remove(
        "dragging",
        "sortable-ghost",
        "sortable-chosen",
        "sortable-drag"
      );
      element.style.opacity = "";
      element.style.transform = "";
      element.style.backgroundColor = "";
      element.style.filter = "";
      element.style.transition = "";
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const setlistContainer = document.querySelector(".setlist-editor");
  if (setlistContainer) {
    const setlistId = setlistContainer.dataset.setlistId;
    new SetlistEditor(setlistId);
  }
});
