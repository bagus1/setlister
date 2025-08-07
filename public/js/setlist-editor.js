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

        // Touch drag state
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.dragPreview = null;

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
        this.socket.emit('join-setlist', this.setlistId);

        this.socket.on('setlist-updated', (data) => {
            this.handleRemoteUpdate(data);
        });

        window.addEventListener('beforeunload', () => {
            this.socket.emit('leave-setlist', this.setlistId);
        });
    }

    setupDragAndDrop() {
        // Make band songs draggable (only these use our custom system)
        document.querySelectorAll('.band-song').forEach(song => {
            this.makeDraggable(song);
        });

        // Setup drop zones
        document.querySelectorAll('.drop-zone').forEach(zone => {
            this.setupDropZone(zone);
        });

        // Don't make setlist songs draggable with our custom system
        // Let SortableJS handle setlist song reordering
    }

    makeDraggable(element) {
        // Only make band songs draggable with our custom system
        // Let SortableJS handle setlist songs
        if (element.classList.contains('setlist-song')) {
            return; // Don't add our custom drag handlers to setlist songs
        }

        // Remove HTML5 draggable attribute
        element.draggable = false;

        // Add unified event listeners for both mouse and touch
        element.addEventListener('mousedown', (e) => this.handleDragStart(e, element));
        element.addEventListener('touchstart', (e) => this.handleDragStart(e, element));

        // Prevent default touch behaviors
        element.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    handleDragStart(e, element) {
        // Don't start drag if SortableJS is active
        if (this.sortableActive) {
            return;
        }

        // Prevent default behaviors
        e.preventDefault();

        // Get coordinates (works for both mouse and touch)
        const coords = this.getEventCoordinates(e);
        console.log('[DRAG START] Event type:', e.type, 'Coordinates:', coords);

        this.isDragging = true;
        this.draggedElement = element;

        // Calculate offset for smooth dragging
        const rect = element.getBoundingClientRect();
        this.dragOffsetX = coords.x - rect.left;
        this.dragOffsetY = coords.y - rect.top;

        // Store touch start position for touch devices
        if (e.touches) {
            this.touchStartX = coords.x;
            this.touchStartY = coords.y;
            console.log('[DRAG START] Touch device detected, start pos:', { x: this.touchStartX, y: this.touchStartY });
        }

        // Create drag preview
        this.createDragPreview(element);

        // Add dragging class
        element.classList.add('dragging');

        // Add global event listeners
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('touchmove', this.handleDragMove, { passive: false });
        document.addEventListener('touchend', this.handleDragEnd);

        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    }

    handleDragMove = (e) => {
        if (!this.isDragging || !this.draggedElement) return;

        e.preventDefault();

        const coords = this.getEventCoordinates(e);
        console.log('[DRAG MOVE] Event type:', e.type, 'Coordinates:', coords);

        // Update drag preview position
        if (this.dragPreview) {
            this.dragPreview.style.left = (coords.x - this.dragOffsetX) + 'px';
            this.dragPreview.style.top = (coords.y - this.dragOffsetY) + 'px';
        }

        // Check for drop zones
        this.checkDropZones(coords);
    }

    handleDragEnd = (e) => {
        if (!this.isDragging) return;

        e.preventDefault();

        const coords = this.getEventCoordinates(e);
        console.log('[DRAG END] Coordinates:', coords);

        // Find drop zone at current position
        const dropZone = this.findDropZoneAtPosition(coords);
        console.log('[DRAG END] Drop zone found:', dropZone?.dataset?.setName);

        if (dropZone) {
            const dropPosition = this.calculateDropPosition(dropZone, coords.y);
            console.log('[DRAG END] Drop position:', dropPosition);
            this.handleDrop(dropZone, dropPosition);
        } else {
            console.log('[DRAG END] No drop zone found at coordinates');
        }

        // Clean up
        this.cleanupDrag();
    }

    getEventCoordinates(e) {
        let coords;

        if (e.touches && e.touches[0]) {
            coords = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            console.log('[COORDS] Touch event, using touches[0]:', coords);
        } else if (e.changedTouches && e.changedTouches[0]) {
            coords = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            console.log('[COORDS] Touch event, using changedTouches[0]:', coords);
        } else {
            coords = { x: e.clientX, y: e.clientY };
            console.log('[COORDS] Mouse event:', coords);
        }

        return coords;
    }

    createDragPreview(element) {
        // Remove existing preview
        if (this.dragPreview) {
            this.dragPreview.remove();
        }

        // Create new preview
        this.dragPreview = element.cloneNode(true);
        this.dragPreview.style.position = 'fixed';
        this.dragPreview.style.zIndex = '9999';
        this.dragPreview.style.opacity = '0.9';
        this.dragPreview.style.pointerEvents = 'none';
        this.dragPreview.style.transform = 'none'; // Remove tilt
        this.dragPreview.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        this.dragPreview.style.border = '2px solid #007bff';
        this.dragPreview.style.borderRadius = '8px';
        this.dragPreview.style.backgroundColor = '#ffffff';

        // Remove any existing event listeners from preview
        const newPreview = this.dragPreview.cloneNode(true);
        this.dragPreview = newPreview;

        document.body.appendChild(this.dragPreview);
    }

    checkDropZones(coords) {
        // Remove all drag-over classes
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });

        // Find zone under cursor
        const dropZone = this.findDropZoneAtPosition(coords);
        if (dropZone) {
            dropZone.classList.add('drag-over');
        }
    }

    findDropZoneAtPosition(coords) {
        const dropZones = document.querySelectorAll('.drop-zone');
        console.log('[FIND DROP ZONE] Looking for drop zone at coordinates:', coords);

        for (let zone of dropZones) {
            const rect = zone.getBoundingClientRect();
            console.log('[FIND DROP ZONE] Checking zone:', zone.dataset.setName, 'Rect:', {
                left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom
            });

            if (coords.x >= rect.left && coords.x <= rect.right &&
                coords.y >= rect.top && coords.y <= rect.bottom) {
                console.log('[FIND DROP ZONE] Found matching zone:', zone.dataset.setName);
                return zone;
            }
        }

        console.log('[FIND DROP ZONE] No drop zone found');
        return null;
    }

    cleanupDrag() {
        this.isDragging = false;

        // Remove global event listeners
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        document.removeEventListener('touchmove', this.handleDragMove);
        document.removeEventListener('touchend', this.handleDragEnd);

        // Remove drag preview
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }

        // Remove drag-over classes
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });

        // Clear dragging class
        if (this.draggedElement) {
            this.clearDragStyles(this.draggedElement);
            this.draggedElement = null;
        }

        // Restore text selection
        document.body.style.userSelect = '';
    }

    setupDropZone(zone) {
        // Remove HTML5 drop events - we handle drops in handleDragEnd
        // Just add visual feedback for drag-over
        zone.addEventListener('mouseenter', (e) => {
            if (this.isDragging) {
                zone.classList.add('drag-over');
            }
        });

        zone.addEventListener('mouseleave', (e) => {
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });
    }

    calculateDropPosition(dropZone, clientY) {
        const songs = dropZone.querySelectorAll('.setlist-song');
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
        // Don't handle if SortableJS is active
        if (this.sortableActive) {
            return;
        }

        const songId = this.draggedElement.dataset.songId;
        const setName = dropZone.dataset.setName;

        // Ensure dragging class is removed
        this.draggedElement.classList.remove('dragging');
        this.clearDragStyles(this.draggedElement);

        // Check if this is a reorder within the same set (handled by SortableJS)
        if (this.draggedElement.classList.contains('setlist-song') &&
            this.draggedElement.parentElement === dropZone) {
            // This is a reorder within the same set, let SortableJS handle it
            return;
        }

        // Check if song already exists in this set to prevent duplicates
        const existingSong = dropZone.querySelector(`.setlist-song[data-song-id="${songId}"]`);
        if (existingSong) {
            // Song already exists in this set, don't add duplicate
            return;
        }

        // Clone the song element for the setlist
        const songClone = this.createSetlistSong(this.draggedElement, setName);

        // Insert at the specific position
        const songs = dropZone.querySelectorAll('.setlist-song');
        if (dropPosition === 0) {
            dropZone.insertBefore(songClone, dropZone.firstChild);
        } else if (dropPosition >= songs.length) {
            dropZone.appendChild(songClone);
        } else {
            dropZone.insertBefore(songClone, songs[dropPosition]);
        }

        dropZone.classList.add('has-songs');

        // Make the new song draggable
        this.makeDraggable(songClone);

        // Remove from band songs if it came from there (not from another set)
        if (this.draggedElement.classList.contains('band-song')) {
            this.draggedElement.style.display = 'none'; // Hide immediately
            setTimeout(() => {
                if (this.draggedElement) {
                    this.draggedElement.remove(); // Remove after a short delay
                }
            }, 100);
        } else if (this.draggedElement.classList.contains('setlist-song')) {
            // If moving from another set, remove from original location
            const originalDropZone = this.draggedElement.parentElement;
            this.draggedElement.remove();

            // Update original set display
            if (originalDropZone) {
                this.updateSetDisplay(originalDropZone.dataset.setName);
                if (originalDropZone.children.length === 0) {
                    originalDropZone.classList.remove('has-songs');
                }
            }
        }

        // Update set display
        this.updateSetDisplay(setName);

        // Broadcast update with the actual position
        const actualPosition = Array.from(dropZone.querySelectorAll('.setlist-song')).indexOf(songClone);
        this.broadcastUpdate('song-added', {
            songId,
            setName,
            position: actualPosition
        });

        // Mark as critical change and auto-save
        this.hasCriticalChanges = true;
        this.autoSave();
    }

    createSetlistSong(originalSong, setName) {
        const clone = originalSong.cloneNode(true);
        clone.classList.remove('band-song');
        clone.classList.add('setlist-song');

        // Remove any existing X buttons to prevent duplication
        clone.querySelectorAll('.btn-outline-danger').forEach(btn => btn.remove());

        // Get the song title element and modify its structure
        const titleElement = clone.querySelector('.song-title');
        if (titleElement) {
            // Create a container for title and remove button
            const titleContainer = document.createElement('div');
            titleContainer.className = 'd-flex align-items-center';
            titleContainer.style.minHeight = '1.2em';

            // Create the title with overflow hidden
            const titleText = document.createElement('div');
            titleText.className = 'song-title-text';
            titleText.style.overflow = 'hidden';
            titleText.style.textOverflow = 'ellipsis';
            titleText.style.whiteSpace = 'nowrap';
            titleText.style.flex = '1';
            titleText.textContent = titleElement.textContent;

            // Create small remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-sm btn-outline-danger ms-2';
            removeBtn.style.fontSize = '0.7rem';
            removeBtn.style.padding = '0.1rem 0.3rem';
            removeBtn.style.lineHeight = '1';
            removeBtn.innerHTML = '<i class="bi bi-x"></i>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('[X BUTTON] Clicked, calling removeSongFromSet with:', { clone, setName });
                console.log('[X BUTTON] clone is:', clone);
                console.log('[X BUTTON] clone.dataset.songId:', clone.dataset.songId);
                this.removeSongFromSet(clone, setName);
            });

            // Assemble the new structure
            titleContainer.appendChild(titleText);
            titleContainer.appendChild(removeBtn);

            // Replace the original title element
            titleElement.parentNode.replaceChild(titleContainer, titleElement);
        } else {
            // Fallback if no title element found - add button at the end
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-sm btn-outline-danger ms-2';
            removeBtn.style.fontSize = '0.7rem';
            removeBtn.style.padding = '0.1rem 0.3rem';
            removeBtn.innerHTML = '<i class="bi bi-x"></i>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('[X BUTTON FALLBACK] Clicked, calling removeSongFromSet with:', { clone, setName });
                console.log('[X BUTTON FALLBACK] clone is:', clone);
                console.log('[X BUTTON FALLBACK] clone.dataset.songId:', clone.dataset.songId);
                this.removeSongFromSet(clone, setName);
            });
            clone.appendChild(removeBtn);
        }

        return clone;
    }

    removeSongFromSet(songElement, setName) {
        console.log('[REMOVE] removeSongFromSet called:', { setName, songId: songElement.dataset.songId });

        const songId = songElement.dataset.songId;
        const songTime = songElement.dataset.songTime;
        const dropZone = songElement.parentElement;

        // Handle different removal logic based on set
        if (setName === 'Maybe') {
            // Remove completely from maybe and restore to band songs
            console.log('[REMOVE] Removing from Maybe, restoring to band songs');
            songElement.remove();
            // Call restore after removing from DOM so the check works correctly
            setTimeout(() => {
                console.log('[REMOVE] Calling restoreToBandSongs after DOM removal');
                this.restoreToBandSongs(songId, songTime);
            }, 0);
        } else {
            // Move to maybe if removing from regular set
            console.log('[REMOVE] Moving from', setName, 'to Maybe');
            const maybeZone = document.querySelector('.drop-zone[data-set-name="Maybe"]');
            if (maybeZone) {
                maybeZone.appendChild(songElement);
                maybeZone.classList.add('has-songs');
                console.log('[REMOVE] Song moved to Maybe zone');

                // Update the remove button's event listener to use "Maybe" as the setName
                const removeBtn = songElement.querySelector('.btn-outline-danger');
                if (removeBtn) {
                    console.log('[REMOVE] Found remove button, updating event listener');
                    // Remove the old event listener and add a new one
                    const newRemoveBtn = removeBtn.cloneNode(true);
                    removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
                    newRemoveBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        console.log('[X BUTTON] Clicked, calling removeSongFromSet with:', { songElement, setName: 'Maybe' });
                        this.removeSongFromSet(songElement, 'Maybe');
                    });
                    console.log('[REMOVE] Event listener updated successfully');
                } else {
                    console.error('[REMOVE] Could not find remove button in song element');
                }
            }
        }

        // Update displays
        this.updateSetDisplay(setName);
        if (setName !== 'Maybe') {
            this.updateSetDisplay('Maybe');
        }

        // Check if drop zone is empty
        if (dropZone.children.length === 0) {
            dropZone.classList.remove('has-songs');
        }

        // Broadcast update
        this.broadcastUpdate('song-removed', {
            songId,
            fromSet: setName
        });

        // Auto-save
        console.log('[REMOVE] Calling autoSave');
        this.hasCriticalChanges = true;
        this.autoSave();
    }

    restoreToBandSongs(songId, songTime) {
        console.log('[RESTORE] restoreToBandSongs called for song ID:', songId);

        // Check if song is already visible in band songs area
        const bandSongsContainer = document.querySelector('.col-md-4 .card-body');
        const existingBandSong = bandSongsContainer?.querySelector(`.band-song[data-song-id="${songId}"]`);
        if (existingBandSong && existingBandSong.offsetParent !== null) {
            console.log('[RESTORE] Song already visible in band songs, skipping');
            return; // Already there and visible, don't duplicate
        }

        // Check if song is still in any other set (should be 0 since we removed it from Maybe)
        const songInOtherSets = document.querySelectorAll(`.setlist-song[data-song-id="${songId}"]`);
        console.log('[RESTORE] Songs found in other sets:', songInOtherSets.length);
        if (songInOtherSets.length > 0) {
            console.log('[RESTORE] Song still in other sets, not restoring:', songInOtherSets.length);
            return; // Still in use elsewhere, don't restore
        }

        console.log('[RESTORE] Proceeding with restoration for song ID:', songId);
        // Fetch song details from server and recreate band song element
        this.fetchAndRestoreSong(songId);
    }

    async fetchAndRestoreSong(songId) {
        try {
            console.log('[RESTORE] Fetching song details for ID:', songId);
            const response = await fetch(`/songs/api/song/${songId}`);
            console.log('[RESTORE] API response status:', response.status);

            if (!response.ok) {
                console.error('[RESTORE] API request failed:', response.status, response.statusText);
                return;
            }

            const song = await response.json();
            console.log('[RESTORE] Song data received:', song.title);

            // Create band song element
            const bandSongElement = this.createBandSongElement(song);

            // Add to band songs area - use more specific selector
            const bandSongsContainer = document.querySelector('.col-md-4 .card-body');
            if (bandSongsContainer) {
                console.log('[RESTORE] Found band songs container');
                // Insert in alphabetical order
                const existingSongs = Array.from(bandSongsContainer.querySelectorAll('.band-song'));
                let insertPosition = existingSongs.length;

                for (let i = 0; i < existingSongs.length; i++) {
                    const existingTitle = existingSongs[i].querySelector('.song-title').textContent.trim();
                    if (song.title.localeCompare(existingTitle) < 0) {
                        insertPosition = i;
                        break;
                    }
                }

                if (insertPosition < existingSongs.length) {
                    bandSongsContainer.insertBefore(bandSongElement, existingSongs[insertPosition]);
                } else {
                    bandSongsContainer.appendChild(bandSongElement);
                }

                // Make it draggable
                this.makeDraggable(bandSongElement);
                console.log('[RESTORE] Song successfully restored to band songs list');
            } else {
                console.error('[RESTORE] Could not find band songs container');
            }
        } catch (error) {
            console.error('Error restoring song to band songs:', error);
        }
    }

    createBandSongElement(song) {
        const songCard = document.createElement('div');
        songCard.className = 'song-card band-song';
        songCard.setAttribute('data-song-id', song.id);
        songCard.setAttribute('data-song-time', song.time || 0);

        let artistHtml = '';
        if (song.Artists && song.Artists.length > 0) {
            artistHtml = `<div class="song-artist">by ${song.Artists[0].name}</div>`;
        }

        let vocalistHtml = '';
        if (song.Vocalist) {
            vocalistHtml = `<span class="song-vocalist">${song.Vocalist.name}</span>`;
        }

        let keyHtml = '';
        if (song.key) {
            keyHtml = `<span class="song-key">${song.key}</span>`;
        }

        let timeHtml = '';
        if (song.time) {
            const minutes = Math.floor(song.time / 60);
            const seconds = (song.time % 60).toString().padStart(2, '0');
            timeHtml = `<span class="song-time">${minutes}:${seconds}</span>`;
        }

        songCard.innerHTML = `
            <div class="song-title">${song.title}</div>
            ${artistHtml}
            <div class="d-flex justify-content-between align-items-center mt-2">
                <div>
                    ${vocalistHtml}
                    ${keyHtml}
                </div>
                ${timeHtml}
            </div>
        `;

        return songCard;
    }

    updateSetDisplay(setName) {
        const dropZone = document.querySelector(`.drop-zone[data-set-name="${setName}"]`);
        const songs = dropZone.querySelectorAll('.setlist-song');

        // Update set time if not Maybe
        if (setName !== 'Maybe') {
            let totalTime = 0;
            songs.forEach(song => {
                const time = parseInt(song.dataset.songTime) || 0;
                totalTime += time;
            });

            const timeDisplay = document.querySelector(`.set-time[data-set="${setName}"]`);
            if (timeDisplay) {
                timeDisplay.textContent = this.formatTime(totalTime);
            }
        }

        // Update song count
        const countDisplay = document.querySelector(`.song-count[data-set="${setName}"]`);
        if (countDisplay) {
            countDisplay.textContent = `(${songs.length} songs)`;
        }
    }

    formatTime(seconds) {
        if (!seconds) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    broadcastUpdate(action, data) {
        this.socket.emit('setlist-update', {
            setlistId: this.setlistId,
            action,
            data
        });
    }

    handleRemoteUpdate(updateData) {
        // Handle updates from other users
        console.log('Remote update received:', updateData);

        const { action, data } = updateData;

        switch (action) {
            case 'song-added':
                this.handleRemoteSongAdded(data);
                break;
            case 'song-removed':
                this.handleRemoteSongRemoved(data);
                break;
            case 'song-moved':
                this.handleRemoteSongMoved(data);
                break;
        }
    }

    handleRemoteSongAdded(data) {
        const { songId, setName, position } = data;

        // Check if song is already in the target set
        const targetZone = document.querySelector(`.drop-zone[data-set-name="${setName}"]`);
        const existingSong = targetZone.querySelector(`.setlist-song[data-song-id="${songId}"]`);

        if (existingSong) {
            return; // Already there, don't duplicate
        }

        // Find the song in band songs or another set
        let sourceSong = document.querySelector(`.band-song[data-song-id="${songId}"]`);
        if (!sourceSong) {
            sourceSong = document.querySelector(`.setlist-song[data-song-id="${songId}"]`);
        }

        if (sourceSong) {
            // Create new setlist song
            const songClone = this.createSetlistSong(sourceSong, setName);

            // Insert at the specified position
            if (position === 0) {
                targetZone.insertBefore(songClone, targetZone.firstChild);
            } else {
                const songs = targetZone.querySelectorAll('.setlist-song');
                if (position < songs.length) {
                    targetZone.insertBefore(songClone, songs[position]);
                } else {
                    targetZone.appendChild(songClone);
                }
            }

            // Make it draggable
            this.makeDraggable(songClone);

            // Update displays
            targetZone.classList.add('has-songs');
            this.updateSetDisplay(setName);

            // Remove from source if it was a band song
            if (sourceSong.classList.contains('band-song')) {
                sourceSong.style.display = 'none';
                setTimeout(() => sourceSong.remove(), 100);
            } else if (sourceSong.classList.contains('setlist-song')) {
                // Remove from original set
                const originalZone = sourceSong.parentElement;
                sourceSong.remove();

                if (originalZone.children.length === 0) {
                    originalZone.classList.remove('has-songs');
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

        console.log(`[REMOTE REMOVE] Song ${songId} removed from ${fromSet}`);

        // Debug: Check all songs with this ID in the DOM
        const allSongsWithId = document.querySelectorAll(`[data-song-id="${songId}"]`);
        console.log(`[REMOTE REMOVE] Found ${allSongsWithId.length} elements with song ID ${songId}:`,
            Array.from(allSongsWithId).map(el => ({
                className: el.className,
                parentSet: el.parentElement?.dataset?.setName || 'unknown'
            }))
        );

        const songElement = document.querySelector(`.setlist-song[data-song-id="${songId}"]`);
        if (!songElement) {
            console.log(`[REMOTE REMOVE] Song element not found for ID ${songId}`);
            console.log(`[REMOTE REMOVE] Available setlist songs:`,
                Array.from(document.querySelectorAll('.setlist-song')).map(el => ({
                    id: el.dataset.songId,
                    set: el.parentElement?.dataset?.setName || 'unknown'
                }))
            );
            return;
        }

        console.log(`[REMOTE REMOVE] Found song element in set: ${songElement.parentElement?.dataset?.setName}`);

        // Handle different removal logic based on set
        if (fromSet === 'Maybe') {
            // Remove completely and restore to band songs
            console.log(`[REMOTE REMOVE] Removing from Maybe, restoring to band songs`);
            songElement.remove();
            this.restoreToBandSongs(songId, songElement.dataset.songTime);
        } else {
            // Move to maybe if removing from regular set
            console.log(`[REMOTE REMOVE] Moving from ${fromSet} to Maybe`);
            const maybeZone = document.querySelector('.drop-zone[data-set-name="Maybe"]');
            if (maybeZone) {
                console.log(`[REMOTE REMOVE] Moving song to Maybe zone`);
                maybeZone.appendChild(songElement);
                maybeZone.classList.add('has-songs');
                console.log(`[REMOTE REMOVE] Song moved to Maybe, has-songs class added`);
            } else {
                console.log(`[REMOTE REMOVE] Maybe zone not found`);
            }
        }

        // Update displays
        this.updateSetDisplay(fromSet);
        if (fromSet !== 'Maybe') {
            this.updateSetDisplay('Maybe');
        }

        // Check if original set is empty
        const originalZone = document.querySelector(`.drop-zone[data-set-name="${fromSet}"]`);
        if (originalZone && originalZone.children.length === 0) {
            originalZone.classList.remove('has-songs');
        }

        console.log(`[REMOTE REMOVE] Remove completed successfully`);

        // Auto-save the changes
        this.autoSave();
    }

    handleRemoteSongMoved(data) {
        const { songId, fromSet, toSet, position } = data;

        console.log(`[REMOTE MOVE] Song ${songId} from ${fromSet} to ${toSet} at position ${position}`);

        const songElement = document.querySelector(`.setlist-song[data-song-id="${songId}"]`);
        if (!songElement) {
            console.log(`[REMOTE MOVE] Song element not found for ID ${songId}`);
            return;
        }

        const targetZone = document.querySelector(`.drop-zone[data-set-name="${toSet}"]`);
        if (!targetZone) {
            console.log(`[REMOTE MOVE] Target zone not found for set ${toSet}`);
            return;
        }

        // For moves within the same set, we need to handle the position calculation differently
        if (fromSet === toSet) {
            console.log(`[REMOTE MOVE] Same-set reorder: ${fromSet} -> ${toSet} at position ${position}`);

            // Get all songs in the target zone (excluding the one being moved)
            const allSongs = Array.from(targetZone.querySelectorAll('.setlist-song'));
            const currentIndex = allSongs.indexOf(songElement);

            console.log(`[REMOTE MOVE] Current index: ${currentIndex}, Target position: ${position}`);

            // Remove the song temporarily to calculate the correct position
            songElement.remove();

            // Re-insert at the correct position
            const remainingSongs = targetZone.querySelectorAll('.setlist-song');
            console.log(`[REMOTE MOVE] Remaining songs count: ${remainingSongs.length}`);

            if (position === 0) {
                targetZone.insertBefore(songElement, targetZone.firstChild);
            } else if (position >= remainingSongs.length) {
                targetZone.appendChild(songElement);
            } else {
                targetZone.insertBefore(songElement, remainingSongs[position]);
            }
        } else {
            console.log(`[REMOTE MOVE] Cross-set move: ${fromSet} -> ${toSet} at position ${position}`);

            // Moving between different sets
            // Remove from source set first
            const sourceZone = document.querySelector(`.drop-zone[data-set-name="${fromSet}"]`);
            if (sourceZone) {
                songElement.remove();

                // Update source set display
                this.updateSetDisplay(fromSet);
                if (sourceZone.children.length === 0) {
                    sourceZone.classList.remove('has-songs');
                }
            }

            // Insert into target set
            const songs = targetZone.querySelectorAll('.setlist-song');
            console.log(`[REMOTE MOVE] Target songs count: ${songs.length}`);

            if (position === 0) {
                targetZone.insertBefore(songElement, targetZone.firstChild);
            } else if (position >= songs.length) {
                targetZone.appendChild(songElement);
            } else {
                targetZone.insertBefore(songElement, songs[position]);
            }
        }

        // Update displays
        targetZone.classList.add('has-songs');
        this.updateSetDisplay(toSet);

        // Visual feedback
        this.highlightElement(songElement);

        console.log(`[REMOTE MOVE] Move completed successfully`);

        // Auto-save the changes
        this.autoSave();
    }

    highlightElement(element) {
        // Add a brief highlight effect
        element.style.transition = 'background-color 0.3s ease';
        element.style.backgroundColor = '#fff3cd';

        setTimeout(() => {
            element.style.backgroundColor = '';
            element.style.transition = '';
        }, 1000);
    }

    autoSave() {
        console.log('[AUTOSAVE] Auto-save triggered');
        // Clear any existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Save immediately for critical changes, debounce for minor changes
        const shouldSaveImmediately = this.hasCriticalChanges;
        this.hasCriticalChanges = false;

        if (shouldSaveImmediately) {
            console.log('[AUTOSAVE] Executing immediate save for critical changes');
            this.saveSetlist();
        } else {
            // Debounce auto-save for minor changes
            this.saveTimeout = setTimeout(() => {
                console.log('[AUTOSAVE] Executing save after debounce');
                this.saveSetlist();
            }, 1000); // Reduced from 2000ms to 1000ms for faster saves
        }
    }

    saveSetlist() {
        const sets = {};

        document.querySelectorAll('.drop-zone').forEach(zone => {
            const setName = zone.dataset.setName;
            const songs = Array.from(zone.querySelectorAll('.setlist-song')).map(song =>
                parseInt(song.dataset.songId)
            );
            sets[setName] = songs;
        });

        console.log('[SAVE] Sending sets data:', sets);

        fetch(`/setlists/${this.setlistId}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sets })
        })
            .then(response => response.json())
            .then(data => {
                console.log('[SAVE] Server response:', data);
                if (data.success) {
                    this.showSaveStatus('saved');
                    console.log('[SAVE] Setlist saved successfully');
                } else {
                    this.showSaveStatus('error');
                    console.error('[SAVE] Server returned error:', data.error);
                }
            })
            .catch(error => {
                console.error('[SAVE] Save error:', error);
                this.showSaveStatus('error');
            });
    }

    showSaveStatus(status) {
        const statusElement = document.getElementById('save-status');
        if (statusElement) {
            statusElement.className = `badge ${status === 'saved' ? 'bg-success' : 'bg-danger'}`;
            statusElement.textContent = status === 'saved' ? 'Saved' : 'Error saving';

            setTimeout(() => {
                statusElement.className = 'badge bg-secondary';
                statusElement.textContent = 'Auto-saving...';
            }, 2000);
        }
    }

    setupEventListeners() {
        // Manual save button
        const saveBtn = document.getElementById('save-setlist');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSetlist();
            });
        }

        // Reorder within sets using SortableJS
        document.querySelectorAll('.drop-zone').forEach(zone => {
            new Sortable(zone, {
                group: {
                    name: 'setlist-songs',
                    pull: true,
                    put: true
                },
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                filter: '.band-song', // Don't let SortableJS handle band songs
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
                    document.querySelectorAll('.setlist-song, .band-song').forEach(el => {
                        this.clearDragStyles(el);
                    });

                    // Update displays for both source and target sets
                    const fromSet = evt.from.dataset.setName;
                    const toSet = evt.to.dataset.setName;

                    if (fromSet) {
                        this.updateSetDisplay(fromSet);
                        if (evt.from.children.length === 0) {
                            evt.from.classList.remove('has-songs');
                        }
                    }

                    if (toSet && toSet !== fromSet) {
                        this.updateSetDisplay(toSet);
                        evt.to.classList.add('has-songs');
                    }

                    // Broadcast the move (both between sets and reordering within same set)
                    const songId = evt.item.dataset.songId;
                    const newPosition = Array.from(evt.to.querySelectorAll('.setlist-song')).indexOf(evt.item);

                    this.broadcastUpdate('song-moved', {
                        songId,
                        fromSet,
                        toSet,
                        position: newPosition
                    });

                    // Mark as critical change and auto-save
                    this.hasCriticalChanges = true;
                    this.autoSave();
                }
            });
        });
    }

    setupExistingRemoveButtons() {
        document.querySelectorAll('.setlist-song .btn-outline-danger').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const songElement = button.closest('.setlist-song');
                const setName = songElement.parentElement.dataset.setName;
                const songId = songElement.dataset.songId;
                console.log('[EXISTING X BUTTON] Clicked, calling removeSongFromSet with:', { songElement, setName });
                this.removeSongFromSet(songElement, setName);
            });
        });
    }

    clearDragStyles(element) {
        if (element) {
            element.classList.remove('dragging', 'sortable-ghost', 'sortable-chosen', 'sortable-drag');
            element.style.opacity = '';
            element.style.transform = '';
            element.style.backgroundColor = '';
            element.style.filter = '';
            element.style.transition = '';
        }

        // Also clean up drag preview if it exists
        if (this.dragPreview) {
            this.dragPreview.remove();
            this.dragPreview = null;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const setlistContainer = document.querySelector('.setlist-editor');
    if (setlistContainer) {
        const setlistId = setlistContainer.dataset.setlistId;
        new SetlistEditor(setlistId);
    }
}); 