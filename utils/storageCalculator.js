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
  // Only count recordings where the source file still exists (filePath is not empty)
  recordings.forEach((r) => {
    if (r.fileSize && r.filePath && r.filePath !== "") {
      totalBytes += BigInt(r.fileSize);
    }
  });

  // Calculate split file sizes from filesystem
  for (const split of splits) {
    if (split.filePath && split.filePath.startsWith("/uploads/")) {
      try {
        // Try public/uploads first (for recordings), then uploads directly (for splits)
        let filePath = path.join(process.cwd(), "public", split.filePath);
        let stats;
        try {
          stats = await fs.stat(filePath);
        } catch (err) {
          // Split files are stored in uploads/ directly, not public/uploads/
          filePath = path.join(process.cwd(), split.filePath.substring(1)); // Remove leading /
          stats = await fs.stat(filePath);
        }
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
  // Get free plan quota from database to determine what counts as "paid"
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "free" },
  });
  const freeQuotaGB = freePlan?.storageQuotaGB || 2;

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
      member.user.subscription.plan.storageQuotaGB > freeQuotaGB // Only count PAID subscriptions (not Free tier)
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
 * Find the band member with the most available storage quota
 * Only considers members with Pro or Premium plans (storageQuotaGB > 2)
 * @param {number} bandId
 * @returns {Promise<{userId: number, username: string, quotaGB: number, planName: string, remainingGB: number} | null>}
 */
async function findBestMemberForAttribution(bandId) {
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "free" },
  });
  const freeQuotaGB = freePlan?.storageQuotaGB || 2;

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

  let bestMember = null;
  let mostRemainingGB = -1;

  for (const member of members) {
    if (
      member.user.subscription &&
      member.user.subscription.status === "active" &&
      member.user.subscription.plan &&
      member.user.subscription.plan.storageQuotaGB > freeQuotaGB // Only Pro/Premium plans
    ) {
      // Calculate this user's remaining storage
      const userStorage = await calculateUserStorageUsage(member.user.id);
      const remainingGB = userStorage.remainingGB;

      if (remainingGB > mostRemainingGB) {
        mostRemainingGB = remainingGB;
        bestMember = {
          userId: member.user.id,
          username: member.user.username,
          quotaGB: member.user.subscription.plan.storageQuotaGB,
          planName: member.user.subscription.plan.name,
          remainingGB: remainingGB,
        };
      }
    }
  }

  return bestMember;
}

/**
 * Calculate total storage quota available for a band
 * Free tier does NOT pool - band gets 2GB (from Free plan) regardless of free member count
 * Pro/Premium tier quotas DO stack
 * @param {number} bandId
 * @returns {Promise<bigint>} Total bytes available
 */
async function calculateBandStorageQuota(bandId) {
  const proMembers = await getBandProMembers(bandId);

  // Get free plan quota from database to determine what counts as "paid"
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "free" },
  });
  const freeQuotaGB = freePlan?.storageQuotaGB || 2;

  // Only count PAID subscriptions (Pro/Premium)
  // Free tier members don't contribute additional quota
  const paidMembers = proMembers.filter((m) => m.quotaGB > freeQuotaGB);

  let totalQuotaBytes = BigInt(0);

  paidMembers.forEach((member) => {
    const quotaBytes = BigInt(member.quotaGB) * BigInt(1024 ** 3);
    totalQuotaBytes += quotaBytes;
  });

  // If no paid members, use free tier quota from database (non-pooled)
  if (totalQuotaBytes === BigInt(0)) {
    totalQuotaBytes = BigInt(freeQuotaGB) * BigInt(1024 ** 3);
  }

  return totalQuotaBytes;
}

