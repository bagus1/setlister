const { prisma } = require("../lib/prisma");
const fs = require("fs").promises;
const path = require("path");

/**
 * Calculate total storage used by a band
 * @param {number} bandId
 * @returns {Promise<bigint>} Total bytes used
 */
async function calculateBandStorage(bandId) {
  // Get all recordings
  const recordings = await prisma.recording.findMany({
    where: {
      setlist: {
        bandId: bandId,
      },
    },
    select: {
      filePath: true,
      fileSize: true,
    },
  });

  // Get all recording splits (need to check filesystem)
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

  // Get album images
  const albums = await prisma.album.findMany({
    where: { bandId: bandId },
    select: {
      artwork: true,
      headerImage: true,
    },
  });

  // Get band photos/videos/audio
  const bandMedia = await prisma.band.findUnique({
    where: { id: bandId },
    select: {
      photos: { select: { filePath: true } },
      videos: { select: { filePath: true } },
      audioSamples: { select: { filePath: true } },
    },
  });

  let totalBytes = BigInt(0);

  // Sum recording file sizes (already tracked)
  recordings.forEach((r) => {
    if (r.fileSize) {
      totalBytes += BigInt(r.fileSize);
    }
  });

  // Calculate split file sizes from filesystem
  for (const split of splits) {
    if (split.filePath && split.filePath.startsWith("/uploads/")) {
      try {
        const filePath = path.join(process.cwd(), "public", split.filePath);
        const stats = await fs.stat(filePath);
        totalBytes += BigInt(stats.size);
      } catch (err) {
        // File doesn't exist, skip
      }
    }
  }

  // Calculate album track audio sizes
  for (const track of albumTracks) {
    if (track.audioUrl && track.audioUrl.startsWith("/uploads/")) {
      try {
        const filePath = path.join(process.cwd(), "public", track.audioUrl);
        const stats = await fs.stat(filePath);
        totalBytes += BigInt(stats.size);
      } catch (err) {
        // File doesn't exist, skip
      }
    }
  }

  // Calculate album image sizes
  for (const album of albums) {
    for (const imageUrl of [album.artwork, album.headerImage]) {
      if (imageUrl && imageUrl.startsWith("/uploads/")) {
        try {
          const filePath = path.join(process.cwd(), "public", imageUrl);
          const stats = await fs.stat(filePath);
          totalBytes += BigInt(stats.size);
        } catch (err) {
          // File doesn't exist, skip
        }
      }
    }
  }

  // Calculate band media sizes
  if (bandMedia) {
    const allMedia = [
      ...(bandMedia.photos || []),
      ...(bandMedia.videos || []),
      ...(bandMedia.audioSamples || []),
    ];

    for (const media of allMedia) {
      if (media.filePath && media.filePath.startsWith("/uploads/")) {
        try {
          const filePath = path.join(process.cwd(), "public", media.filePath);
          const stats = await fs.stat(filePath);
          totalBytes += BigInt(stats.size);
        } catch (err) {
          // File doesn't exist, skip
        }
      }
    }
  }

  return totalBytes;
}

/**
 * Update storage usage for a band
 * @param {number} bandId
 * @returns {Promise<bigint>} Total bytes used
 */
async function updateBandStorageUsage(bandId) {
  const totalBytes = await calculateBandStorage(bandId);

  await prisma.band.update({
    where: { id: bandId },
    data: { storageUsedBytes: totalBytes },
  });

  return totalBytes;
}

/**
 * Get all Pro+ members (users with active paid subscriptions) for a band
 * @param {number} bandId
 * @returns {Promise<Array>} Array of {userId, quotaGB}
 */
async function getBandProMembers(bandId) {
  const members = await prisma.bandMember.findMany({
    where: { bandId },
    include: {
      user: {
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      },
    },
  });

  const proMembers = [];

  members.forEach((member) => {
    if (
      member.user.subscription &&
      member.user.subscription.status === "active" &&
      member.user.subscription.plan &&
      member.user.subscription.plan.storageQuotaGB > 0
    ) {
      proMembers.push({
        userId: member.user.id,
        username: member.user.username,
        quotaGB: member.user.subscription.plan.storageQuotaGB,
        planName: member.user.subscription.plan.name,
      });
    }
  });

  return proMembers;
}

