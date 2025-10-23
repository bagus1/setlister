/**
 * Navigation Context Helper
 * Manages breadcrumb navigation for users drilling down from setlists/rehearsal views
 */

/**
 * Set navigation context when navigating from a setlist or rehearsal view
 * @param {Object} req - Express request object
 * @param {string} type - 'setlist' or 'rehearsal'
 * @param {number} setlistId - ID of the setlist
 * @param {number} bandId - ID of the band
 * @param {string} token - Token for public views (optional)
 */
function setNavigationContext(req, type, setlistId, bandId, token = null) {
  req.session.navigationContext = {
    type,
    setlistId,
    bandId,
    token,
    breadcrumb: [type]
  };
}

/**
 * Add a level to the navigation breadcrumb
 * @param {Object} req - Express request object
 * @param {string} level - 'song', 'link', 'doc', etc.
 * @param {Object} data - Additional data for this level (songId, linkId, docId, etc.)
 */
function addNavigationLevel(req, level, data = {}) {
  if (!req.session.navigationContext) {
    return;
  }
  
  req.session.navigationContext.breadcrumb.push(level);
  Object.assign(req.session.navigationContext, data);
}

/**
 * Get navigation context for rendering breadcrumbs
 * @param {Object} req - Express request object
 * @returns {Object|null} Navigation context or null if not set
 */
function getNavigationContext(req) {
  return req.session.navigationContext || null;
}

/**
 * Clear navigation context
 * @param {Object} req - Express request object
 */
function clearNavigationContext(req) {
  delete req.session.navigationContext;
}

/**
 * Generate breadcrumb navigation links
 * @param {Object} req - Express request object
 * @returns {Array} Array of breadcrumb objects with {label, url}
 */
function generateBreadcrumbs(req) {
  const context = getNavigationContext(req);
  if (!context) {
    return [];
  }

  const breadcrumbs = [];
  const { type, setlistId, bandId, token, songId, linkId, docId } = context;

  // Always start with the root (setlist or rehearsal)
  if (type === 'setlist') {
    breadcrumbs.push({
      label: 'Back to Setlist',
      url: `/bands/${bandId}/setlists/${setlistId}`
    });
  } else if (type === 'rehearsal') {
    breadcrumbs.push({
      label: 'Back to Rehearsal',
      url: `/bands/${bandId}/setlists/${setlistId}/rehearsal${token ? `?t=${token}` : ''}`
    });
  }

  // Add song level if we're deeper
  if (songId && context.breadcrumb.includes('song')) {
    breadcrumbs.push({
      label: 'Back to Song',
      url: `/bands/${bandId}/songs/${songId}`
    });
  }

  // Add link/doc level if we're at that level
  if (linkId && context.breadcrumb.includes('link')) {
    breadcrumbs.push({
      label: 'Back to Link',
      url: `/bands/${bandId}/songs/${songId}/links/${linkId}`
    });
  }

  if (docId && context.breadcrumb.includes('doc')) {
    breadcrumbs.push({
      label: 'Back to Document',
      url: `/bands/${bandId}/songs/${songId}/docs/${docId}`
    });
  }

  return breadcrumbs;
}

module.exports = {
  setNavigationContext,
  addNavigationLevel,
  getNavigationContext,
  clearNavigationContext,
  generateBreadcrumbs
};