/**
 * Calculate user's attributed storage across all their bands
 * NEW SYSTEM: Only counts storage where band >= 2GB AND user created the recording
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
  let userQuotaGB;
  if (user.subscription?.plan?.storageQuotaGB) {
    userQuotaGB = user.subscription.plan.storageQuotaGB;
  } else {
    // Look up free plan quota from database
    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { slug: "free" },
    });
    userQuotaGB = freePlan?.storageQuotaGB || 2; // Fallback to 2 if free plan not found
  }

  const BAND_FREE_POOL_GB = 2;
  const BAND_FREE_POOL_BYTES = BigInt(BAND_FREE_POOL_GB) * BigInt(1024 ** 3);

  let totalUserAttributedBytes = BigInt(0);
  const breakdown = [];

  // Calculate user's attributed storage for each band they're in
  for (const membership of user.bands) {
    const band = membership.band;
    const bandStorageBytes = band.storageUsedBytes || BigInt(0);
    const bandStorageGB = Number(bandStorageBytes) / 1024 ** 3;

    // If band is under 2GB, all storage is in free pool - user gets 0 attribution
    if (bandStorageBytes <= BAND_FREE_POOL_BYTES) {
      breakdown.push({
        bandId: band.id,
        bandName: band.name,
        bandTotalGB: bandStorageGB,
        userAttributedGB: 0,
        usesFreePool: true,
        freePoolUsedGB: bandStorageGB,
        freePoolRemainingGB: BAND_FREE_POOL_GB - bandStorageGB,
      });
      continue;
    }

    // Band is over 2GB - get recordings created by this user
    const userRecordings = await prisma.recording.findMany({
      where: {
        setlist: {
          bandId: band.id,
        },
        createdById: userId,
      },
      select: {
        id: true,
        filePath: true,
        fileSize: true,
      },
    });

    // Calculate storage from user's recordings
    let userRecordingBytes = BigInt(0);
    for (const recording of userRecordings) {
      if (
        recording.fileSize &&
        recording.filePath &&
        recording.filePath !== ""
      ) {
        userRecordingBytes += BigInt(recording.fileSize);
      }
    }

    // Calculate storage from splits of user's recordings
    let userSplitBytes = BigInt(0);
    const userRecordingIds = userRecordings.map((r) => r.id);
    if (userRecordingIds.length > 0) {
      const userSplits = await prisma.recordingSplit.findMany({
        where: {
          recordingId: { in: userRecordingIds },
        },
        select: {
          filePath: true,
        },
      });

      // Check filesystem for split file sizes
      for (const split of userSplits) {
        if (split.filePath && split.filePath.startsWith("/uploads/")) {
          try {
            let filePath = path.join(process.cwd(), "public", split.filePath);
            let stats;
            try {
              stats = await fs.stat(filePath);
            } catch (err) {
              filePath = path.join(process.cwd(), split.filePath.substring(1));
              stats = await fs.stat(filePath);
            }
            userSplitBytes += BigInt(stats.size);
          } catch (err) {
            // File doesn't exist, skip
          }
        }
      }
    }

    const userTotalBytes = userRecordingBytes + userSplitBytes;
    const userTotalGB = Number(userTotalBytes) / 1024 ** 3;

    // When band is over 2GB, calculate user's proportion of storage BEYOND the free pool
    // First, get total storage from all user recordings (to calculate proportion)
    const allUserRecordings = await prisma.recording.findMany({
      where: {
        setlist: {
          bandId: band.id,
        },
      },
      select: {
        id: true,
        filePath: true,
        fileSize: true,
        createdById: true,
      },
    });

    // Calculate total storage from all recordings (not splits, just source recordings)
    let totalRecordingBytes = BigInt(0);
    allUserRecordings.forEach((r) => {
      if (r.fileSize && r.filePath && r.filePath !== "") {
        totalRecordingBytes += BigInt(r.fileSize);
      }
    });

    // Calculate storage beyond free pool
    const storageBeyondFreePool = bandStorageBytes - BAND_FREE_POOL_BYTES;

    // Calculate user's share: proportion of recordings * storage beyond free pool
    // Note: bandStorageBytes already includes recordings + splits
    // So we attribute the portion beyond free pool proportionally, and splits are included in that
    let userAttributedBytes = BigInt(0);
    if (totalRecordingBytes > 0 && userRecordingBytes > 0) {
      // User's proportion of source recordings determines their share of storage beyond free pool
      const userProportion =
        Number(userRecordingBytes) / Number(totalRecordingBytes);
      // User gets that proportion of ALL storage beyond free pool (which includes their splits)
      userAttributedBytes = BigInt(
        Math.floor(Number(storageBeyondFreePool) * userProportion)
      );
    } else if (userTotalBytes > 0) {
      // Edge case: if no other recordings, user gets their portion based on their total
      // But we need total band storage (recordings + splits) to calculate proportion properly
      // For now, if user has recordings, they should get proportional share
      userAttributedBytes = BigInt(
        Math.floor(
          Number(storageBeyondFreePool) *
            (Number(userRecordingBytes) / Number(bandStorageBytes))
        )
      );
    }

    const userAttributedGB = Number(userAttributedBytes) / 1024 ** 3;
    totalUserAttributedBytes += userAttributedBytes;

    breakdown.push({
      bandId: band.id,
      bandName: band.name,
      bandTotalGB: bandStorageGB,
      userAttributedGB: userAttributedGB,
      usesFreePool: false,
      freePoolUsedGB: BAND_FREE_POOL_GB,
      freePoolRemainingGB: 0,
      recordingsCount: userRecordings.length,
    });
  }

  const usedGB = Number(totalUserAttributedBytes) / 1024 ** 3;
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
 * NEW SYSTEM: Check if upload fits in band's 2GB free pool or user's quota
 * @param {number} userId
 * @param {number} bandId
 * @param {number} fileSize
 * @returns {Promise<{allowed: boolean, message?: string, userQuotaGB?: number, userUsedGB?: number}>}
 */
