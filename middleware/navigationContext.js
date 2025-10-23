/**
 * Simple navigation context middleware using sessions
 * Helps users navigate back to setlists/rehearsal views from songs/edits/links/docs
 */

/**
 * Set navigation context in session
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
    timestamp: Date.now()
  };
}

/**
 * Get navigation context from session
 * @param {Object} req - Express request object
 * @returns {Object|null} Navigation context or null
 */
function getNavigationContext(req) {
  return req.session.navigationContext || null;
}

/**
 * Clear navigation context from session
 * @param {Object} req - Express request object
 */
function clearNavigationContext(req) {
  delete req.session.navigationContext;
}

/**
 * Get back URL from navigation context
 * @param {Object} req - Express request object
 * @returns {Object|null} Object with {label, url} or null
 */
function getBackToSetlistButton(req) {
  const context = getNavigationContext(req);
  if (!context) return null;

  const { type, setlistId, bandId, token } = context;
  
  if (type === 'setlist') {
    return {
      label: 'Back to Setlist',
      url: `/bands/${bandId}/setlists/${setlistId}`
    };
  } else if (type === 'rehearsal') {
    return {
      label: 'Back to Rehearsal',
      url: `/bands/${bandId}/setlists/${setlistId}/rehearsal${token ? `?t=${token}` : ''}`
    };
  }
  
  return null;
}

module.exports = {
  setNavigationContext,
  getNavigationContext,
  clearNavigationContext,
  getBackToSetlistButton
};

