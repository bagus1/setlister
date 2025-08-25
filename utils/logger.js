const fs = require("fs");
const path = require("path");

// Create logs directory outside of repo
const logsDir =
  process.env.LOG_DIR ||
  path.join(process.env.HOME || "/tmp", "logs", "setlister");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log file based on environment
const getLogFile = () => {
  // Use LOG_ENV first, then fall back to NODE_ENV
  const logEnv = process.env.LOG_ENV || process.env.NODE_ENV || "development";
  // Debug: log what environment variables we're seeing
  console.log(
    `[LOGGER DEBUG] LOG_ENV: ${process.env.LOG_ENV}, NODE_ENV: ${process.env.NODE_ENV}, Using: ${logEnv}`
  );
  return path.join(logsDir, `app-${logEnv}.log`);
};

const logger = {
  // Format: <timestamp> <message>
  formatMessage(message, userId = null) {
    const timestamp = new Date().toISOString();
    const userInfo = userId ? ` by user ${userId}` : "";
    return `${timestamp} ${message}${userInfo}`;
  },

  // Write to environment-specific log file
  writeToFile(message) {
    try {
      fs.appendFileSync(getLogFile(), message + "\n");
    } catch (error) {
      // Fallback to console if file write fails
      console.error("Failed to write to log file:", error);
    }
  },

  // Log page access
  logPageAccess(path, userId = null) {
    const message = this.formatMessage(`${path} accessed`, userId);
    console.log(message);
    this.writeToFile(message);
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

    const message = this.formatMessage(
      `${path} ${action}${formDataStr}`,
      userId
    );
    console.log(message);
    this.writeToFile(message);
  },

  // Log authentication events
  logAuthEvent(event, userId = null) {
    const message = this.formatMessage(event, userId);
    console.log(message);
    this.writeToFile(message);
  },

  // Log errors (keep existing format for errors)
  logError(message, error = null) {
    const timestamp = new Date().toISOString();
    let logMessage;
    if (error) {
      logMessage = `${timestamp} ERROR: ${message} ${error.stack || error}`;
      console.error(`${timestamp} ERROR: ${message}`, error);
    } else {
      logMessage = `${timestamp} ERROR: ${message}`;
      console.error(logMessage);
    }
    this.writeToFile(logMessage);
  },

  // Log info messages
  logInfo(message, userId = null) {
    const formattedMessage = this.formatMessage(message, userId);
    console.log(formattedMessage);
    this.writeToFile(formattedMessage);
  },
};

module.exports = logger;