async function checkUserStorageQuota(userId, bandId, fileSize) {
  const BAND_FREE_POOL_GB = 2;
  const BAND_FREE_POOL_BYTES = BigInt(BAND_FREE_POOL_GB) * BigInt(1024 ** 3);
  const fileSizeGB = fileSize / 1024 ** 3;

  // Get band's current storage
  const bandStorageBytes = await calculateBandStorage(bandId);
  const bandStorageGB = Number(bandStorageBytes) / 1024 ** 3;

  // Get user's current attributed storage
  const userStorage = await calculateUserStorageUsage(userId);

  // Case 1: Band is under 2GB - check if upload fits in free pool
  if (bandStorageBytes < BAND_FREE_POOL_BYTES) {
    const remainingFreePoolGB = BAND_FREE_POOL_GB - bandStorageGB;

    if (fileSizeGB <= remainingFreePoolGB) {
      // Upload fits entirely in free pool - no quota check needed
      return {
        allowed: true,
        usesFreePool: true,
        userQuotaGB: userStorage.totalQuotaGB,
        userUsedGB: userStorage.usedGB,
        userRemainingGB: userStorage.remainingGB,
        freePoolRemainingGB: remainingFreePoolGB - fileSizeGB,
      };
    } else {
      // Part uses free pool, rest counts against user quota
      const excessGB = fileSizeGB - remainingFreePoolGB;
      const wouldUseGB = userStorage.usedGB + excessGB;

      if (wouldUseGB > userStorage.totalQuotaGB) {
        const overGB = wouldUseGB - userStorage.totalQuotaGB;
        return {
          allowed: false,
          message: `This upload would exceed your storage quota by ${overGB.toFixed(
            2
          )} GB. ${remainingFreePoolGB.toFixed(
            2
          )} GB will use the band's free pool, but ${excessGB.toFixed(
            2
          )} GB would count against your ${userStorage.totalQuotaGB} GB quota. You have ${userStorage.remainingGB.toFixed(
            2
          )} GB remaining. Please upgrade your plan or delete old files.`,
          userQuotaGB: userStorage.totalQuotaGB,
          userUsedGB: userStorage.usedGB,
          userRemainingGB: userStorage.remainingGB,
        };
      }

      return {
        allowed: true,
        usesFreePool: true,
        freePoolGB: remainingFreePoolGB,
        userQuotaGBUsed: excessGB,
        userQuotaGB: userStorage.totalQuotaGB,
        userUsedGB: userStorage.usedGB,
        userRemainingGB: userStorage.remainingGB - excessGB,
      };
    }
  }

  // Case 2: Band is already over 2GB - all new uploads count against user quota
  const wouldUseGB = userStorage.usedGB + fileSizeGB;

  if (wouldUseGB > userStorage.totalQuotaGB) {
    const overGB = wouldUseGB - userStorage.totalQuotaGB;
    return {
      allowed: false,
      message: `This upload would exceed your storage quota by ${overGB.toFixed(
        2
      )} GB. The band's 2 GB free pool is full, so all new uploads count against your personal quota. You have ${userStorage.remainingGB.toFixed(
        2
      )} GB remaining. Please upgrade your plan or delete old files.`,
      userQuotaGB: userStorage.totalQuotaGB,
      userUsedGB: userStorage.usedGB,
      userRemainingGB: userStorage.remainingGB,
    };
  }

  return {
    allowed: true,
    usesFreePool: false,
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
      description: "Storage limit reached",
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
      description: `~${mp3Minutes}min MP3`,
    };
  }

  return {
    mp3Hours,
    wavHours,
    description: `~${mp3Hours}hrs MP3 or ~${wavHours}hrs WAV`,
  };
}

