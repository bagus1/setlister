const { prisma } = require("../lib/prisma");
const fs = require("fs").promises;
const path = require("path");

/**
 * Get all file paths associated with a band
 * @param {number} bandId
 * @returns {Promise<Array<string>>} Array of file paths to delete
 */
async function getBandFiles(bandId) {
  const files = [];

  // Get all recordings for this band's setlists
  const recordings = await prisma.recording.findMany({
    where: {
      setlist: {
        bandId: bandId,
      },
    },
    select: {
      filePath: true,
    },
  });

  recordings.forEach((r) => {
    if (r.filePath && r.filePath.startsWith("/uploads/")) {
      files.push(path.join(process.cwd(), "public", r.filePath));
    }
  });

  // Get all recording splits
  const splits = await prisma.recordingSplit.findMany({
    where: {
      recording: {
        setlist: {
          bandId: bandId,
        },
      },
    },
    select: {
      filePath: true,
    },
  });

  splits.forEach((s) => {
    if (s.filePath && s.filePath.startsWith("/uploads/")) {
      files.push(path.join(process.cwd(), "public", s.filePath));
    }
  });

  // Get all album track audio files
  const albumTracks = await prisma.albumTrack.findMany({
    where: {
      album: {
        bandId: bandId,
      },
      audioUrl: {
        not: null,
      },
    },
    select: {
      audioUrl: true,
    },
  });

  albumTracks.forEach((t) => {
    if (t.audioUrl && t.audioUrl.startsWith("/uploads/")) {
      files.push(path.join(process.cwd(), "public", t.audioUrl));
    }
  });

  // Get album images
  const albums = await prisma.album.findMany({
    where: { bandId: bandId },
    select: {
      artwork: true,
      headerImage: true,
    },
  });

  albums.forEach((album) => {
    [album.artwork, album.headerImage].forEach((imageUrl) => {
      if (imageUrl && imageUrl.startsWith("/uploads/")) {
        files.push(path.join(process.cwd(), "public", imageUrl));
      }
    });
  });

  // Get band media (photos, videos, audio)
  const bandMedia = await prisma.band.findUnique({
    where: { id: bandId },
    select: {
      photos: { select: { filePath: true } },
      videos: { select: { filePath: true } },
      audioSamples: { select: { filePath: true } },
    },
  });

  if (bandMedia) {
    const allMedia = [
      ...(bandMedia.photos || []),
      ...(bandMedia.videos || []),
      ...(bandMedia.audioSamples || []),
    ];

    allMedia.forEach((media) => {
      if (media.filePath && media.filePath.startsWith("/uploads/")) {
        files.push(path.join(process.cwd(), "public", media.filePath));
      }
    });
  }

  return files;
}

/**
 * Delete all files associated with a band
 * @param {number} bandId
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function deleteBandFiles(bandId) {
  const files = await getBandFiles(bandId);
  let deleted = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      await fs.unlink(filePath);
      deleted++;
      console.log(`✓ Deleted: ${filePath}`);
    } catch (err) {
      if (err.code !== "ENOENT") {
        // File not found is OK (already deleted)
        console.warn(`Could not delete: ${filePath}`, err.message);
        errors++;
      }
    }
  }

  return { deleted, errors, total: files.length };
}

/**
 * Get all file paths for a recording
 * @param {number} recordingId
 * @returns {Promise<Array<string>>}
 */
async function getRecordingFiles(recordingId) {
  const files = [];

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { filePath: true },
  });

  if (recording?.filePath && recording.filePath.startsWith("/uploads/")) {
    files.push(path.join(process.cwd(), "public", recording.filePath));
  }

  // Get all splits for this recording
  const splits = await prisma.recordingSplit.findMany({
    where: { recordingId: recordingId },
    select: { filePath: true },
  });

  splits.forEach((s) => {
    if (s.filePath && s.filePath.startsWith("/uploads/")) {
      files.push(path.join(process.cwd(), "public", s.filePath));
    }
  });

  return files;
}

/**
 * Delete all files for a recording
 * @param {number} recordingId
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function deleteRecordingFiles(recordingId) {
  const files = await getRecordingFiles(recordingId);
  let deleted = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      await fs.unlink(filePath);
      deleted++;
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn(`Could not delete: ${filePath}`, err.message);
        errors++;
      }
    }
  }

  return { deleted, errors, total: files.length };
}

/**
 * Delete a single file safely
 * @param {string} fileUrl - Web path like "/uploads/..."
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteFile(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) {
    return false;
  }

  try {
    const filePath = path.join(process.cwd(), "public", fileUrl);
    await fs.unlink(filePath);
    console.log(`✓ Deleted: ${fileUrl}`);
    return true;
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`Could not delete: ${fileUrl}`, err.message);
    }
    return false;
  }
}

/**
 * Get all file paths for an album
 * @param {number} albumId
 * @returns {Promise<Array<string>>}
 */
async function getAlbumFiles(albumId) {
  const files = [];

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      artwork: true,
      headerImage: true,
      tracks: {
        select: { audioUrl: true },
      },
    },
  });

  if (album) {
    // Album images
    [album.artwork, album.headerImage].forEach((imageUrl) => {
      if (imageUrl && imageUrl.startsWith("/uploads/")) {
        files.push(path.join(process.cwd(), "public", imageUrl));
      }
    });

    // Track audio files
    album.tracks.forEach((track) => {
      if (track.audioUrl && track.audioUrl.startsWith("/uploads/")) {
        files.push(path.join(process.cwd(), "public", track.audioUrl));
      }
    });
  }

  return files;
}

/**
 * Delete all files for an album
 * @param {number} albumId
 * @returns {Promise<{deleted: number, errors: number}>}
 */
async function deleteAlbumFiles(albumId) {
  const files = await getAlbumFiles(albumId);
  let deleted = 0;
  let errors = 0;

  for (const filePath of files) {
    try {
      await fs.unlink(filePath);
      deleted++;
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn(`Could not delete: ${filePath}`, err.message);
        errors++;
      }
    }
  }

  return { deleted, errors, total: files.length };
}

module.exports = {
  getBandFiles,
  deleteBandFiles,
  getRecordingFiles,
  deleteRecordingFiles,
  getAlbumFiles,
  deleteAlbumFiles,
  deleteFile,
};

