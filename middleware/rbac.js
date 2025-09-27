/**
 * Role-Based Access Control Middleware
 * Handles user role checking and permission validation
 */

const { prisma } = require("../lib/prisma");

/**
 * Check if user has required role
 * @param {string|Array} requiredRoles - Single role or array of roles
 * @returns {Function} Express middleware function
 */
function requireRole(requiredRoles) {
  return async (req, res, next) => {
    try {
      // Check if user is logged in
      if (!req.session || !req.session.user) {
        return res.status(401).json({
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        });
      }

      const userId = req.session.user.id;

      // Get user with role information
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true, // Assuming we'll add a role field to users table
        },
      });

      if (!user) {
        return res.status(401).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Normalize requiredRoles to array
      const roles = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      // Check if user has required role
      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS",
          required: roles,
          current: user.role,
        });
      }

      // Add user info to request for use in route handlers
      req.user = user;
      next();
    } catch (error) {
      console.error("RBAC middleware error:", error);
      res.status(500).json({
        error: "Internal server error",
        code: "RBAC_ERROR",
      });
    }
  };
}

/**
 * Check if user is a moderator
 */
function requireModerator(req, res, next) {
  return requireRole("moderator")(req, res, next);
}

/**
 * Check if user is an admin
 */
function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}

/**
 * Check if user has any of the specified roles
 */
function requireAnyRole(roles) {
  return requireRole(roles);
}

/**
 * Optional role check - continues if user has role, otherwise skips
 * Useful for features that work differently for different roles
 */
function optionalRole(roles) {
  return async (req, res, next) => {
    try {
      if (!req.session || !req.session.user) {
        return next(); // Continue without role info
      }

      const userId = req.session.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, role: true },
      });

      if (user) {
        const userRoles = Array.isArray(roles) ? roles : [roles];
        if (userRoles.includes(user.role)) {
          req.user = user;
        }
      }

      next();
    } catch (error) {
      console.error("Optional role middleware error:", error);
      next(); // Continue on error
    }
  };
}

module.exports = {
  requireRole,
  requireModerator,
  requireAdmin,
  requireAnyRole,
  optionalRole,
};