/**
 * Check if a recording can be split into segments
 * Rule: Any band member can split if band has free pool space OR recording creator has quota space
 * @param {number} bandId
 * @param {number} recordingCreatorId - User who created the original recording
 * @param {number} estimatedSplitSizeBytes - Estimated total size of all splits (optional, for pre-check)
 * @returns {Promise<{allowed: boolean, message?: string, reason?: string}>}
 */
async function canSplitRecording(
  bandId,
  recordingCreatorId,
  estimatedSplitSizeBytes = null
) {
  const BAND_FREE_POOL_GB = 2;
  const BAND_FREE_POOL_BYTES = BigInt(BAND_FREE_POOL_GB) * BigInt(1024 ** 3);

  // Get band's current storage
  const bandStorageBytes = await calculateBandStorage(bandId);
  const bandStorageGB = Number(bandStorageBytes) / 1024 ** 3;

  // Check 1: Band has free pool space (under 2GB)
  if (bandStorageBytes < BAND_FREE_POOL_BYTES) {
    // Band is under 2GB - can use free pool
    if (estimatedSplitSizeBytes) {
      const estimatedSplitSizeGB = Number(estimatedSplitSizeBytes) / 1024 ** 3;
      const remainingFreePoolGB = BAND_FREE_POOL_GB - bandStorageGB;
      if (estimatedSplitSizeGB <= remainingFreePoolGB) {
        return {
          allowed: true,
          reason: "band_free_pool",
          remainingFreePoolGB: remainingFreePoolGB - estimatedSplitSizeGB,
        };
      }
    } else {
      // No size estimate - assume it will fit (will check again after creation)
      return {
        allowed: true,
        reason: "band_free_pool",
        remainingFreePoolGB: BAND_FREE_POOL_GB - bandStorageGB,
      };
    }
  }

  // Check 2: Recording creator has available quota space
  const creatorStorage = await calculateUserStorageUsage(recordingCreatorId);
  if (estimatedSplitSizeBytes) {
    const estimatedSplitSizeGB = Number(estimatedSplitSizeBytes) / 1024 ** 3;
    const wouldUseGB = creatorStorage.usedGB + estimatedSplitSizeGB;

    if (wouldUseGB <= creatorStorage.totalQuotaGB) {
      return {
        allowed: true,
        reason: "creator_quota",
        creatorRemainingGB: creatorStorage.totalQuotaGB - wouldUseGB,
      };
    } else {
      const overGB = wouldUseGB - creatorStorage.totalQuotaGB;
      return {
        allowed: false,
        message: `Splits would exceed the recording creator's storage quota by ${overGB.toFixed(2)} GB. The creator has ${creatorStorage.remainingGB.toFixed(2)} GB remaining, but the splits would need ${estimatedSplitSizeGB.toFixed(2)} GB.`,
        reason: "creator_over_quota",
      };
    }
  } else {
    // No size estimate - check if creator has any remaining space
    if (creatorStorage.remainingGB > 0) {
      return {
        allowed: true,
        reason: "creator_quota",
        creatorRemainingGB: creatorStorage.remainingGB,
      };
    }
  }

  // Neither condition met
  return {
    allowed: false,
    message: `Cannot split recording: Band's free pool is full (${bandStorageGB.toFixed(2)} GB / ${BAND_FREE_POOL_GB} GB) and the recording creator has no remaining quota space (${creatorStorage.usedGB.toFixed(2)} GB / ${creatorStorage.totalQuotaGB} GB).`,
    reason: "no_space_available",
  };
}