/**
 * Calculate total storage quota available for a band
 * Free tier does NOT pool - band gets 8GB regardless of free member count
 * Pro/Premium tier quotas DO stack
 * @param {number} bandId
 * @returns {Promise<bigint>} Total bytes available
 */
async function calculateBandStorageQuota(bandId) {
  const proMembers = await getBandProMembers(bandId);

  // Only count PAID subscriptions (Pro/Premium)
  // Free tier members don't contribute additional quota
  const paidMembers = proMembers.filter((m) => m.quotaGB > 8);

  let totalQuotaBytes = BigInt(0);

  paidMembers.forEach((member) => {
    const quotaBytes = BigInt(member.quotaGB) * BigInt(1024 ** 3);
    totalQuotaBytes += quotaBytes;
  });

  // If no paid members, use free tier default (8GB, non-pooled)
  if (totalQuotaBytes === BigInt(0)) {
    totalQuotaBytes = BigInt(8) * BigInt(1024 ** 3);
  }

  return totalQuotaBytes;
}

/**
 * Calculate user's share of storage across all their bands
 * @param {number} userId
 * @returns {Promise<{totalQuotaGB: number, usedGB: number, remainingGB: number, breakdown: Array}>}
 */
async function calculateUserStorageUsage(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: { plan: true },
      },
      bands: {
        include: {
          band: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get user's quota (default to free tier if no subscription)
  const userQuotaGB = user.subscription?.plan?.storageQuotaGB || 8;
  const totalQuotaBytes = BigInt(userQuotaGB) * BigInt(1024 ** 3);

  let totalUserShareBytes = BigInt(0);
  const breakdown = [];

  // Calculate user's share for each band they're in
  for (const membership of user.bands) {
    const band = membership.band;
    const bandStorageBytes = band.storageUsedBytes || BigInt(0);

    // Get all Pro+ members for this band
    const proMembers = await getBandProMembers(band.id);

    if (proMembers.length === 0) {
      // No Pro members, user owns all storage if band uses any
      const userShare = bandStorageBytes;
      totalUserShareBytes += userShare;

      breakdown.push({
        bandId: band.id,
        bandName: band.name,
        bandTotalGB: Number(bandStorageBytes) / 1024 ** 3,
        userShareGB: Number(userShare) / 1024 ** 3,
        proMembersCount: 0,
        isOnlyProMember: true,
      });
    } else {
      // Check if user is one of the Pro members
      const userIsProMember = proMembers.some((m) => m.userId === userId);

      if (userIsProMember) {
        // Calculate total quota from all Pro members
        const totalBandQuotaGB = proMembers.reduce(
          (sum, m) => sum + m.quotaGB,
          0
        );

        // User's share is proportional to their quota contribution
        const userProportion = userQuotaGB / totalBandQuotaGB;
        const userShare = BigInt(
          Math.floor(Number(bandStorageBytes) * userProportion)
        );

        totalUserShareBytes += userShare;

        breakdown.push({
          bandId: band.id,
          bandName: band.name,
          bandTotalGB: Number(bandStorageBytes) / 1024 ** 3,
          userShareGB: Number(userShare) / 1024 ** 3,
          proMembersCount: proMembers.length,
          proMembers: proMembers.map((m) => ({
            username: m.username,
            quotaGB: m.quotaGB,
          })),
          isOnlyProMember: proMembers.length === 1,
        });
      } else {
        // User is free tier member, doesn't contribute quota
        breakdown.push({
          bandId: band.id,
          bandName: band.name,
          bandTotalGB: Number(bandStorageBytes) / 1024 ** 3,
          userShareGB: 0,
          proMembersCount: proMembers.length,
          userIsFree: true,
        });
      }
    }
  }

  const usedGB = Number(totalUserShareBytes) / 1024 ** 3;
  const remainingGB = userQuotaGB - usedGB;
  const remainingBytes = BigInt(Math.floor(remainingGB * 1024 ** 3));
  const remainingHours = bytesToRecordingHours(remainingBytes);

  return {
    totalQuotaGB: userQuotaGB,
    usedGB: parseFloat(usedGB.toFixed(2)),
    remainingGB: parseFloat(remainingGB.toFixed(2)),
    remainingBytes,
    remainingHours,
    usedPercent: parseFloat(((usedGB / userQuotaGB) * 100).toFixed(1)),
    breakdown,
  };
}

/**
 * Check if user can upload a file for a given band
 * @param {number} userId
 * @param {number} bandId
 * @param {number} fileSize
 * @returns {Promise<{allowed: boolean, message?: string, userQuotaGB?: number, userUsedGB?: number}>}
 */
async function checkUserStorageQuota(userId, bandId, fileSize) {
  const userStorage = await calculateUserStorageUsage(userId);

  const fileSizeGB = fileSize / 1024 ** 3;
  const wouldUseGB = userStorage.usedGB + fileSizeGB;

  if (wouldUseGB > userStorage.totalQuotaGB) {
    const overGB = wouldUseGB - userStorage.totalQuotaGB;

    return {
      allowed: false,
      message: `This upload would exceed your storage quota by ${overGB.toFixed(
        2
      )} GB. You have ${userStorage.remainingGB.toFixed(
        2
      )} GB remaining across all your bands. Please upgrade your plan or delete old files.`,
      userQuotaGB: userStorage.totalQuotaGB,
      userUsedGB: userStorage.usedGB,
      userRemainingGB: userStorage.remainingGB,
    };
  }

  return {
    allowed: true,
    userQuotaGB: userStorage.totalQuotaGB,
    userUsedGB: userStorage.usedGB,
    userRemainingGB: userStorage.remainingGB - fileSizeGB,
  };
}

/**
 * Format bytes to human readable
 * @param {bigint|number} bytes
 * @param {number} decimals
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || bytes === 0n) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(Number(bytes)) / Math.log(k));

  return (
    parseFloat((Number(bytes) / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}

/**
 * Convert storage bytes to recording hours
 * @param {bigint|number} bytes
 * @returns {Object} {mp3Hours, wavHours, description}
 */
function bytesToRecordingHours(bytes) {
  const totalMB = Number(bytes) / (1024 * 1024);
  
  // Handle negative or zero
  if (totalMB <= 0) {
    return {
      mp3Hours: 0,
      wavHours: 0,
      description: "Storage limit reached"
    };
  }
  
  // MP3/WebM at ~1 MB per minute = 60 MB per hour
  const mp3Hours = Math.floor(totalMB / 60);
  
  // WAV at ~10 MB per minute = 600 MB per hour
  const wavHours = Math.floor(totalMB / 600);
  
  // Handle small amounts (less than 1 hour)
  if (mp3Hours === 0 && wavHours === 0) {
    const mp3Minutes = Math.floor(totalMB);
    return {
      mp3Hours: 0,
      wavHours: 0,
      description: `~${mp3Minutes}min MP3`
    };
  }
  
  return {
    mp3Hours,
    wavHours,
    description: `~${mp3Hours}hrs MP3 or ~${wavHours}hrs WAV`
  };
}

/**
 * Get band storage info (total available, used, contributing members)
 * @param {number} bandId
 * @returns {Promise<Object>}
 */
async function getBandStorageInfo(bandId) {
  const band = await prisma.band.findUnique({
    where: { id: bandId },
    select: { storageUsedBytes: true },
  });

  const proMembers = await getBandProMembers(bandId);
  const totalQuotaBytes = await calculateBandStorageQuota(bandId);

  const usedBytes = band?.storageUsedBytes || BigInt(0);
  const usedGB = Number(usedBytes) / 1024 ** 3;
  const quotaGB = Number(totalQuotaBytes) / 1024 ** 3;
  const usedPercent = quotaGB > 0 ? (usedGB / quotaGB) * 100 : 0;

  const remainingBytes = totalQuotaBytes - usedBytes;
  const remainingHours = bytesToRecordingHours(remainingBytes);

  return {
    usedBytes,
    usedGB: parseFloat(usedGB.toFixed(2)),
    quotaGB: parseFloat(quotaGB.toFixed(0)),
    quotaBytes: totalQuotaBytes,
    usedPercent: parseFloat(usedPercent.toFixed(1)),
    remainingGB: parseFloat((quotaGB - usedGB).toFixed(2)),
    remainingBytes,
    remainingHours,
    proMembers,
    formatted: formatBytes(usedBytes),
  };
}

module.exports = {
  calculateBandStorage,
  updateBandStorageUsage,
  getBandProMembers,
  calculateBandStorageQuota,
  calculateUserStorageUsage,
  checkUserStorageQuota,
  getBandStorageInfo,
  formatBytes,
  bytesToRecordingHours,
};
