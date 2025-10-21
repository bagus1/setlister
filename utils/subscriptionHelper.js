const { prisma } = require("../lib/prisma");

/**
 * Get user's subscription info with plan details
 * @param {number} userId
 * @returns {Promise<Object|null>} Subscription with plan or null if no active subscription
 */
async function getUserSubscription(userId) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  // Return subscription only if active
  if (subscription && subscription.status === 'active') {
    return subscription;
  }

  return null;
}

/**
 * Check if user can create custom URLs (slugs)
 * Free tier: NO
 * Pro/Premium: YES
 * @param {number} userId
 * @returns {Promise<{allowed: boolean, planName: string, upgradeRequired: boolean}>}
 */
async function canCreateCustomUrl(userId) {
  const subscription = await getUserSubscription(userId);

  // No subscription or free tier (8GB storage) = not allowed
  if (!subscription || subscription.plan.storageQuotaGB <= 8) {
    return {
      allowed: false,
      planName: subscription?.plan.name || 'Free',
      upgradeRequired: true,
      message: 'Custom public URLs are a Pro feature. Upgrade to Pro to create custom URLs for your bands and albums.',
    };
  }

  // Pro or Premium = allowed
  return {
    allowed: true,
    planName: subscription.plan.name,
    upgradeRequired: false,
  };
}

/**
 * Check if user can create private songs
 * Free tier: NO
 * Pro/Premium: YES
 * @param {number} userId
 * @returns {Promise<{allowed: boolean, planName: string, upgradeRequired: boolean}>}
 */
async function canCreatePrivateSongs(userId) {
  const subscription = await getUserSubscription(userId);

  // No subscription or free tier (8GB storage) = not allowed
  if (!subscription || subscription.plan.storageQuotaGB <= 8) {
    return {
      allowed: false,
      planName: subscription?.plan.name || 'Free',
      upgradeRequired: true,
      message: 'Private songs are a Pro feature. Upgrade to Pro to keep your songs private.',
    };
  }

  // Pro or Premium = allowed
  return {
    allowed: true,
    planName: subscription.plan.name,
    upgradeRequired: false,
  };
}

/**
 * Check if user can publish more albums
 * Uses HIGHEST tier among all band members (like storage pooling)
 * Free tier: Up to 3 published albums
 * Pro tier: Up to 10 published albums
 * Premium tier: Unlimited
 * @param {number} userId
 * @param {number} bandId
 * @returns {Promise<{allowed: boolean, planName: string, upgradeRequired: boolean, currentCount?: number, limit?: number}>}
 */
async function canPublishAlbum(userId, bandId) {
  // Count currently published albums for this band
  const publishedCount = await prisma.album.count({
    where: {
      bandId,
      isPublished: true,
    },
  });

  // Get all band members with their subscriptions
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

  // Find the highest tier among all members
  let maxAlbums = null;
  let highestPlanName = 'Free';
  let highestStorageQuota = 0;

  // Get free tier default
  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: 'free' },
  });

  members.forEach((member) => {
    if (
      member.user.subscription &&
      member.user.subscription.status === 'active'
    ) {
      const plan = member.user.subscription.plan;
      
      // Track highest tier by storage quota (8GB < 20GB < 100GB)
      if (plan.storageQuotaGB > highestStorageQuota) {
        highestStorageQuota = plan.storageQuotaGB;
        maxAlbums = plan.maxPublishedAlbums;
        highestPlanName = plan.name;
      }
    }
  });

  // If no Pro/Premium members, use free tier limit
  if (highestStorageQuota === 0) {
    maxAlbums = freePlan.maxPublishedAlbums;
    highestPlanName = 'Free';
  }

  // Unlimited (null) = allowed
  if (!maxAlbums) {
    return {
      allowed: true,
      planName: highestPlanName,
      upgradeRequired: false,
      currentCount: publishedCount,
    };
  }

  // Check if at limit
  if (publishedCount >= maxAlbums) {
    const upgradeTarget = maxAlbums === 3 ? 'Pro' : 'Premium';
    const upgradeLimit = maxAlbums === 3 ? '10' : 'unlimited';
    
    return {
      allowed: false,
      planName: highestPlanName,
      upgradeRequired: true,
      currentCount: publishedCount,
      limit: maxAlbums,
      message: `Your band has reached its ${highestPlanName} plan limit of ${maxAlbums} published albums. Upgrade to ${upgradeTarget} for ${upgradeLimit} albums.`,
    };
  }

  // Under limit = allowed
  return {
    allowed: true,
    planName: highestPlanName,
    upgradeRequired: false,
    currentCount: publishedCount,
    limit: maxAlbums,
  };
}

module.exports = {
  getUserSubscription,
  canCreateCustomUrl,
  canCreatePrivateSongs,
  canPublishAlbum,
};

