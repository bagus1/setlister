const logger = require("../utils/logger");

// Middleware to log all requests
const requestLogger = (req, res, next) => {
  // Safely access session user ID
  const userId = req.session && req.session.user ? req.session.user.id : null;
  const path = req.path;
  const method = req.method;

  // Get client IP (handles proxies/load balancers)
  const ip =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip;

  // Log page access for GET requests
  if (method === "GET") {
    logger.logPageAccess(path, userId, ip);
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
