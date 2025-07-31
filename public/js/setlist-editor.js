// Setlist Editor JavaScript
class SetlistEditor {
    constructor(setlistId) {
        this.setlistId = setlistId;
        this.socket = io();
        this.isDragging = false;
        this.draggedElement = null;

        this.init();
    }

    init() {
        this.setupSocketConnection();
        this.setupDragAndDrop();
        this.setupEventListeners();
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
        // Make band songs draggable
        document.querySelectorAll('.band-song').forEach(song => {
            this.makeDraggable(song);
        });

        // Setup drop zones
        document.querySelectorAll('.drop-zone').forEach(zone => {
            this.setupDropZone(zone);
        });

        // Make existing setlist songs draggable
        document.querySelectorAll('.setlist-song').forEach(song => {
            this.makeDraggable(song);
        });
    }

    makeDraggable(element) {
        element.draggable = true;

        element.addEventListener('dragstart', (e) => {
            this.isDragging = true;
            this.draggedElement = element;
            element.classList.add('dragging');

            e.dataTransfer.setData('text/plain', '');
            e.dataTransfer.effectAllowed = 'move';
        });

        element.addEventListener('dragend', (e) => {
            this.isDragging = false;
            element.classList.remove('dragging');
            
            // Force clear any lingering styles
            element.style.opacity = '';
            element.style.transform = '';
            element.style.backgroundColor = '';
            
            this.draggedElement = null;
        });
    }

    setupDropZone(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', (e) => {
            if (!zone.contains(e.relatedTarget)) {
                zone.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');

            if (this.draggedElement) {
                this.handleDrop(zone);
            }
        });
    }

    handleDrop(dropZone) {
        const songId = this.draggedElement.dataset.songId;
        const setName = dropZone.dataset.setName;

        // Clone the song element for the setlist
        const songClone = this.createSetlistSong(this.draggedElement, setName);

        // Add to drop zone
        dropZone.appendChild(songClone);
        dropZone.classList.add('has-songs');

        // Make the new song draggable
        this.makeDraggable(songClone);

        // Remove from band songs if it came from there (not from another set)
        if (this.draggedElement.classList.contains('band-song')) {
            this.draggedElement.style.display = 'none'; // Hide immediately
            setTimeout(() => {
                this.draggedElement.remove(); // Remove after a short delay
            }, 100);
        }

        // Update set display
        this.updateSetDisplay(setName);

        // Broadcast update
        this.broadcastUpdate('song-added', {
            songId,
            setName,
            position: dropZone.children.length - 1
        });

        // Auto-save
        this.autoSave();
    }

    createSetlistSong(originalSong, setName) {
        const clone = originalSong.cloneNode(true);
        clone.classList.remove('band-song');
        clone.classList.add('setlist-song');

        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm btn-outline-danger ms-2';
        removeBtn.innerHTML = '<i class="bi bi-x"></i>';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSongFromSet(clone, setName);
        });

        clone.appendChild(removeBtn);

        return clone;
    }

    removeSongFromSet(songElement, setName) {
        const songId = songElement.dataset.songId;
        const songTime = songElement.dataset.songTime;
        const dropZone = songElement.parentElement;

        // Handle different removal logic based on set
        if (setName === 'Maybe') {
            // Remove completely from maybe and restore to band songs
            songElement.remove();
            this.restoreToBandSongs(songId, songTime);
        } else {
            // Move to maybe if removing from regular set
            const maybeZone = document.querySelector('.drop-zone[data-set-name="Maybe"]');
            if (maybeZone) {
                maybeZone.appendChild(songElement);
                maybeZone.classList.add('has-songs');
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
        this.autoSave();
    }

    restoreToBandSongs(songId, songTime) {
        // Check if song is already in band songs area
        const existingBandSong = document.querySelector(`.band-song[data-song-id="${songId}"]`);
        if (existingBandSong) {
            return; // Already there, don't duplicate
        }

        // Check if song is still in any other set
        const songInOtherSets = document.querySelectorAll(`.setlist-song[data-song-id="${songId}"]`);
        if (songInOtherSets.length > 0) {
            return; // Still in use elsewhere, don't restore
        }

        // Fetch song details from server and recreate band song element
        this.fetchAndRestoreSong(songId);
    }

    async fetchAndRestoreSong(songId) {
        try {
            const response = await fetch(`/songs/api/${songId}`);
            if (!response.ok) return;
            
            const song = await response.json();
            
            // Create band song element
            const bandSongElement = this.createBandSongElement(song);
            
            // Add to band songs area
            const bandSongsContainer = document.querySelector('.card-body');
            if (bandSongsContainer) {
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

        // You can implement visual indicators here
        // For example, briefly highlight changed areas
    }

    autoSave() {
        // Debounce auto-save
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveSetlist();
        }, 2000);
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

        fetch(`/setlists/${this.setlistId}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sets })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showSaveStatus('saved');
                } else {
                    this.showSaveStatus('error');
                }
            })
            .catch(error => {
                console.error('Save error:', error);
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

        // Reorder within sets
        document.querySelectorAll('.drop-zone').forEach(zone => {
            new Sortable(zone, {
                group: 'setlist',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                onEnd: (evt) => {
                    this.updateSetDisplay(zone.dataset.setName);
                    this.autoSave();
                }
            });
        });
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