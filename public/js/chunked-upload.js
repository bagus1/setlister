class ChunkedUploader {
  constructor(file, chunkSize = 50 * 1024 * 1024) { // 50MB chunks
    this.file = file;
    this.chunkSize = chunkSize;
    this.totalChunks = Math.ceil(file.size / chunkSize);
    this.uploadedChunks = 0;
    this.chunks = [];
  }

  async uploadChunks(setlistId, onProgress) {
    try {
      // Split file into chunks
      for (let i = 0; i < this.totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        const chunk = this.file.slice(start, end);
        this.chunks.push(chunk);
      }

      // Upload each chunk
      for (let i = 0; i < this.chunks.length; i++) {
        await this.uploadChunk(setlistId, i, this.chunks[i]);
        this.uploadedChunks++;
        
        if (onProgress) {
          onProgress({
            loaded: this.uploadedChunks,
            total: this.totalChunks,
            percentage: Math.round((this.uploadedChunks / this.totalChunks) * 100)
          });
        }
      }

      // Reassemble chunks on server
      return await this.reassembleChunks(setlistId);
    } catch (error) {
      throw new Error(`Chunked upload failed: ${error.message}`);
    }
  }

  async uploadChunk(setlistId, chunkIndex, chunk) {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex);
    formData.append('totalChunks', this.totalChunks);
    formData.append('originalFileName', this.file.name);
    formData.append('originalFileSize', this.file.size);

    const response = await fetch(`/setlists/${setlistId}/recordings/upload-chunk`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Chunk ${chunkIndex} upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  async reassembleChunks(setlistId) {
    const response = await fetch(`/setlists/${setlistId}/recordings/reassemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        originalFileName: this.file.name,
        originalFileSize: this.file.size,
        totalChunks: this.totalChunks
      })
    });

    if (!response.ok) {
      throw new Error(`Reassembly failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Usage example:
async function uploadLargeFile(file, setlistId) {
  const uploader = new ChunkedUploader(file);
  
  try {
    const result = await uploader.uploadChunks(setlistId, (progress) => {
      console.log(`Upload progress: ${progress.percentage}%`);
      // Update UI progress bar
    });
    
    console.log('Upload complete:', result);
    return result;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
