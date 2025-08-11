const logger = {
  // Format: <timestamp> <message>
  formatMessage(message, userId = null) {
    const timestamp = new Date().toISOString();
    const userInfo = userId ? ` by user ${userId}` : "";
    return `${timestamp} ${message}${userInfo}`;
  },

  // Log page access
  logPageAccess(path, userId = null) {
    console.log(this.formatMessage(`${path} accessed`, userId));
  },

  // Log form submission
  logFormSubmission(path, action, userId = null, formData = {}) {
    // Remove sensitive fields from form data
    const sanitizedData = { ...formData };
    delete sanitizedData.password;
    delete sanitizedData.confirmPassword;
    delete sanitizedData.loginPassword;

    const formDataStr =
      Object.keys(sanitizedData).length > 0
        ? ` with ${JSON.stringify(sanitizedData)}`
        : "";

    console.log(this.formatMessage(`${path} ${action}${formDataStr}`, userId));
  },

  // Log authentication events
  logAuthEvent(event, userId = null) {
    console.log(this.formatMessage(event, userId));
  },

  // Log errors (keep existing format for errors)
  logError(message, error = null) {
    const timestamp = new Date().toISOString();
    if (error) {
      console.error(`${timestamp} ERROR: ${message}`, error);
    } else {
      console.error(`${timestamp} ERROR: ${message}`);
    }
  },

  // Log info messages
  logInfo(message, userId = null) {
    console.log(this.formatMessage(message, userId));
  },
};

module.exports = logger;
