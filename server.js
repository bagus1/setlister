const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const methodOverride = require("method-override");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const requestLogger = require("./middleware/logging");
const logger = require("./utils/logger");

// Load environment variables from .env file
require("dotenv").config();

// Import routes
const { router: authRoutes } = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const bandRoutes = require("./routes/bands");
const songRoutes = require("./routes/songs");
const artistRoutes = require("./routes/artists");
const medleyRoutes = require("./routes/medleys");
const setlistRoutes = require("./routes/setlists");
const invitationRoutes = require("./routes/invitations");
const bulkAddSongsRoutes = require("./routes/bulk-add-songs");
const linkRoutes = require("./routes/links");
const legalRoutes = require("./routes/legal");
const whitelistRequestRoutes = require("./routes/whitelist-requests");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store io instance in app for use in routes
app.set("io", io);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static("public"));

// Session configuration
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: "./",
      table: "sessions",
    }),
    secret: process.env.SESSION_SECRET || "setlist-manager-secret-key",
    resave: true,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      // Make cookies last for 1 year (effectively permanent)
      maxAge: 365 * 24 * 60 * 60 * 1000,
    },
    // Sessions will persist in SQLite database and survive server restarts
    // 1 year maxAge ensures cookies don't expire in the browser
  })
);

// Request logging middleware (must come after session middleware)
app.use(requestLogger);

app.use(flash());

// Global middleware for flash messages and user
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  res.locals.currentUrl = req.originalUrl;
  next();
});

// View engine setup
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");

// Routes
app.use("/auth", authRoutes);
app.use("/routes", require("./routes/routes"));
app.use("/", dashboardRoutes);
app.use("/bands", bandRoutes);
app.use("/artists", artistRoutes);
app.use("/medleys", medleyRoutes);
app.use("/setlists", setlistRoutes);
app.use("/invite", invitationRoutes);
app.use("/bulk-add-songs", bulkAddSongsRoutes);
app.use("/songs", linkRoutes);
app.use("/songs", require("./routes/gig-documents"));
app.use("/songs", songRoutes);
app.use("/legal", legalRoutes);
app.use("/whitelist-request", whitelistRequestRoutes);
app.use("/admin", require("./routes/admin"));

// Socket.io for real-time collaboration
io.on("connection", (socket) => {
  logger.logInfo("Socket connected", null);

  socket.on("join-setlist", (setlistId) => {
    socket.join(`setlist-${setlistId}`);
    socket.broadcast.to(`setlist-${setlistId}`).emit("user-joined", socket.id);
  });

  socket.on("leave-setlist", (setlistId) => {
    socket.leave(`setlist-${setlistId}`);
    socket.broadcast.to(`setlist-${setlistId}`).emit("user-left", socket.id);
  });

  socket.on("setlist-update", (data) => {
    socket.broadcast
      .to(`setlist-${data.setlistId}`)
      .emit("setlist-updated", data);
  });

  socket.on("disconnect", () => {
    logger.logInfo("Socket disconnected", null);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.logError("Unhandled error", err);
  res.status(500).render("error", { message: "Something went wrong!" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", { message: "Page not found" });
});

const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, () => {
  logger.logInfo(`Server running on port ${PORT}`);
});
