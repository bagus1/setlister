const express = require("express");
const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.flash("error", "Please log in to access this page");
    res.redirect("/auth/login");
  }
};

// GET /routes/debug - Simple debug route (no auth required)
router.get("/debug", (req, res) => {
  res.json({
    message: "Routes debug endpoint working!",
    timestamp: new Date().toISOString(),
    app: !!req.app,
    hasRouter: !!(req.app && req.app._router),
    routerStack:
      req.app && req.app._router ? req.app._router.stack.length : "N/A",
  });
});

// GET /routes - Show all application routes with function names
router.get("/", requireAuth, (req, res) => {
  try {
    // Get the main app instance to access all routes
    const app = req.app;

    // Function to extract route information using express-list-routes
    function getRouteInfo() {
      const routes = [];

      // Use express-list-routes to get all routes
      const listRoutes = require("express-list-routes");

      // Create a temporary app to analyze routes
      const tempApp = express();

      // Mount all the same routes as the main app
      tempApp.use("/auth", require("./auth").router);
      tempApp.use("/", require("./dashboard"));
      tempApp.use("/bands", require("./bands"));
      tempApp.use("/artists", require("./artists"));
      tempApp.use("/medleys", require("./medleys"));
      tempApp.use("/setlists", require("./setlists"));
      tempApp.use("/invite", require("./invitations"));
      tempApp.use("/bulk-add-songs", require("./bulk-add-songs"));
      tempApp.use("/songs", require("./links"));
      tempApp.use("/songs", require("./gig-documents"));
      tempApp.use("/songs", require("./songs"));

      // Get routes from the temp app
      const routeList = listRoutes(tempApp);

      // Parse the route list into our format
      routeList.forEach((route) => {
        // Handle different possible formats from express-list-routes
        let method, path;

        if (typeof route === "string") {
          // Format: "GET      /path"
          const parts = route.trim().split(/\s+/);
          if (parts.length >= 2) {
            method = parts[0];
            path = parts[1];
          }
        } else if (route && typeof route === "object") {
          // Format: { method: 'GET', path: '/path' }
          method = route.method;
          path = route.path;
        }

        if (method && path) {
          routes.push({
            method: method.toUpperCase(),
            path: path,
            functionName: "route handler",
          });
        }
      });

      return routes;
    }

    // Get route information
    const routeInfo = getRouteInfo();

    // Group routes by prefix
    const groupedRoutes = {};
    routeInfo.forEach((route) => {
      const prefix = route.path.split("/")[1] || "root";
      if (!groupedRoutes[prefix]) {
        groupedRoutes[prefix] = [];
      }
      groupedRoutes[prefix].push(route);
    });

    // Sort routes within each group
    Object.keys(groupedRoutes).forEach((prefix) => {
      groupedRoutes[prefix].sort((a, b) => {
        // Sort by method first, then by path
        if (a.method !== b.method) {
          return a.method.localeCompare(b.method);
        }
        return a.path.localeCompare(b.path);
      });
    });

    res.render("routes/index", {
      title: "Application Routes",
      groupedRoutes,
      totalRoutes: routeInfo.length,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Error getting route info:", error);
    req.flash("error", "Error loading route information");
    res.redirect("/");
  }
});

module.exports = router;
