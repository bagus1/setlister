const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const PgStore = require("connect-pg-simple")(session);
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
const albumRoutes = require("./routes/albums");
const songRoutes = require("./routes/songs");
const artistRoutes = require("./routes/artists");
const medleyRoutes = require("./routes/medleys");
const setlistRoutes = require("./routes/setlists");
const invitationRoutes = require("./routes/invitations");
const bulkAddSongsRoutes = require("./routes/bulk-add-songs");
const linkRoutes = require("./routes/links");
const legalRoutes = require("./routes/legal");
const helpRoutes = require("./routes/help");
const whitelistRequestRoutes = require("./routes/whitelist-requests");
const googleDocProcessingRoutes =
  require("./routes/google-doc-processing").router;
const venueRoutes = require("./routes/venues");
const profileRoutes = require("./routes/profile");
const bandPageRoutes = require("./routes/band-page");
const musiciansRoutes = require("./routes/musicians");
const quickRecordRoutes = require("./routes/quick-record");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store io instance in app for use in routes
app.set("io", io);

// Middleware
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
app.use(methodOverride("_method"));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Session configuration
app.use(
  session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "sessions", // optional, defaults to 'session'
      createTableIfMissing: true, // automatically create the sessions table
    }),
    secret: process.env.SESSION_SECRET || "the-band-plan-secret-key",
    resave: false, // set to false for PostgreSQL store
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true in production with HTTPS
      httpOnly: true,
      sameSite: "lax",
      // Make cookies last for 1 year (effectively permanent)
      maxAge: 365 * 24 * 60 * 60 * 1000,
    },
    // Sessions will persist in PostgreSQL database and survive server restarts
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
  res.locals.hostname = req.hostname;
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

// Public all-bands route (no auth required)
app.get("/all-bands", async (req, res) => {
  try {
    const { prisma } = require("./lib/prisma");
    const bands = await prisma.band.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        isPublic: true,
        _count: {
          select: {
            songs: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.render("bands/public", {
      title: "Bands",
      pageTitle: "Bands",
      bands,
    });
  } catch (error) {
    console.error("Error fetching public bands:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "Failed to load bands",
    });
  }
});

app.use("/", dashboardRoutes);
app.use("/bands", bandRoutes);
app.use("/bands", albumRoutes);
app.use("/artists", artistRoutes);
app.use("/medleys", medleyRoutes);
app.use("/setlists", setlistRoutes);
app.use("/invite", invitationRoutes);
app.use("/bulk-add-songs", bulkAddSongsRoutes);
app.use("/songs", linkRoutes);
app.use("/songs", require("./routes/gig-documents"));
app.use("/songs", songRoutes);
app.use("/legal", legalRoutes);
app.use("/help", helpRoutes);
app.use("/whitelist-request", whitelistRequestRoutes);
app.use("/google-docs", googleDocProcessingRoutes);
app.use("/venues", venueRoutes);
app.use("/profile", profileRoutes);
app.use("/bands", bandPageRoutes);
app.use("/musicians", musiciansRoutes);
app.use("/quick-record", quickRecordRoutes);
app.use("/admin", require("./routes/admin"));

// Public Album Page Route - Check for /:bandSlug/:albumSlug pattern
app.get("/:bandSlug/:albumSlug", async (req, res) => {
  try {
    const { bandSlug, albumSlug } = req.params;
    const { prisma } = require("./lib/prisma");

    // Try to find a published album with this slug
    const album = await prisma.album.findFirst({
      where: {
        slug: albumSlug,
        isPublished: true,
        band: {
          slug: bandSlug,
          isPublic: true,
        },
      },
      include: {
        band: {
          include: {
            photos: {
              orderBy: {
                sortOrder: 'asc',
              },
            },
            socialLinks: true,
          },
        },
        tracks: {
          include: {
            song: {
              include: {
                artists: {
                  include: {
                    artist: true,
                  },
                },
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (album) {
      // Check if album has been released yet
      if (album.releaseDate) {
        const now = new Date();
        const releaseDate = new Date(album.releaseDate);
        if (releaseDate > now) {
          const timeDiff = releaseDate - now;
          const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          
          return res.status(403).send(`
            <html>
              <head>
                <title>Album Not Yet Released</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
              </head>
              <body class="bg-dark text-white d-flex align-items-center justify-content-center" style="min-height: 100vh;">
                <div class="text-center">
                  <i class="bi bi-clock-history display-1"></i>
                  <h1 class="mt-4">Album Not Yet Released</h1>
                  <p class="lead">${album.title} by ${album.band.name}</p>
                  <p class="text-muted">
                    This album will be released on<br>
                    <strong>${releaseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} 
                    at ${releaseDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong>
                  </p>
                  <p class="text-info">
                    ${days > 0 ? `${days} day${days !== 1 ? 's' : ''}, ` : ''}${hours} hour${hours !== 1 ? 's' : ''} remaining
                  </p>
                  <a href="/${album.band.slug}" class="btn btn-primary mt-3">Back to Band Page</a>
                </div>
              </body>
            </html>
          `);
        }
      }
      
      // Found an album and it's released - render the player
      return res.render("albums/player", {
        title: `${album.title} - ${album.band.name}`,
        marqueeTitle: album.band.name,
        album,
        layout: 'layout',
      });
    }

    // Not an album, continue to next route handler
    return res.status(404).render("error", {
      title: "Page Not Found",
      message: "This page doesn't exist or isn't available yet.",
    });
  } catch (error) {
    console.error("Public album page error:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "An error occurred loading this page.",
    });
  }
});

// Public Band Page Route - MUST BE LAST (catches /:slug at root level)
app.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { prisma } = require("./lib/prisma");

    const band = await prisma.band.findFirst({
      where: { 
        slug,
        isPublic: true, // Only show if band made it public
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                username: true,
                slug: true,
                isPublic: true,
                photos: {
                  select: {
                    filePath: true,
                  },
                  where: {
                    isPrimary: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        photos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        videos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        audioSamples: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        logos: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        pressQuotes: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        socialLinks: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
        albums: {
          where: {
            isPublished: true,
          },
          include: {
            tracks: {
              include: {
                song: true,
              },
            },
          },
          orderBy: {
            releaseDate: 'desc',
          },
        },
        gigs: {
          where: {
            status: 'CONFIRMED',
            gigDate: {
              gte: new Date(), // Future gigs only
            },
          },
          include: {
            venue: true,
          },
          orderBy: {
            gigDate: 'asc',
          },
          take: 10,
        },
      },
    });

    if (!band) {
      // Band doesn't exist or isn't public - render 404
      return res.status(404).render("error", {
        title: "Page Not Found",
        message: "This page doesn't exist or isn't available yet.",
      });
    }

    // Check if current user is a member of this band
    let isBandMember = false;
    if (req.session.user) {
      isBandMember = band.members.some(m => m.userId === req.session.user.id);
    }

    res.render("bands/public-page", {
      title: band.name,
      band,
      hasBandHeader: true,
      layout: 'layout',
      isBandMember,
      loggedIn: !!req.session.user,
    });
  } catch (error) {
    console.error("Public band page error:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "An error occurred loading this page.",
    });
  }
});

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
