const { checkUserStorageQuota } = require("../utils/storageCalculator");
const { prisma } = require("../lib/prisma");

/**
 * Middleware to check if user has enough storage quota for a file upload
 * Expects req.file (multer) or req.body.fileSize
 * Expects req.params.bandId or req.body.bandId
 */
async function checkStorageQuota(req, res, next) {
  try {
    const userId = req.user.id;
    let bandId = req.params.bandId || req.body.bandId;
    
    // For setlist routes, we need to get bandId from the setlist
    if (!bandId && req.params.id) {
      // This is likely a setlist route, get bandId from setlist
      const setlist = await prisma.setlist.findUnique({
        where: { id: parseInt(req.params.id) },
        select: { bandId: true }
      });
      bandId = setlist?.bandId;
    }
    
    if (!bandId) {
      return res.status(400).json({ 
        error: "Band ID is required for storage quota check" 
      });
    }

    // Get file size from multer file or request body
    let fileSize = 0;
    if (req.file) {
      fileSize = req.file.size;
    } else if (req.body.fileSize) {
      fileSize = parseInt(req.body.fileSize);
    }

    if (!fileSize || fileSize <= 0) {
      return res.status(400).json({ 
        error: "File size is required for storage quota check" 
      });
    }

    // Check quota
    const quotaCheck = await checkUserStorageQuota(userId, bandId, fileSize);

    if (!quotaCheck.allowed) {
      return res.status(413).json({
        error: "Storage quota exceeded",
        message: quotaCheck.message,
        quota: {
          totalGB: quotaCheck.userQuotaGB,
          usedGB: quotaCheck.userUsedGB,
          remainingGB: quotaCheck.userRemainingGB,
        },
        upgradeUrl: "/pricing", // TODO: Create pricing page
      });
    }

    // Add quota info to request for logging/debugging
    req.storageQuota = {
      totalGB: quotaCheck.userQuotaGB,
      usedGB: quotaCheck.userUsedGB,
      remainingGB: quotaCheck.userRemainingGB,
      fileSizeGB: fileSize / 1024 ** 3,
    };

    next();
  } catch (error) {
    console.error("Storage quota check error:", error);
    
    // Return user-friendly error message
    return res.status(500).json({
      error: "Unable to check storage quota",
      message: "There was a problem checking your storage quota. Please try again or contact support if the issue persists.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = { checkStorageQuota };
