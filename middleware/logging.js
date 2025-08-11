const logger = require("../utils/logger");

// Middleware to log all requests
const requestLogger = (req, res, next) => {
  // Safely access session user ID
  const userId = req.session && req.session.user ? req.session.user.id : null;
  const path = req.path;
  const method = req.method;

  // Log page access for GET requests
  if (method === "GET") {
    logger.logPageAccess(path, userId);
  }

  // Log form submissions for POST/PUT/DELETE requests
  if (["POST", "PUT", "DELETE"].includes(method)) {
    const action =
      method === "POST"
        ? "submitted"
        : method === "PUT"
          ? "updated"
          : "deleted";

    // Don't log sensitive routes
    if (!path.includes("/auth/login") && !path.includes("/auth/register")) {
      logger.logFormSubmission(path, action, userId, req.body);
    }
  }

  next();
};

module.exports = requestLogger;
