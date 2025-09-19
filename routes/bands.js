const express = require("express");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const {
  sendBandInvitation,
  sendBandInvitationNotification,
} = require("../utils/emailService");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("./auth");

const router = express.Router();

// All band routes require authentication
router.use(requireAuth);

// GET /bands - List all bands for the user
router.get("/", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const bands = await prisma.band.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: userId,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.render("bands/index", {
      title: "My Bands",
      pageTitle: "My Bands",
      bands,
    });
  } catch (error) {
    console.error("Bands index error:", error);
    req.flash("error", "An error occurred loading bands");
    res.redirect("/");
  }
});

// GET /bands/new - Show create band form
router.get("/new", (req, res) => {
  res.render("bands/new", { title: "Create Band" });
});

// POST /bands - Create a new band
router.post(
  "/",
  [
    body("name")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Band name is required"),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("bands/new", {
          title: "Create Band",
          errors: errors.array(),
          name: req.body.name,
          description: req.body.description,
        });
      }

      const { name, description } = req.body;
      const userId = req.session.user.id;

      // Create band and add creator as owner in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const band = await tx.band.create({
          data: {
            name,
            description,
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.bandMember.create({
          data: {
            bandId: band.id,
            userId,
            role: "owner",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        return band;
      });

      const band = result;

      req.flash("success", "Band created successfully!");
      res.redirect(`/bands/${band.id}`);
    } catch (error) {
      console.error("Create band error:", error);
      req.flash("error", "An error occurred creating the band");
      res.redirect("/bands/new");
    }
  }
);

