/**
 * Slug Generation and Validation Utilities for Band EPK URLs
 */

/**
 * Convert a band name to a URL-friendly slug
 * @param {string} name - Band name
 * @returns {string} - URL-safe slug
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    // Replace spaces and special chars with hyphens
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100); // Max 100 chars
}

/**
 * Reserved slugs that cannot be used for bands
 */
const RESERVED_SLUGS = [
  'admin',
  'api',
  'auth',
  'bands',
  'songs',
  'setlists',
  'venues',
  'profile',
  'new',
  'edit',
  'delete',
  'create',
  'update',
  'search',
  'login',
  'logout',
  'register',
  'help',
  'legal',
  'about',
  'contact',
  'terms',
  'privacy',
  'settings',
  'public',
  'static',
  'uploads',
  'assets',
  'css',
  'js',
  'images',
];

/**
 * Check if a slug is reserved
 * @param {string} slug
 * @returns {boolean}
 */
function isReservedSlug(slug) {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

/**
 * Validate slug format
 * @param {string} slug
 * @returns {object} { valid: boolean, error: string }
 */
function validateSlug(slug) {
  if (!slug || slug.trim() === '') {
    return { valid: false, error: 'Slug cannot be empty' };
  }

  if (slug.length < 3) {
    return { valid: false, error: 'Slug must be at least 3 characters' };
  }

  if (slug.length > 100) {
    return { valid: false, error: 'Slug must be 100 characters or less' };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  if (slug.includes('--')) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }

  if (isReservedSlug(slug)) {
    return { valid: false, error: 'This slug is reserved and cannot be used' };
  }

  return { valid: true };
}

/**
 * Generate a unique slug for a band or album, handling conflicts
 * @param {object} prisma - Prisma client (or transaction)
 * @param {string} name - Band or album name
 * @param {string} type - 'band' or 'album' (default: 'band')
 * @param {number} excludeId - ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateUniqueSlug(prisma, name, type = 'band', excludeId = null) {
  let slug = generateSlug(name);
  let counter = 1;
  let isUnique = false;

  while (!isUnique) {
    const whereClause = { slug };
    if (excludeId) {
      whereClause.NOT = { id: excludeId };
    }

    let existing;
    if (type === 'album') {
      existing = await prisma.album.findFirst({ where: whereClause });
    } else {
      existing = await prisma.band.findFirst({ where: whereClause });
    }

    if (!existing) {
      isUnique = true;
    } else {
      // Add number suffix: krewe-de-groove-2
      counter++;
      slug = `${generateSlug(name)}-${counter}`;
    }
  }

  return slug;
}

module.exports = {
  generateSlug,
  validateSlug,
  isReservedSlug,
  generateUniqueSlug,
  RESERVED_SLUGS,
};