/**
 * Check if user is currently over their storage quota
 * @param {number} userId
 * @returns {Promise<{isOverQuota: boolean, usedGB: number, quotaGB: number, usedPercent: number}>}
 */
async function isUserOverQuota(userId) {
  const userStorage = await calculateUserStorageUsage(userId);
  const isOverQuota = userStorage.usedGB >= userStorage.totalQuotaGB;

  return {
    isOverQuota,
    usedGB: userStorage.usedGB,
    quotaGB: userStorage.totalQuotaGB,
    usedPercent: userStorage.usedPercent,
  };
}

/**
 * Get band storage info (total available, used, free pool, user contributions)
 * NEW SYSTEM: Shows 2GB free pool + user contributions
 * @param {number} bandId
 * @returns {Promise<Object>}
 */
async function getBandStorageInfo(bandId) {
  const BAND_FREE_POOL_GB = 2;
  const BAND_FREE_POOL_BYTES = BigInt(BAND_FREE_POOL_GB) * BigInt(1024 ** 3);

  const band = await prisma.band.findUnique({
    where: { id: bandId },
    select: { storageUsedBytes: true },
  });

  const usedBytes = band?.storageUsedBytes || BigInt(0);
  const usedGB = Number(usedBytes) / 1024 ** 3;

  // Calculate how much uses free pool vs user attribution
  const freePoolUsedGB = Math.min(usedGB, BAND_FREE_POOL_GB);
  const freePoolRemainingGB = Math.max(0, BAND_FREE_POOL_GB - usedGB);
  const userAttributedGB = Math.max(0, usedGB - BAND_FREE_POOL_GB);

  // Get all members to calculate total available quota
  const members = await prisma.bandMember.findMany({
    where: { bandId },
    include: {
      user: {
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      },
    },
  });

  // Sum all members' personal quotas
  let totalAvailableQuotaGB = BAND_FREE_POOL_GB; // Start with free pool
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "free" },
  });
  const freeQuotaGB = freePlan?.storageQuotaGB || 2;

  members.forEach((member) => {
    if (member.user.subscription?.status === "active") {
      totalAvailableQuotaGB += member.user.subscription.plan.storageQuotaGB;
    } else {
      // Free tier members get their 2GB quota (but it's already counted in free pool)
      // Don't double-count
    }
  });

  // Calculate remaining available (free pool remaining + all members' quotas)
  const remainingGB = Math.max(0, totalAvailableQuotaGB - usedGB);
  const remainingBytes = BigInt(Math.floor(remainingGB * 1024 ** 3));
  const remainingHours = bytesToRecordingHours(remainingBytes);

  const usedPercent =
    totalAvailableQuotaGB > 0 ? (usedGB / totalAvailableQuotaGB) * 100 : 100;

  return {
    usedBytes,
    usedGB: parseFloat(usedGB.toFixed(2)),
    quotaGB: parseFloat(totalAvailableQuotaGB.toFixed(0)),
    quotaBytes: BigInt(Math.floor(totalAvailableQuotaGB * 1024 ** 3)),
    usedPercent: parseFloat(usedPercent.toFixed(1)),
    remainingGB: parseFloat(remainingGB.toFixed(2)),
    remainingBytes,
    remainingHours,
    // New fields for free pool tracking
    freePoolGB: BAND_FREE_POOL_GB,
    freePoolUsedGB: parseFloat(freePoolUsedGB.toFixed(2)),
    freePoolRemainingGB: parseFloat(freePoolRemainingGB.toFixed(2)),
    userAttributedGB: parseFloat(userAttributedGB.toFixed(2)),
    formatted: formatBytes(usedBytes),
  };
}

module.exports = {
  calculateBandStorage,
  updateBandStorageUsage,
  getBandProMembers,
  findBestMemberForAttribution,
  calculateBandStorageQuota,
  calculateUserStorageUsage,
  checkUserStorageQuota,
  canSplitRecording,
  isUserOverQuota,
  getBandStorageInfo,
  formatBytes,
  bytesToRecordingHours,
};