// GET /bands/:id - Show band details
router.get("/:id", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Check if user is a member
    const isMember = band.members.some((member) => member.user.id === userId);
    if (!isMember) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get setlists
    const setlists = await prisma.setlist.findMany({
      where: { bandId: parseInt(bandId) },
      orderBy: { updatedAt: "desc" },
    });

    // Get band songs with includes
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        song: {
          include: {
            artists: {
              include: {
                artist: true,
              },
            },
            vocalist: true,
            links: true,
            gigDocuments: true,
          },
        },
      },
      orderBy: {
        song: {
          title: "asc",
        },
      },
    });

    // Get band venues (latest 3)
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3,
    });

    // Get pending invitations (not used, not expired)
    let pendingInvitations = [];
    try {
      0;
      pendingInvitations = await prisma.bandInvitation.findMany({
        where: {
          bandId: parseInt(bandId),
          used_at: null,
          expires_at: { gt: new Date() },
        },
        include: {
          inviter: {
            select: {
              username: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (associationError) {
      console.error(
        `[${new Date().toISOString()}] Association error, falling back to basic query:`,
        associationError
      );
      // Fallback: get invitations without the association
      pendingInvitations = await prisma.bandInvitation.findMany({
        where: {
          bandId: parseInt(bandId),
          used_at: null,
          expires_at: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });
      console.log(
        `[${new Date().toISOString()}] Fallback query loaded ${pendingInvitations.length} pending invitations`
      );
    }

    res.render("bands/show", {
      title: band.name,
      hasBandHeader: true,
      band,
      setlists,
      bandSongs,
      bandVenues,
      pendingInvitations,
      userId,
    });
  } catch (error) {
    console.error("Show band error:", error);
    req.flash("error", "An error occurred loading the band");
    res.redirect("/bands");
  }
});

// POST /bands/:id/setlists - Create a new setlist for the band
router.post(
  "/:id/setlists",
  [
    body("title")
      .trim()
      .isLength({ min: 1 })
      .withMessage("Setlist title is required"),
    body("date")
      .optional()
      .custom((value) => {
        if (value === "" || value === null || value === undefined) {
          return true; // Allow empty/null values
        }
        // If a value is provided, validate it's a proper date
        const date = new Date(value);
        return !isNaN(date.getTime());
      })
      .withMessage("Invalid date format"),
  ],
  async (req, res) => {
    try {
      const bandId = req.params.id;
      const userId = req.session.user.id;

      // Check if user is a member
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId },
      });

      if (!membership) {
        req.flash("error", "You are not a member of this band");
        return res.redirect("/bands");
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", errors.array()[0].msg);
        return res.redirect(`/bands/${bandId}`);
      }

      const { title, date } = req.body;

      // Create setlist and default sets in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const setlist = await tx.setlist.create({
          data: {
            title,
            bandId: parseInt(bandId),
            createdById: req.session.user.id,
            date: date ? new Date(date) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create default sets
        const setNames = ["Set_1", "Set_2", "Set_3", "Set_4", "Maybe"];
        for (let i = 0; i < setNames.length; i++) {
          await tx.setlistSet.create({
            data: {
              setlistId: setlist.id,
              name: setNames[i],
              order: i,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        return setlist;
      });

      const setlist = result;

      req.flash("success", "Setlist created successfully!");
      res.redirect(`/setlists/${setlist.id}/edit`);
    } catch (error) {
      console.error("Create setlist error:", error);
      req.flash("error", "An error occurred creating the setlist");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// POST /bands/:id/invite - Send email invitation to join the band
router.post(
  "/:id/invite",
  [body("email").isEmail().withMessage("Please enter a valid email")],
  async (req, res) => {
    try {
      const bandId = req.params.id;
      const userId = req.session.user.id;
      const { email } = req.body;

      // Check if user is owner of the band
      const membership = await prisma.bandMember.findFirst({
        where: { bandId: parseInt(bandId), userId, role: "owner" },
      });

      if (!membership) {
        req.flash("error", "Only band owners can invite members");
        return res.redirect(`/bands/${bandId}`);
      }

      // Get band details
      const band = await prisma.band.findUnique({
        where: { id: parseInt(bandId) },
      });
      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      // Check if user already exists and handle accordingly
      const existingUser = await prisma.user.findFirst({ where: { email } });
      if (existingUser) {
        const existingMembership = await prisma.bandMember.findFirst({
          where: { bandId: parseInt(bandId), userId: existingUser.id },
        });

        if (existingMembership) {
          req.flash("error", "This person is already a member of the band");
          return res.redirect(`/bands/${bandId}`);
        }

        // User exists but is not a member of this band - add them automatically
        await prisma.bandMember.create({
          data: {
            bandId: parseInt(bandId),
            userId: existingUser.id,
            role: "member",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Get inviter name
        const inviter = await prisma.user.findUnique({
          where: { id: userId },
        });

        // Send notification email to existing user
        const emailSent = await sendBandInvitationNotification(
          null,
          band,
          inviter.username,
          existingUser.email
        );

        if (emailSent) {
          req.flash(
            "success",
            `${email} has been added to the band! A notification email has been sent.`
          );
        } else {
          req.flash(
            "success",
            `${email} has been added to the band! (Email notification failed)`
          );
        }

        return res.redirect(`/bands/${bandId}`);
      }

      // Check if there's already a pending invitation
      const existingInvitation = await prisma.bandInvitation.findFirst({
        where: {
          bandId: parseInt(bandId),
          email,
          used_at: null,
          expires_at: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        req.flash(
          "error",
          "An invitation has already been sent to this email address"
        );
        return res.redirect(`/bands/${bandId}`);
      }

      // Create invitation
      const invitation = await prisma.bandInvitation.create({
        data: {
          id: uuidv4(),
          bandId: parseInt(bandId),
          email,
          token: uuidv4(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          invitedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Get inviter name
      const inviter = await prisma.user.findUnique({
        where: { id: userId },
      });

      // Send email
      const emailSent = await sendBandInvitation(
        invitation,
        band,
        inviter.username
      );

      if (emailSent) {
        req.flash(
          "success",
          `Invitation sent to ${email}! They have 7 days to accept.`
        );
      } else {
        req.flash(
          "error",
          "Failed to send invitation email. Please check your email configuration."
        );
      }

      res.redirect(`/bands/${bandId}`);
    } catch (error) {
      console.error("Invite member error:", error);
      req.flash("error", "An error occurred sending the invitation");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// GET /bands/:id/songs - Show band's songs with checkboxes
router.get("/:id/songs", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    // Check if referrer is a setlist edit page
    const referrer = req.get("Referer");
    let fromSetlist = null;

    if (referrer) {
      // Look for setlist edit URL pattern: /setlists/:id/edit
      const setlistEditMatch = referrer.match(/\/setlists\/(\d+)\/edit/);
      if (setlistEditMatch) {
        const setlistId = setlistEditMatch[1];
        // Verify the setlist exists and belongs to this band
        const setlist = await prisma.setlist.findFirst({
          where: { id: parseInt(setlistId), bandId: parseInt(bandId) },
        });
        if (setlist) {
          fromSetlist = {
            id: setlist.id,
            title: setlist.title,
          };
        }
      }
    }

    // Get all songs with privacy filtering
    const allSongs = await prisma.song.findMany({
      where: {
        OR: [
          { private: false }, // Show all public songs
          { private: true, createdById: userId }, // Show private songs only if user owns them
        ],
      },
      include: {
        vocalist: true,
        artists: {
          include: {
            artist: true,
          },
        },
        gigDocuments: true,
        links: true,
        creator: true, // Include creator info for display
      },
      orderBy: { title: "asc" },
    });

    // Get band's current songs
    const bandSongs = await prisma.bandSong.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        song: {
          include: {
            vocalist: true,
            artists: {
              include: {
                artist: true,
              },
            },
          },
        },
      },
    });

    const bandSongIds = bandSongs.map((bs) => bs.songId);

    res.render("bands/songs", {
      pageTitle: `${band.name} Song Manager`,
      band,
      hasBandHeader: false,
      allSongs,
      bandSongIds,
      fromSetlist,
    });
  } catch (error) {
    console.error("Band songs error:", error);
    req.flash("error", "An error occurred loading band songs");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/songs/new - Process new song creation
router.post("/:id/songs/new", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { title, artist, content, docType } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!title || !title.trim()) {
      req.flash("error", "Song title is required");
      return res.redirect(`/bands/${bandId}/songs/new`);
    }

    // Create or find artist if provided (case-insensitive)
    let artistId = null;
    if (artist && artist.trim()) {
      // First try to find existing artist (case-insensitive)
      const existingArtist = await prisma.artist.findFirst({
        where: {
          name: {
            equals: artist.trim(),
            mode: "insensitive",
          },
        },
      });

      if (existingArtist) {
        artistId = existingArtist.id;
      } else {
        // Create new artist if not found
        const artistRecord = await prisma.artist.create({
          data: {
            name: artist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        artistId = artistRecord.id;
      }
    }

    // Check if song with same title and artist already exists
    let song;
    let isExistingSong = false;

    if (artistId) {
      // Look for existing song with same title and artist (case insensitive)
      const existingSong = await prisma.song.findFirst({
        where: {
          title: {
            equals: title.trim(),
            mode: "insensitive",
          },
          artists: {
            some: {
              artistId: artistId,
            },
          },
          // Privacy-aware duplicate detection:
          // - Always check public songs
          // - Only check same user's private songs
          OR: [
            { private: false }, // Always check public songs
            { private: true, createdById: userId }, // Only check same user's private songs
          ],
        },
        include: {
          artists: {
            include: {
              artist: true,
            },
          },
        },
      });

      if (existingSong) {
        song = existingSong;
        isExistingSong = true;
      }
    } else {
      // Look for existing song with same title and no artist (case insensitive)
      const existingSong = await prisma.song.findFirst({
        where: {
          title: {
            equals: title.trim(),
            mode: "insensitive",
          },
          artists: {
            none: {},
          },
          // Privacy-aware duplicate detection:
          // - Always check public songs
          // - Only check same user's private songs
          OR: [
            { private: false }, // Always check public songs
            { private: true, createdById: userId }, // Only check same user's private songs
          ],
        },
      });

      if (existingSong) {
        song = existingSong;
        isExistingSong = true;
      }
    }

    // Create new song if it doesn't exist
    if (!song) {
      song = await prisma.song.create({
        data: {
          title: title.trim(),
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Add artist relationship if artist was provided
      if (artistId) {
        await prisma.songArtist.create({
          data: {
            songId: song.id,
            artistId: artistId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Add song to band (check if relationship already exists)
    const existingBandSong = await prisma.bandSong.findFirst({
      where: {
        bandId: bandId,
        songId: song.id,
      },
    });

    if (!existingBandSong) {
      await prisma.bandSong.create({
        data: {
          bandId: bandId,
          songId: song.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create gig document if content was provided
    if (content && content.trim() && docType) {
      // Find the next available version for this song and document type
      const existingDocs = await prisma.gigDocument.findMany({
        where: {
          songId: song.id,
          type: docType,
        },
        orderBy: {
          version: "desc",
        },
      });

      let docVersion = 1;
      if (existingDocs.length > 0) {
        docVersion = existingDocs[0].version + 1;
      }

      await prisma.gigDocument.create({
        data: {
          songId: song.id,
          type: docType,
          version: docVersion,
          content: content.trim(),
          createdById: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    let successMessage;
    if (isExistingSong) {
      successMessage = `Song "${song.title}" already exists and has been added to ${band.name}'s repertoire!`;
    } else {
      successMessage = `Song "${song.title}" created and added to ${band.name} successfully!`;
    }

    if (content && content.trim() && docType) {
      if (isExistingSong) {
        successMessage += ` Additional gig document added.`;
      } else {
        successMessage += ` Gig document created.`;
      }
    }

    req.flash("success", successMessage);
    res.redirect(`/bands/${bandId}`);
  } catch (error) {
    console.error("New song creation error:", error);
    req.flash("error", "An error occurred creating the song");
    res.redirect(`/bands/${req.params.id}/songs/new`);
  }
});

// POST /bands/:id/songs/:songId - Add song to band
router.post("/:id/songs/:songId", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already added
    const existing = await prisma.bandSong.findFirst({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    if (existing) {
      return res.status(400).json({ error: "Song already in band" });
    }

    await prisma.bandSong.create({
      data: {
        bandId: parseInt(bandId),
        songId: parseInt(songId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Add band song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/songs/:songId - Remove song from band
router.delete("/:id/songs/:songId", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandSong.deleteMany({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/songs/:songId/remove - Workaround for DELETE requests
router.post("/:id/songs/:songId/remove", async (req, res) => {
  try {
    const { id: bandId, songId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandSong.deleteMany({
      where: { bandId: parseInt(bandId), songId: parseInt(songId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band song error (POST):", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/invitations/:invitationId - Delete invitation
router.delete("/:id/invitations/:invitationId", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] DELETE invitation route hit:`,
    req.params
  );
  try {
    const { id: bandId, invitationId } = req.params;
    const userId = req.session.user.id;

    console.log(`[${new Date().toISOString()}] Deleting invitation:`, {
      bandId,
      invitationId,
      userId,
    });

    // Check if user is owner of the band
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId, role: "owner" },
    });

    if (!membership) {
      console.log(
        `[${new Date().toISOString()}] User ${userId} is not owner of band ${bandId}`
      );
      return res
        .status(403)
        .json({ error: "Only band owners can delete invitations" });
    }

    // Delete the invitation
    await prisma.bandInvitation.deleteMany({
      where: {
        id: invitationId,
        bandId: parseInt(bandId),
        used_at: null, // Only delete unused invitations
      },
    });

    console.log(
      `[${new Date().toISOString()}] Successfully deleted invitation ${invitationId}`
    );
    res.json({ success: true });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Delete invitation error:`,
      error
    );
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/invitations/:invitationId/delete - Workaround for DELETE requests
router.post("/:id/invitations/:invitationId/delete", async (req, res) => {
  console.log(
    `[${new Date().toISOString()}] POST delete invitation route hit:`,
    req.params
  );
  try {
    const { id: bandId, invitationId } = req.params;
    const userId = req.session.user.id;

    console.log(`[${new Date().toISOString()}] Deleting invitation via POST:`, {
      bandId,
      invitationId,
      userId,
    });

    // Check if user is owner of the band
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId, role: "owner" },
    });

    if (!membership) {
      console.log(
        `[${new Date().toISOString()}] User ${userId} is not owner of band ${bandId}`
      );
      return res
        .status(403)
        .json({ error: "Only band owners can delete invitations" });
    }

    // Delete the invitation
    await prisma.bandInvitation.deleteMany({
      where: {
        id: invitationId,
        bandId: parseInt(bandId),
        used_at: null, // Only delete unused invitations
      },
    });

    console.log(
      `[${new Date().toISOString()}] Successfully deleted invitation ${invitationId} via POST`
    );
    res.json({ success: true });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] POST delete invitation error:`,
      error
    );
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/quick-set - Process quick set creation
router.post(
  "/:id/quick-set",
  [body("songList").notEmpty().withMessage("Please provide a song list")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        req.flash("error", "Please provide a song list");
        return res.redirect(`/bands/${req.params.id}`);
      }

      const bandId = parseInt(req.params.id);
      const userId = req.session.user.id;
      const { songList } = req.body;

      // Check band membership
      const band = await prisma.band.findFirst({
        where: {
          id: bandId,
          members: {
            some: { userId: userId },
          },
        },
      });

      if (!band) {
        req.flash("error", "Band not found or you don't have permission");
        return res.redirect("/bands");
      }

      // Parse the song list
      console.log("=== PARSING DEBUG ===");
      console.log("Raw input:", songList);
      const parseResult = parseQuickSetInput(songList);
      console.log("Parse result:", {
        sets: parseResult.sets.length,
        songs: parseResult.songs.length,
        setlistTitle: parseResult.setlistTitle,
        errors: parseResult.errors,
      });

      if (parseResult.errors.length > 0) {
        req.flash("error", parseResult.errors.join(", "));
        return res.redirect(`/bands/${bandId}`);
      }

      // Create setlist with detected title or auto-generated name
      const currentDate = new Date();
      const setlistTitle =
        parseResult.setlistTitle ||
        `Quick Set - ${currentDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`;

      console.log(`Creating setlist with title: "${setlistTitle}"`);

      const setlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          bandId: bandId,
          createdById: req.session.user.id,
          date: currentDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Create empty sets for the setlist (use upsert to avoid duplicates)
      for (const set of parseResult.sets) {
        const setName =
          set.name === "Set 1"
            ? "Set_1"
            : set.name === "Set 2"
              ? "Set_2"
              : set.name === "Set 3"
                ? "Set_3"
                : set.name === "Set 4"
                  ? "Set_4"
                  : set.name === "Encore"
                    ? "Set_3"
                    : "Maybe";

        await prisma.setlistSet.upsert({
          where: {
            setlistId_name: {
              setlistId: setlist.id,
              name: setName,
            },
          },
          update: {
            order: set.setNumber === 999 ? 999 : set.setNumber,
            updatedAt: new Date(),
          },
          create: {
            setlistId: setlist.id,
            name: setName,
            order: set.setNumber === 999 ? 999 : set.setNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Store the parsed data and setlist ID in session for confirmation page
      req.session.quickSetData = {
        bandId: bandId,
        setlistId: setlist.id,
        sets: parseResult.sets,
        songs: parseResult.songs,
      };

      // Redirect to confirmation page
      res.redirect(`/bands/${bandId}/quick-set/confirm`);
    } catch (error) {
      console.error("Quick set creation error:", error);
      req.flash("error", "An error occurred processing your setlist");
      res.redirect(`/bands/${req.params.id}`);
    }
  }
);

// POST /bands/:id/quick-set/process-song - Process individual song via AJAX
router.post("/:id/quick-set/process-song", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const {
      songLine,
      selection,
      setlistId,
      editedTitle,
      newArtist,
      originalTitle,
      songId,
    } = req.body;

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId ||
      req.session.quickSetData.setlistId !== parseInt(setlistId)
    ) {
      return res.status(400).json({ error: "Invalid session data" });
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { sets, songs } = req.session.quickSetData;
    const originalSong = songs.find((s) => s.lineNumber === parseInt(songLine));

    if (!originalSong) {
      return res.status(400).json({ error: "Song not found" });
    }

    let processedSong;

    if (selection === "new") {
      // Create new song with edited title if provided
      const finalTitle = editedTitle || originalTitle || originalSong.title;
      const artistName = newArtist || originalSong.artist;

      // Create or find artist if provided
      let artistId = null;
      if (artistName && artistName.trim()) {
        const artist = await prisma.artist.upsert({
          where: { name: artistName.trim() },
          update: {},
          create: {
            name: artistName.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        artistId = artist.id;
      }

      // Check if song already exists (with privacy-aware duplicate detection)
      let existingSong = null;
      if (artistId) {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { some: { artistId: artistId } },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: userId }, // Only check same user's private songs
            ],
          },
        });
      } else {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { none: {} },
            // Privacy-aware duplicate detection:
            // - Always check public songs
            // - Only check same user's private songs
            OR: [
              { private: false }, // Always check public songs
              { private: true, createdById: userId }, // Only check same user's private songs
            ],
          },
        });
      }

      // Check if user wants to make this song private
      const isPrivate = req.body[`new_private_${songLine}`] === "true";
      console.log(
        `DEBUG AJAX: Line ${songLine} - isPrivate: ${isPrivate}, checkbox value: ${req.body[`new_private_${songLine}`]}`
      );

      // Use existing song if found, otherwise create new one
      processedSong =
        existingSong ||
        (await prisma.song.create({
          data: {
            title: finalTitle,
            createdById: userId,
            private: isPrivate,
            createdAt: new Date(),
            updatedAt: new Date(),
            artists: artistId
              ? {
                  create: {
                    artistId: artistId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                }
              : undefined,
          },
          include: {
            artists: { include: { artist: true } },
          },
        }));
    } else {
      // Use existing song
      processedSong = await prisma.song.findUnique({
        where: { id: parseInt(songId) },
        include: {
          artists: { include: { artist: true } },
        },
      });

      if (!processedSong) {
        return res.status(400).json({ error: "Selected song not found" });
      }

      // Add artist if provided for existing song
      if (newArtist && newArtist.trim()) {
        const artist = await prisma.artist.upsert({
          where: { name: newArtist.trim() },
          update: {},
          create: {
            name: newArtist.trim(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Add artist to song if not already associated
        await prisma.songArtist.upsert({
          where: {
            songId_artistId: {
              songId: processedSong.id,
              artistId: artist.id,
            },
          },
          update: {},
          create: {
            songId: processedSong.id,
            artistId: artist.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Add song to band
    await prisma.bandSong.upsert({
      where: {
        bandId_songId: {
          bandId: bandId,
          songId: processedSong.id,
        },
      },
      update: {},
      create: {
        bandId: bandId,
        songId: processedSong.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Find the appropriate set and add song to setlist
    const setData = sets.find((s) =>
      s.songs.some((song) => song.lineNumber === parseInt(songLine))
    );
    console.log(`Processing song ${songLine}, setData:`, setData);
    console.log("Session data structure:", {
      isGoogleDocImport: req.session.quickSetData.isGoogleDocImport,
      hasGoogleDocData: !!req.session.quickSetData.googleDocData,
      sets: req.session.quickSetData.sets.map((s) => ({
        name: s.name,
        songCount: s.songs.length,
      })),
      songs: req.session.quickSetData.songs.map((s) => ({
        lineNumber: s.lineNumber,
        title: s.title,
        hasProcessedContent: !!s.processedContent,
      })),
    });

    if (setData) {
      const setName =
        setData.name === "Google Doc Songs"
          ? "Set_1"
          : setData.name === "Set 1"
            ? "Set_1"
            : setData.name === "Set 2"
              ? "Set_2"
              : setData.name === "Set 3"
                ? "Set_3"
                : setData.name === "Set 4"
                  ? "Set_4"
                  : setData.name === "Encore"
                    ? "Set_3"
                    : "Set_1"; // Default to Set_1 for Google Doc imports

      console.log(
        `Looking for setlist set: setlistId=${setlistId}, name=${setName}`
      );

      // Find the setlist set
      const setlistSet = await prisma.setlistSet.findFirst({
        where: {
          setlistId: parseInt(setlistId),
          name: setName,
        },
      });

      console.log("Found setlistSet:", setlistSet);

      if (setlistSet) {
        // Count existing songs in this set for ordering
        const existingSongsCount = await prisma.setlistSong.count({
          where: { setlistSetId: setlistSet.id },
        });

        // Add song to setlist
        console.log(
          `Adding song to setlist: setlistSetId=${setlistSet.id}, songId=${processedSong.id}, order=${existingSongsCount + 1}`
        );
        await prisma.setlistSong.create({
          data: {
            setlistSetId: setlistSet.id,
            songId: processedSong.id,
            order: existingSongsCount + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`Successfully added song to setlist`);
      }
    }

    // If this is a Google Doc import and we have content, create a gig document and links
    if (
      req.session.quickSetData.isGoogleDocImport &&
      req.session.quickSetData.googleDocData &&
      originalSong.processedContent
    ) {
      try {
        console.log("Creating gig document for Google Doc import:");
        console.log("- Song title:", processedSong.title);
        console.log("- Song ID:", processedSong.id);
        console.log(
          "- Processed content length:",
          originalSong.processedContent?.length
        );
        console.log("- User ID:", userId);

        // Auto-increment version for Google Doc imports (same logic as gig-documents route)
        let docVersion = 1;
        const existingDocs = await prisma.gigDocument.findMany({
          where: { songId: processedSong.id, type: "chords" },
          orderBy: { version: "desc" },
          take: 1,
        });
        if (existingDocs.length > 0) {
          docVersion = existingDocs[0].version + 1;
        }
        console.log(`- Creating gig document version: ${docVersion}`);

        // Create a gig document from the processed Google Doc content (TinyMCE compatible)
        const gigDocument = await prisma.gigDocument.create({
          data: {
            content: originalSong.processedContent, // Use processed content for TinyMCE
            songId: processedSong.id,
            type: "chords", // Default type for Google Doc imports
            version: docVersion, // Use incremented version
            createdById: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `Created gig document for Google Doc import: ${gigDocument.id}`
        );

        // Create links from extracted URLs if any
        if (originalSong.urls && originalSong.urls.length > 0) {
          let linksCreated = 0;
          for (const urlInfo of originalSong.urls) {
            // Skip font resources and other non-music links
            if (urlInfo.type === "font_resource" || urlInfo.type === "other") {
              continue;
            }

            try {
              // Check if link already exists
              const existingLink = await prisma.link.findFirst({
                where: {
                  songId: processedSong.id,
                  url: urlInfo.url,
                },
              });

              if (!existingLink) {
                // Create new link
                await prisma.link.create({
                  data: {
                    songId: processedSong.id,
                    createdById: req.session.user.id,
                    type: urlInfo.type,
                    description: urlInfo.description || urlInfo.url,
                    url: urlInfo.url,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
                linksCreated++;
              }
            } catch (error) {
              console.error(`Error creating link: ${error.message}`);
            }
          }

          console.log(
            `Created ${linksCreated} links for Google Doc import song: ${processedSong.title}`
          );
        }
      } catch (error) {
        console.error(
          "Error creating gig document for Google Doc import:",
          error
        );
        // Don't fail the whole operation if gig document creation fails
      }
    }

    res.json({
      success: true,
      songTitle: processedSong.title,
      songId: processedSong.id,
    });
  } catch (error) {
    console.error("Process song error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/quick-set/create - Create the setlist from confirmed selections
router.post("/:id/quick-set/create", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { setlistTitle, setlistDate, ...songSelections } = req.body;

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId
    ) {
      req.flash("error", "No setlist data found. Please try again.");
      return res.redirect(`/bands/${bandId}`);
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const { sets, songs } = req.session.quickSetData;
    const createSetlist = req.session.quickSetData.createSetlist !== false;

    // Process song selections and create new songs as needed
    const processedSongs = await Promise.all(
      songs.map(async (originalSong, index) => {
        const lineNumber = originalSong.lineNumber; // Use the actual line number from parsing
        const selection = songSelections[`song_${lineNumber}`];

        // Skip if no selection was made for this song
        if (!selection) {
          return null;
        }

        if (selection === "new") {
          // Create new song - use edited title if provided, otherwise original
          const finalTitle =
            songSelections[`edited_title_${lineNumber}`] || originalSong.title;
          const artistName =
            songSelections[`new_artist_${lineNumber}`] || originalSong.artist;

          // Create or find artist if provided
          let artistId = null;
          if (artistName && artistName.trim()) {
            const artist = await prisma.artist.upsert({
              where: { name: artistName.trim() },
              update: {},
              create: {
                name: artistName.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
            artistId = artist.id;
          }

          // Check if song already exists with proper duplicate logic (case-insensitive)
          let existingSong = null;

          if (artistId) {
            // If artist is provided, check for same title AND same artist (both case-insensitive)
            existingSong = await prisma.song.findFirst({
              where: {
                title: {
                  equals: finalTitle.trim(),
                  mode: "insensitive",
                },
                artists: {
                  some: {
                    artistId: artistId,
                  },
                },
                // Privacy-aware duplicate detection:
                // - Always check public songs
                // - Only check same user's private songs
                OR: [
                  { private: false }, // Always check public songs
                  { private: true, createdById: userId }, // Only check same user's private songs
                ],
              },
              include: {
                artists: {
                  include: {
                    artist: true,
                  },
                },
              },
            });
          } else {
            // If no artist provided, check for same title with NO artists (case-insensitive)
            existingSong = await prisma.song.findFirst({
              where: {
                title: {
                  equals: finalTitle.trim(),
                  mode: "insensitive",
                },
                artists: {
                  none: {},
                },
                // Privacy-aware duplicate detection:
                // - Always check public songs
                // - Only check same user's private songs
                OR: [
                  { private: false }, // Always check public songs
                  { private: true, createdById: userId }, // Only check same user's private songs
                ],
              },
              include: {
                artists: {
                  include: {
                    artist: true,
                  },
                },
              },
            });
          }

          // Check if user wants to make this song private
          const isPrivate = req.body[`new_private_${lineNumber}`] === "true";
          console.log(
            `DEBUG: Line ${lineNumber} - isPrivate: ${isPrivate}, checkbox value: ${req.body[`new_private_${lineNumber}`]}`
          );

          // Use existing song if found, otherwise create new one
          const newSong =
            existingSong ||
            (await prisma.song.create({
              data: {
                title: finalTitle,
                createdById: userId,
                private: isPrivate,
                createdAt: new Date(),
                updatedAt: new Date(),
                artists: artistId
                  ? {
                      create: {
                        artistId: artistId,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      },
                    }
                  : undefined,
              },
              include: {
                artists: {
                  include: { artist: true },
                },
              },
            }));

          // Add song to band
          await prisma.bandSong.upsert({
            where: {
              bandId_songId: {
                bandId: bandId,
                songId: newSong.id,
              },
            },
            update: {},
            create: {
              bandId: bandId,
              songId: newSong.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          return newSong;
        } else if (selection.startsWith("existing_")) {
          // Use existing song
          const songId = parseInt(selection.replace("existing_", ""));
          const existingSong = await prisma.song.findUnique({
            where: { id: songId },
            include: {
              artists: {
                include: { artist: true },
              },
            },
          });

          if (existingSong) {
            // Check if an artist was provided for this existing song
            const artistFieldName = `existing_artist_${originalSong.lineNumber}_${songId}`;
            const providedArtist = req.body[artistFieldName];

            if (
              providedArtist &&
              providedArtist.trim() &&
              existingSong.artists.length === 0
            ) {
              // Add the artist to this existing song
              let artist = await prisma.artist.findFirst({
                where: { name: providedArtist.trim() },
              });

              if (!artist) {
                // Create new artist
                artist = await prisma.artist.create({
                  data: {
                    name: providedArtist.trim(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
              }

              // Add artist to song
              await prisma.songArtist.create({
                data: {
                  songId: songId,
                  artistId: artist.id,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });

              // Refresh the song with the new artist
              const updatedSong = await prisma.song.findUnique({
                where: { id: songId },
                include: {
                  artists: {
                    include: { artist: true },
                  },
                },
              });

              if (updatedSong) {
                existingSong.artists = updatedSong.artists;
              }
            }

            // Ensure song is added to band if not already
            try {
              await prisma.bandSong.upsert({
                where: {
                  bandId_songId: {
                    bandId: bandId,
                    songId: songId,
                  },
                },
                update: {},
                create: {
                  bandId: bandId,
                  songId: songId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            } catch (error) {
              // If unique constraint fails, the song is already associated with the band
              // This is fine, just continue
              console.log(
                `Song ${songId} already associated with band ${bandId}`
              );
            }
          }

          return existingSong;
        }

        return null;
      })
    );

    // Filter out any null songs
    const validSongs = processedSongs.filter((song) => song !== null);

    // Only create setlist if we're supposed to
    let setlist = null;
    if (createSetlist) {
      // Create the setlist
      setlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          date: setlistDate ? new Date(setlistDate) : new Date(),
          bandId: bandId,
          createdById: req.session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Create sets and add songs (only if creating a setlist)
    if (createSetlist) {
      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];

        // Map set names to database enum values
        let dbSetName;
        if (set.setNumber === 1) {
          dbSetName = "Set_1";
        } else if (set.setNumber === 2) {
          dbSetName = "Set_2";
        } else if (set.setNumber === 3) {
          dbSetName = "Set_3";
        } else if (set.setNumber === 4) {
          dbSetName = "Set_4";
        } else {
          dbSetName = "Maybe";
        }

        const setlistSet = await prisma.setlistSet.create({
          data: {
            setlistId: setlist.id,
            name: dbSetName,
            order: i + 1, // Set order based on array index
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Find songs that belong to this set
        const setOriginalSongs = songs.filter(
          (song) => song.setNumber === set.setNumber
        );
        const setSongs = [];

        // Match processed songs to original songs by line number
        for (const originalSong of setOriginalSongs) {
          const processedSong = validSongs.find((ps) =>
            processedSongs.find(
              (procSong, idx) =>
                procSong === ps &&
                songs[idx].lineNumber === originalSong.lineNumber
            )
          );
          if (processedSong) {
            setSongs.push(processedSong);
          }
        }

        // Add songs to this set
        for (let j = 0; j < setSongs.length; j++) {
          const song = setSongs[j];
          await prisma.setlistSong.create({
            data: {
              setlistSetId: setlistSet.id,
              songId: song.id,
              order: j + 1, // Order within the set
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
      }

      // Create gig documents for Google Doc imports in bulk processing
      if (
        req.session.quickSetData.isGoogleDocImport &&
        req.session.quickSetData.googleDocData
      ) {
        console.log(
          "Creating gig documents for Google Doc import in bulk processing..."
        );

        for (const originalSong of songs) {
          const processedSong = validSongs.find((ps) =>
            processedSongs.find(
              (procSong, idx) =>
                procSong === ps &&
                songs[idx].lineNumber === originalSong.lineNumber
            )
          );

          if (processedSong && originalSong.processedContent) {
            try {
              // Auto-increment version for Google Doc imports (same logic as individual processing)
              let docVersion = 1;
              const existingDocs = await prisma.gigDocument.findMany({
                where: { songId: processedSong.id, type: "chords" },
                orderBy: { version: "desc" },
                take: 1,
              });
              if (existingDocs.length > 0) {
                docVersion = existingDocs[0].version + 1;
              }

              console.log(
                `Creating gig document for ${processedSong.title} - version ${docVersion}`
              );
              console.log(
                `Content length: ${originalSong.processedContent?.length || 0}`
              );
              console.log(
                `Content preview: ${originalSong.processedContent?.substring(0, 200) || "NO CONTENT"}`
              );

              // Create gig document
              const gigDocument = await prisma.gigDocument.create({
                data: {
                  content: originalSong.processedContent,
                  songId: processedSong.id,
                  type: "chords",
                  version: docVersion,
                  createdById: userId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });

              console.log(
                `Created gig document ${gigDocument.id} for song ${processedSong.title}`
              );

              // Create links from extracted URLs if any
              if (originalSong.urls && originalSong.urls.length > 0) {
                let linksCreated = 0;
                for (const urlInfo of originalSong.urls) {
                  if (
                    urlInfo.type === "font_resource" ||
                    urlInfo.type === "other"
                  ) {
                    continue;
                  }

                  try {
                    const existingLink = await prisma.link.findFirst({
                      where: {
                        songId: processedSong.id,
                        url: urlInfo.url,
                      },
                    });

                    if (!existingLink) {
                      await prisma.link.create({
                        data: {
                          songId: processedSong.id,
                          createdById: req.session.user.id,
                          type: urlInfo.type,
                          description: urlInfo.description || urlInfo.url,
                          url: urlInfo.url,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        },
                      });
                      linksCreated++;
                    }
                  } catch (error) {
                    console.error(`Error creating link: ${error.message}`);
                  }
                }

                console.log(
                  `Created ${linksCreated} links for ${processedSong.title}`
                );
              }
            } catch (error) {
              console.error(
                `Error creating gig document for ${processedSong.title}:`,
                error
              );
              // Don't fail the whole operation if gig document creation fails
            }
          }
        }
      }
    } // End of createSetlist conditional

    // Clear session data
    const isNewList = req.session.quickSetData.isNewList;
    delete req.session.quickSetData;

    if (isNewList && !createSetlist) {
      // New list flow - just adding to band songs
      const newSongsCount = processedSongs.filter((s) => s.isNew).length;
      const existingSongsCount = processedSongs.filter((s) => !s.isNew).length;

      let successMessage = `Successfully added ${processedSongs.length} songs to your band's repertoire`;
      if (newSongsCount > 0) {
        successMessage += ` (${newSongsCount} new songs created)`;
      }
      if (existingSongsCount > 0) {
        successMessage += ` (${existingSongsCount} existing songs added)`;
      }

      req.flash("success", successMessage);
      res.redirect(`/bands/${bandId}`);
    } else {
      // Regular quickset flow - creating setlist
      req.flash("success", `Setlist "${setlistTitle}" created successfully!`);
      res.redirect(`/setlists/${setlist.id}`);
    }
  } catch (error) {
    console.error("Quick set creation error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      bandId: req.params.id,
      userId: req.session?.user?.id,
      setlistTitle: req.body.setlistTitle,
      sessionData: !!req.session.quickSetData,
      errorMessage: error.message,
      errorCode: error.code,
    });

    // Log to application logger if available
    try {
      const logger = require("../utils/logger");
      if (logger && typeof logger.error === "function") {
        logger.error(
          `Quick set creation failed for band ${req.params.id}: ${error.message}`,
          {
            userId: req.session?.user?.id,
            bandId: req.params.id,
            error: error.stack,
          }
        );
      }
    } catch (loggerError) {
      console.error(
        `Quick set creation failed for band ${req.params.id}: ${error.message}`
      );
    }

    req.flash(
      "error",
      "An error occurred creating the setlist. Please try again."
    );
    res.redirect(`/bands/${req.params.id}`);
  }
});

// GET /bands/:id/new-list - Show new list creation page
router.get("/:id/new-list", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    res.render("bands/new-list", {
      title: `Add a List - ${band.name}`,
      pageTitle: "Add a List of Songs For Your Band",
      band,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("New list page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// New Doc routes
router.get("/:id/new-doc", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    res.render("bands/new-doc", {
      pageTitle: "Add Your Google Doc",
      band,
      hasBandHeader: false,
    });
  } catch (error) {
    console.error("New doc page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/new-doc - Process new doc creation
router.post("/:id/new-doc", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { googleDocUrl, listType } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!googleDocUrl) {
      req.flash("error", "Google Doc URL is required");
      return res.redirect(`/bands/${bandId}/new-doc`);
    }

    // Render a page that auto-submits to the existing Google Doc processing route
    res.render("bands/google-doc-redirect", {
      title: "Processing Google Doc...",
      googleDocUrl: googleDocUrl,
      bandId: bandId,
      listType: listType,
    });
  } catch (error) {
    console.error("New doc processing error:", error);
    req.flash("error", "An error occurred processing the Google Doc");
    res.redirect(`/bands/${req.params.id}/new-doc`);
  }
});

// New Song routes
router.get("/:id/songs/new", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    // Get artists for datalist
    const artists = await prisma.artist.findMany({
      orderBy: { name: "asc" },
      take: 100, // Limit for performance
    });

    res.render("bands/songs/new", {
      pageTitle: "Add Your New Single",
      band,
      hasBandHeader: false,
      artists,
    });
  } catch (error) {
    console.error("New song page error:", error);
    req.flash("error", "An error occurred while loading the page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/new-list - Process new list creation
router.post("/:id/new-list", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;
    const { songList, listType } = req.body;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    if (!songList || !songList.trim()) {
      req.flash("error", "Please provide a song list");
      return res.redirect(`/bands/${bandId}/new-list`);
    }

    // Parse the song list
    console.log("Parsing song list...");
    const parseResult = parseQuickSetInput(songList);
    console.log("Parse result:", parseResult);

    if (!parseResult || !parseResult.songs || parseResult.songs.length === 0) {
      console.log("Parse failed: No songs found");
      req.flash(
        "error",
        "No songs found in your list. Please check the format and try again."
      );
      return res.redirect(`/bands/${bandId}/new-list`);
    }

    // Create a temporary setlist if creating a setlist
    let setlistId = null;
    if (listType === "setlist") {
      console.log("Creating temporary setlist...");
      const setlistTitle = parseResult.setlistTitle || "Untitled Setlist";
      console.log("Using setlist title:", setlistTitle);

      const tempSetlist = await prisma.setlist.create({
        data: {
          title: setlistTitle,
          bandId: bandId,
          createdById: userId,
          isFinalized: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      setlistId = tempSetlist.id;
      console.log("Created setlist with ID:", setlistId);
    }

    // Store the data in session using the same structure as quickset
    console.log("Storing session data...");
    req.session.quickSetData = {
      bandId: bandId,
      setlistId: setlistId,
      sets: parseResult.sets,
      songs: parseResult.songs,
      isNewList: true, // Flag to indicate this is from new-list flow
      createSetlist: listType === "setlist",
    };
    console.log("Session data stored:", req.session.quickSetData);

    // Redirect to existing quickset confirmation page
    console.log(`Redirecting to: /bands/${bandId}/quick-set/confirm`);
    res.redirect(`/bands/${bandId}/quick-set/confirm`);
  } catch (error) {
    console.error("New list processing error:", error);
    req.flash("error", "An error occurred while processing your list");
    res.redirect(`/bands/${req.params.id}/new-list`);
  }
});

// GET /bands/:id/quick-set/confirm - Show confirmation page with song matching
router.get("/:id/quick-set/confirm", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check if we have session data
    if (
      !req.session.quickSetData ||
      req.session.quickSetData.bandId !== bandId
    ) {
      req.flash("error", "No setlist data found. Please try again.");
      return res.redirect(`/bands/${bandId}`);
    }

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Band not found or you don't have permission");
      return res.redirect("/bands");
    }

    const { sets, songs, setlistId, isNewList, createSetlist } =
      req.session.quickSetData;

    // Get the created setlist (only if we created one)
    let setlist = null;
    if (setlistId) {
      setlist = await prisma.setlist.findUnique({
        where: { id: setlistId },
      });

      if (!setlist) {
        req.flash("error", "Setlist not found. Please try again.");
        return res.redirect(`/bands/${bandId}`);
      }
    }

    // Debug: Check what songs exist in the database
    const totalSongsInDb = await prisma.song.count();
    console.log(`Total songs in database: ${totalSongsInDb}`);

    // Find song matches for each song
    const songMatches = await Promise.all(
      songs.map(async (song) => {
        const allMatches = await findSongMatches(
          song.title,
          song.artist,
          userId
        );

        console.log(
          `Song: "${song.title}" by "${song.artist}" - Found ${allMatches.length} matches:`,
          allMatches.map((m) => ({
            title: m.title,
            matchType: m.matchType,
            confidence: m.confidence,
          }))
        );

        // Separate exact matches from other matches
        const exactMatches = allMatches.filter(
          (match) => match.matchType === "exact"
        );
        const otherMatches = allMatches.filter(
          (match) => match.matchType !== "exact"
        );

        // Only pre-select if we have a high-confidence match
        let selectedMatch = null;
        let shouldPreferExisting = false;

        if (allMatches.length > 0) {
          const bestMatch = allMatches[0];
          // Pre-select if exact match OR fuzzy match with high confidence (70%+)
          if (bestMatch.matchType === "exact" || bestMatch.confidence >= 0.7) {
            selectedMatch = bestMatch;
            shouldPreferExisting = true;
          }
        }

        return {
          ...song,
          matches: {
            exactMatches: exactMatches,
            otherMatches: otherMatches,
            allMatches: allMatches,
          },
          selectedMatch: selectedMatch,
          shouldPreferExisting: shouldPreferExisting, // Flag for frontend
          needsCreation: allMatches.length === 0,
        };
      })
    );

    // Get current user's permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { canMakePrivate: true },
    });

    // Calculate summary stats
    const matchedSongs = songMatches.filter(
      (s) => s.matches.exactMatches.length > 0
    ).length;
    const likelyNewSongs = songMatches.length - matchedSongs;

    res.render("bands/quick-set-confirm", {
      title: req.session.quickSetData.isNewList
        ? `Confirm List - ${band.name}`
        : `Confirm Setlist - ${band.name}`,
      band,
      hasBandHeader: true,
      setlist,
      sets,
      songMatches,
      totalSongs: songs.length,
      matchedSongs,
      likelyNewSongs,
      googleDocData: req.session.quickSetData.googleDocData || null,
      isGoogleDocImport: req.session.quickSetData.isGoogleDocImport || false,
      isNewList: req.session.quickSetData.isNewList || false,
      createSetlist: req.session.quickSetData.createSetlist !== false, // Default to true for existing quickset flow
      currentUser,
    });
  } catch (error) {
    console.error("Quick set confirm error:", error);
    req.flash("error", "An error occurred loading the confirmation page");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/google-doc-to-quickset - Process Google Doc and convert to quickset
router.post("/:id/google-doc-to-quickset", async (req, res) => {
  try {
    const bandId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check band membership
    const band = await prisma.band.findFirst({
      where: {
        id: bandId,
        members: {
          some: { userId: userId },
        },
      },
    });

    if (!band) {
      req.flash("error", "Access denied");
      return res.redirect(`/bands/${bandId}`);
    }

    // Get Google Doc data from session (from the redirect) or from request body (direct submission)
    let parsedData;
    if (req.session.googleDocData) {
      // Data from session (redirected from Google Doc processing)
      parsedData = req.session.googleDocData;
      // Clear the session data after use
      delete req.session.googleDocData;
    } else {
      // Direct submission from frontend (fallback)
      const { googleDocData } = req.body;
      try {
        parsedData =
          typeof googleDocData === "string"
            ? JSON.parse(googleDocData)
            : googleDocData;
      } catch (error) {
        console.error("Error parsing Google Doc data:", error);
        req.flash("error", "Invalid Google Doc data");
        return res.redirect(`/bands/${bandId}`);
      }
    }

    // Import the sophisticated HTML processor
    const { processGoogleDocHtml } = require("../utils/googleDocHtmlProcessor");

    // Process each extracted song with the sophisticated HTML processor
    const processedSongs = parsedData.extractedSongs.map((song, index) => {
      console.log(`=== Processing song ${index + 1}: ${song.title} ===`);
      console.log(`- Has fullContent: ${!!song.fullContent}`);
      console.log(
        `- fullContent length: ${song.fullContent?.length || "undefined"}`
      );
      console.log(
        `- contentPreview length: ${song.contentPreview?.length || "undefined"}`
      );
      console.log(`- contentLength: ${song.contentLength}`);

      // Process the HTML content to make it TinyMCE compatible
      const contentToProcess =
        song.fullContent || song.contentPreview.replace(/\.\.\.$/, "");
      console.log(
        `- Content being sent to HTML processor: ${contentToProcess?.length || "undefined"} characters`
      );
      console.log(
        `- Content preview: ${contentToProcess?.substring(0, 100) || "NO CONTENT"}`
      );

      const { content: processedContent, urls } =
        processGoogleDocHtml(contentToProcess);

      return {
        lineNumber: index + 1,
        title: song.title,
        artist: "", // Will be filled in during matching
        originalContent: song.contentPreview, // Keep original for display
        processedContent: processedContent, // TinyMCE-compatible content
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: urls, // Extracted URLs for link creation
      };
    });

    // Create a quickset-compatible structure from Google Doc data
    const quicksetData = {
      sets: [
        {
          name: "Set_1", // Use the actual database set name
          songs: processedSongs.map((song) => ({
            lineNumber: song.lineNumber,
            title: song.title,
            artist: song.artist,
            originalContent: song.originalContent,
            processedContent: song.processedContent,
            contentLength: song.contentLength,
            originalIndex: song.originalIndex,
            urls: song.urls,
          })),
        },
      ],
      songs: processedSongs.map((song) => ({
        lineNumber: song.lineNumber,
        title: song.title,
        artist: song.artist,
        originalContent: song.originalContent,
        processedContent: song.processedContent,
        contentLength: song.contentLength,
        originalIndex: song.originalIndex,
        urls: song.urls,
      })),
    };

    // Create a temporary setlist for the quickset workflow
    // Use the Google Doc title if available, otherwise fall back to default
    console.log("Parsed data for setlist title:", {
      hasDocumentTitle: !!parsedData.documentTitle,
      documentTitle: parsedData.documentTitle,
      hasSetlistTitle: !!parsedData.setlistTitle,
      setlistTitle: parsedData.setlistTitle,
      dataKeys: Object.keys(parsedData),
    });

    // Priority: 1) Detected setlist title, 2) Google Doc title, 3) Default
    let titleToUse = null;
    if (parsedData.setlistTitle) {
      titleToUse = parsedData.setlistTitle;
    } else if (parsedData.documentTitle) {
      titleToUse = `${parsedData.documentTitle} - ${new Date().toLocaleDateString()}`;
    } else {
      titleToUse = `Google Doc Import - ${new Date().toLocaleDateString()}`;
    }

    const setlistTitle = titleToUse;

    console.log("Final setlist title:", setlistTitle);

    const setlist = await prisma.setlist.create({
      data: {
        title: setlistTitle,
        date: new Date(),
        bandId: bandId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create a default set for the Google Doc songs
    await prisma.setlistSet.create({
      data: {
        setlistId: setlist.id,
        name: "Set_1", // Default to Set 1
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Store the Google Doc data in session for quickset confirmation
    req.session.quickSetData = {
      bandId: bandId,
      setlistId: setlist.id,
      sets: quicksetData.sets,
      songs: quicksetData.songs,
      googleDocData: parsedData, // Store original Google Doc data
      isGoogleDocImport: true, // Flag to indicate this is from Google Doc
    };

    // Redirect to quickset confirmation page
    res.redirect(`/bands/${bandId}/quick-set/confirm`);
  } catch (error) {
    console.error("Google Doc to quickset error:", error);
    req.flash("error", "An error occurred processing the Google Doc");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// Helper function to extract keywords from song titles
function getKeywords(title) {
  const stopWords = [
    "the",
    "a",
    "an",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "and",
    "or",
    "but",
    "my",
    "your",
    "his",
    "her",
    "its",
    "our",
    "their",
  ];
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.includes(word));
}

// Function to find keyword-based matches
function findKeywordMatches(searchTitle, searchArtist, allSongs) {
  const searchKeywords = getKeywords(searchTitle);
  if (searchKeywords.length === 0) return [];

  const keywordMatches = allSongs
    .map((song) => {
      const songKeywords = getKeywords(song.title);

      // Find intersecting keywords
      const intersection = searchKeywords.filter((keyword) =>
        songKeywords.some(
          (songKeyword) =>
            // Exact match or one contains the other (for roses/rose)
            keyword === songKeyword ||
            keyword.includes(songKeyword) ||
            songKeyword.includes(keyword)
        )
      );

      // Calculate keyword overlap percentage
      const overlapPercentage =
        intersection.length /
        Math.max(searchKeywords.length, songKeywords.length);

      // Boost score if artist also matches
      let artistBoost = 0;
      if (searchArtist && song.artists && song.artists.length > 0) {
        const searchArtistKeywords = getKeywords(searchArtist);
        const songArtistKeywords = getKeywords(song.artists[0].artist.name);
        const artistIntersection = searchArtistKeywords.filter((keyword) =>
          songArtistKeywords.some(
            (artistKeyword) =>
              keyword === artistKeyword ||
              keyword.includes(artistKeyword) ||
              artistKeyword.includes(keyword)
          )
        );
        if (artistIntersection.length > 0) {
          artistBoost = 0.2; // 20% boost for artist match
        }
      }

      const finalScore = overlapPercentage + artistBoost;

      return {
        ...song,
        matchType: "keyword",
        confidence: finalScore,
        matchedKeywords: intersection,
      };
    })
    .filter((song) => song.confidence >= 0.15) // At least 15% keyword overlap
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5); // Top 5 matches

  return keywordMatches;
}

// Function to calculate string similarity (Levenshtein-based)
function calculateSimilarity(str1, str2) {
  // Normalize strings: lowercase, trim
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0; // Perfect match

  // Levenshtein distance calculation
  const matrix = [];
  const len1 = s1.length;
  const len2 = s2.length;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  const distance = matrix[len2][len1];
  const maxLength = Math.max(len1, len2);

  // Convert to similarity percentage (0-1)
  return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
}

// Function to find song matches using JavaScript-based fuzzy matching
async function findSongMatches(title, artist = "", userId = null) {
  try {
    // First try exact matches
    let exactMatches = [];

    if (artist) {
      // Look for exact title + artist match
      exactMatches = await prisma.song.findMany({
        where: {
          title: { equals: title, mode: "insensitive" },
          artists: {
            some: {
              artist: {
                name: { equals: artist, mode: "insensitive" },
              },
            },
          },
          // Add private filtering
          OR: [
            { private: false }, // Show all public songs
            { private: true, createdById: userId }, // Show private songs only if user owns them
          ],
        },
        include: {
          artists: {
            include: { artist: true },
          },
          vocalist: true,
          creator: true,
        },
        take: 5,
      });
    } else {
      // Look for exact title match (no artist specified)
      exactMatches = await prisma.song.findMany({
        where: {
          title: { equals: title, mode: "insensitive" },
          // Add private filtering
          OR: [
            { private: false }, // Show all public songs
            { private: true, createdById: userId }, // Show private songs only if user owns them
          ],
        },
        include: {
          artists: {
            include: { artist: true },
          },
          vocalist: true,
          creator: true,
        },
        take: 5,
      });
    }

    // Convert exact matches to the standard format
    const formattedExactMatches = exactMatches.map((song) => ({
      ...song,
      matchType: "exact",
      confidence: 1.0,
    }));

    // Always get additional songs for keyword and fuzzy matching
    const allSongs = await prisma.song.findMany({
      where: {
        // Add private filtering
        OR: [
          { private: false }, // Show all public songs
          { private: true, createdById: userId }, // Show private songs only if user owns them
        ],
      },
      include: {
        artists: {
          include: { artist: true },
        },
        vocalist: true,
        creator: true,
      },
      take: 1000, // Limit to avoid performance issues
    });

    let allMatches = [...formattedExactMatches];

    if (allSongs.length > 0) {
      // Get keyword matches (but exclude songs we already have as exact matches)
      const exactMatchIds = formattedExactMatches.map((match) => match.id);
      const songsForKeywordMatching = allSongs.filter(
        (song) => !exactMatchIds.includes(song.id)
      );

      const keywordMatches = findKeywordMatches(
        title,
        artist,
        songsForKeywordMatching
      );
      allMatches = [...allMatches, ...keywordMatches];
    }

    // Add fuzzy matches if we don't have enough suggestions yet
    if (allMatches.length < 5 && allSongs.length > 0) {
      // Get existing match IDs to avoid duplicates
      const existingMatchIds = allMatches.map((match) => match.id);
      const songsForFuzzyMatching = allSongs.filter(
        (song) => !existingMatchIds.includes(song.id)
      );

      // Calculate similarity scores using JavaScript
      const scoredSongs = songsForFuzzyMatching.map((song) => {
        const titleSimilarity = calculateSimilarity(title, song.title);

        // If artist was provided, factor it into the score
        let artistSimilarity = 0;
        if (artist && song.artists && song.artists.length > 0) {
          artistSimilarity = Math.max(
            ...song.artists.map((sa) =>
              calculateSimilarity(artist, sa.artist.name)
            )
          );
        }

        // Combined score: title is more important (70%) than artist (30%)
        const combinedScore = artist
          ? titleSimilarity * 0.7 + artistSimilarity * 0.3
          : titleSimilarity;

        return {
          ...song,
          matchType: "fuzzy",
          confidence: combinedScore,
        };
      });

      // Filter and sort by similarity score
      const fuzzyMatches = scoredSongs
        .filter((song) => song.confidence > 0.3) // 30% similarity threshold
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5 - allMatches.length); // Fill remaining slots

      allMatches = [...allMatches, ...fuzzyMatches];
    }

    // Sort all matches by confidence (exact matches will be first due to 1.0 confidence)
    const finalMatches = allMatches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Maximum 5 suggestions

    return finalMatches;
  } catch (error) {
    console.error("Error finding song matches:", error);
    return [];
  }
}

// Helper function to convert Roman numerals to numbers
function romanToNumber(roman) {
  const romanNumerals = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
  };
  return romanNumerals[roman.toUpperCase()] || null;
}

// Function to parse blank-line-separated format (no set headers)
function parseBlankLineSeparatedFormat(input) {
  const result = {
    sets: [],
    songs: [],
    errors: [],
    setlistTitle: null, // Add setlist title field
  };

  // Check if first line is followed by two line breaks (indicating it's a title)
  // Normalize line endings first (handle both \r\n and \n)
  const normalizedInput = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalizedInput.trim().split("\n");
  let startIndex = 0;

  console.log("=== BLANK LINE PARSING DEBUG ===");
  console.log("Total lines:", lines.length);
  console.log("Line 0:", JSON.stringify(lines[0]));
  console.log("Line 1:", JSON.stringify(lines[1]));
  console.log("Line 2:", JSON.stringify(lines[2]));

  if (lines.length >= 3 && lines[1].trim() === "" && lines[2].trim() !== "") {
    // First line is title, followed by one blank line, then first song
    result.setlistTitle = lines[0].trim();
    startIndex = 2; // Skip title and one blank line
    console.log(`Detected setlist title: "${result.setlistTitle}"`);
  } else {
    console.log("No setlist title detected - conditions not met");
  }

  // Split remaining input into groups separated by blank lines
  const remainingInput = lines.slice(startIndex).join("\n");
  const groups = remainingInput.trim().split(/\n\s*\n/);
  let lineNumber = startIndex;

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex].trim();
    if (!group) continue;

    const setNumber = groupIndex + 1;
    const setName = setNumber <= 4 ? `Set ${setNumber}` : "Maybe";

    const currentSet = {
      name: setName,
      setNumber: setNumber <= 4 ? setNumber : 999,
      songs: [],
    };

    // Parse songs in this group
    const songLines = group
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    for (const songLine of songLines) {
      lineNumber++;

      // Parse song line - format: "Song Title, Artist" or just "Song Title"
      const parts = songLine.split(",").map((part) => part.trim());

      if (parts.length > 2) {
        result.errors.push(
          `Line ${lineNumber}: Too many commas. Format should be "Song Title, Artist" or just "Song Title"`
        );
        continue;
      }

      if (parts[0] === "") {
        result.errors.push(`Line ${lineNumber}: Empty song title`);
        continue;
      }

      // Trim '>' and '->' from song titles (common in jam band setlists)
      let songTitle = parts[0].trim();
      if (songTitle.endsWith("->")) {
        songTitle = songTitle.slice(0, -2).trim();
      } else if (songTitle.endsWith(">")) {
        songTitle = songTitle.slice(0, -1).trim();
      }

      const song = {
        title: songTitle,
        artist: parts.length > 1 ? parts[1] : "",
        setNumber: currentSet.setNumber,
        lineNumber: lineNumber,
      };

      currentSet.songs.push(song);
      result.songs.push(song);
    }

    if (currentSet.songs.length > 0) {
      result.sets.push(currentSet);
    }
  }

  return result;
}

// Function to parse quick set input
function parseQuickSetInput(input) {
  // First, split the input into raw lines (including empty ones)
  const rawLines = input.trim().split("\n");

  // Check if this looks like a blank-line-separated format
  const hasSetHeaders = rawLines.some((line) => {
    const trimmed = line.trim();
    return (
      /^Set\s+(\d+|[IVX]+)[\s:]*$/i.test(trimmed) ||
      /^Encore[\s:]*$/i.test(trimmed) ||
      /^E[\s:]*$/i.test(trimmed)
    );
  });

  // If no set headers found, use blank-line-separated format
  if (!hasSetHeaders) {
    const blankLineResult = parseBlankLineSeparatedFormat(input);

    // Check if we detected a setlist title in the blank-line format
    if (blankLineResult.setlistTitle) {
      console.log(
        `Detected setlist title from blank-line format: "${blankLineResult.setlistTitle}"`
      );
      // Add the setlist title to the main result
      blankLineResult.setlistTitle = blankLineResult.setlistTitle;
    }

    return blankLineResult;
  }

  // Otherwise, use the existing header-based format
  const lines = rawLines.map((line) => line.trim()).filter((line) => line);

  const result = {
    sets: [],
    songs: [],
    errors: [],
    setlistTitle: null, // Add setlist title field
  };

  let currentSet = null;
  let useColonFormat = true; // Default to colon format
  let setCounter = 0; // Track how many sets we've created

  // Check first line to determine format
  if (lines.length > 0) {
    const firstLine = lines[0];
    const colonFormat =
      /^Set\s+(\d+|[IVX]+):\s*$/i.test(firstLine) ||
      /^Encore:\s*$/i.test(firstLine) ||
      /^E:\s*$/i.test(firstLine);
    const noColonFormat =
      /^Set\s+(\d+|[IVX]+)\s*$/i.test(firstLine) ||
      /^Encore\s*$/i.test(firstLine) ||
      /^E\s*$/i.test(firstLine);

    if (noColonFormat && !colonFormat) {
      useColonFormat = false;
    }
  }

  // Check if first line is a setlist title (followed by two blank lines in original input)
  const originalLines = input.trim().split("\n");
  if (
    originalLines.length >= 3 &&
    originalLines[1].trim() === "" &&
    originalLines[2].trim() === "" &&
    !/^Set\s+(\d+|[IVX]+)[\s:]*$/i.test(originalLines[0]) &&
    !/^Encore[\s:]*$/i.test(originalLines[0]) &&
    !/^E[\s:]*$/i.test(originalLines[0])
  ) {
    result.setlistTitle = originalLines[0].trim();
    console.log(
      `Detected setlist title from header format: "${result.setlistTitle}"`
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let setMatch = null;
    let setNumber = null;
    let setName = line;

    // Always check for both colon and no-colon formats
    // Check for set headers with colon first
    setMatch = line.match(/^Set\s+(\d+|[IVX]+):\s*$/i);
    if (!setMatch) {
      setMatch = line.match(/^Encore:\s*$/i);
      if (setMatch) {
        setNumber = Math.min(setCounter + 1, 4); // Encore becomes next available set (max 4)
      }
    }
    if (!setMatch) {
      setMatch = line.match(/^E:\s*$/i);
      if (setMatch) {
        setNumber = Math.min(setCounter + 1, 4); // E: becomes next available set (max 4)
      }
    }

    // If no colon format matched, try no-colon format
    if (!setMatch) {
      setMatch = line.match(/^Set\s+(\d+|[IVX]+)\s*$/i);
      if (!setMatch) {
        setMatch = line.match(/^Encore\s*$/i);
        if (setMatch) {
          setNumber = Math.min(setCounter + 1, 4); // Encore becomes next available set (max 4)
        }
      }
      if (!setMatch) {
        setMatch = line.match(/^E\s*$/i);
        if (setMatch) {
          setNumber = Math.min(setCounter + 1, 4); // E becomes next available set (max 4)
        }
      }
    }

    if (setMatch) {
      // Parse set number
      if (setNumber === null) {
        const setIdentifier = setMatch[1];
        if (/^\d+$/.test(setIdentifier)) {
          // Regular number
          setNumber = parseInt(setIdentifier);
        } else {
          // Roman numeral
          setNumber = romanToNumber(setIdentifier);
        }
      }

      // Handle set limits: max 4 numbered sets, everything else goes to MAYBE
      if (setNumber && setNumber <= 4) {
        setCounter = Math.max(setCounter, setNumber);
        currentSet = {
          name: setName,
          setNumber: setNumber,
          songs: [],
        };
      } else {
        // Beyond 4 sets goes to Maybe
        currentSet = {
          name: "Maybe",
          setNumber: 999, // Special number for Maybe set
          songs: [],
        };
      }

      // Check if we already have this set
      const existingSet = result.sets.find(
        (s) => s.setNumber === currentSet.setNumber
      );
      if (!existingSet) {
        result.sets.push(currentSet);
      } else {
        currentSet = existingSet; // Use existing set
      }
      continue;
    }

    // If we don't have a current set, create a default one
    if (!currentSet) {
      currentSet = {
        name: "Set 1",
        setNumber: 1,
        songs: [],
      };
      result.sets.push(currentSet);
    }

    // Parse song line - format: "Song Title, Artist" or just "Song Title"
    const parts = line.split(",").map((part) => part.trim());

    if (parts.length > 2) {
      result.errors.push(
        `Line ${i + 1}: Too many commas. Format should be "Song Title, Artist" or just "Song Title"`
      );
      continue;
    }

    if (parts[0] === "") {
      result.errors.push(`Line ${i + 1}: Empty song title`);
      continue;
    }

    // Trim '>' and '->' from song titles (common in jam band setlists)
    // Example: "The Music Never Stopped >" or "The Music Never Stopped ->" becomes "The Music Never Stopped"
    let songTitle = parts[0].trim();
    if (songTitle.endsWith("->")) {
      songTitle = songTitle.slice(0, -2).trim(); // Remove '->' and trim again
    } else if (songTitle.endsWith(">")) {
      songTitle = songTitle.slice(0, -1).trim(); // Remove '>' and trim again
    }

    const song = {
      title: songTitle,
      artist: parts.length > 1 ? parts[1] : "",
      setNumber: currentSet.setNumber,
      lineNumber: i + 1,
    };

    currentSet.songs.push(song);
    result.songs.push(song);
  }

  if (result.songs.length === 0) {
    result.errors.push("No songs found. Please enter at least one song.");
  }

  // Handle duplicate song titles by adding "Reprise" to subsequent occurrences
  const songTitleCounts = {};

  result.songs.forEach((song) => {
    const normalizedTitle = song.title.toLowerCase().trim();

    if (songTitleCounts[normalizedTitle]) {
      // This is a duplicate - add "Reprise" to the title
      song.title = `${song.title} Reprise`;
      songTitleCounts[normalizedTitle]++;
    } else {
      // First occurrence - just track it
      songTitleCounts[normalizedTitle] = 1;
    }
  });

  return result;
}

// GET /bands/:id/venues - Show band's venues
router.get("/:id/venues", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get band details
    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Get band's venues
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
            contacts: {
              include: {
                contactType: true,
              },
            },
            socials: {
              include: {
                socialType: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.render("bands/venues", {
      pageTitle: "Let's Get Gigging",
      band,
      hasBandHeader: false,
      bandVenues,
    });
  } catch (error) {
    logger.logError("Band venues error:", error);
    req.flash("error", "An error occurred loading band venues");
    res.redirect("/bands");
  }
});

// GET /bands/:id/venue-picker - Show band's venue picker
router.get("/:id/venue-picker", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    const band = await prisma.band.findUnique({
      where: { id: parseInt(bandId) },
    });

    // Get all venues
    const allVenues = await prisma.venue.findMany({
      include: {
        venueType: true,
      },
      orderBy: { name: "asc" },
    });

    // Get band's current venues
    const bandVenues = await prisma.bandVenue.findMany({
      where: { bandId: parseInt(bandId) },
      include: {
        venue: {
          include: {
            venueType: true,
          },
        },
      },
    });

    const bandVenueIds = bandVenues.map((bv) => bv.venueId);

    res.render("bands/venue-picker", {
      pageTitle: "Venue Picker",
      band,
      hasBandHeader: false,
      allVenues,
      bandVenueIds,
    });
  } catch (error) {
    logger.logError("Band venue picker error:", error);
    req.flash("error", "An error occurred loading band venues");
    res.redirect(`/bands/${req.params.id}`);
  }
});

// POST /bands/:id/venues/:venueId - Add venue to band
router.post("/:id/venues/:venueId", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already added
    const existing = await prisma.bandVenue.findFirst({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    if (existing) {
      return res.status(400).json({ error: "Venue already in band" });
    }

    await prisma.bandVenue.create({
      data: {
        bandId: parseInt(bandId),
        venueId: parseInt(venueId),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Add band venue error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /bands/:id/venues/:venueId - Remove venue from band
router.delete("/:id/venues/:venueId", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandVenue.deleteMany({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band venue error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /bands/:id/venues/:venueId/remove - Workaround for DELETE requests
router.post("/:id/venues/:venueId/remove", async (req, res) => {
  try {
    const { id: bandId, venueId } = req.params;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await prisma.bandMember.findFirst({
      where: { bandId: parseInt(bandId), userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.bandVenue.deleteMany({
      where: { bandId: parseInt(bandId), venueId: parseInt(venueId) },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Remove band venue error (POST):", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
