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
          },
        },
      },
      orderBy: {
        song: {
          title: "asc",
        },
      },
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
      band,
      setlists,
      bandSongs,
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
      title: `${band.name} - Songs`,
      band,
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
      const parseResult = parseQuickSetInput(songList);

      if (parseResult.errors.length > 0) {
        req.flash("error", parseResult.errors.join(", "));
        return res.redirect(`/bands/${bandId}`);
      }

      // Create setlist immediately with auto-generated name
      const currentDate = new Date();
      const defaultTitle = `Quick Set - ${currentDate.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      )}`;

      const setlist = await prisma.setlist.create({
        data: {
          title: defaultTitle,
          bandId: bandId,
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

      // Check if song already exists
      let existingSong = null;
      if (artistId) {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { some: { artistId: artistId } },
          },
        });
      } else {
        existingSong = await prisma.song.findFirst({
          where: {
            title: { equals: finalTitle.trim(), mode: "insensitive" },
            artists: { none: {} },
          },
        });
      }

      // Use existing song if found, otherwise create new one
      processedSong =
        existingSong ||
        (await prisma.song.create({
          data: {
            title: finalTitle,
            createdById: userId,
            private: false,
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

    if (setData) {
      const setName =
        setData.name === "Set 1"
          ? "Set_1"
          : setData.name === "Set 2"
            ? "Set_2"
            : setData.name === "Set 3"
              ? "Set_3"
              : setData.name === "Set 4"
                ? "Set_4"
                : setData.name === "Encore"
                  ? "Set_3"
                  : "Maybe";

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

          // Use existing song if found, otherwise create new one
          const newSong =
            existingSong ||
            (await prisma.song.create({
              data: {
                title: finalTitle,
                createdById: userId,
                private: false, // Quick set songs are not private by default
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
          }

          return existingSong;
        }

        return null;
      })
    );

    // Filter out any null songs
    const validSongs = processedSongs.filter((song) => song !== null);

    // Create the setlist
    const setlist = await prisma.setlist.create({
      data: {
        title: setlistTitle,
        date: setlistDate ? new Date(setlistDate) : new Date(),
        bandId: bandId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create sets and add songs
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

    // Clear session data
    delete req.session.quickSetData;

    req.flash("success", `Setlist "${setlistTitle}" created successfully!`);
    res.redirect(`/setlists/${setlist.id}`);
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
    const logger = require("../utils/logger");
    logger.error(
      `Quick set creation failed for band ${req.params.id}: ${error.message}`,
      {
        userId: req.session?.user?.id,
        bandId: req.params.id,
        error: error.stack,
      }
    );

    req.flash(
      "error",
      "An error occurred creating the setlist. Please try again."
    );
    res.redirect(`/bands/${req.params.id}`);
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

    const { sets, songs, setlistId } = req.session.quickSetData;

    // Get the created setlist
    const setlist = await prisma.setlist.findUnique({
      where: { id: setlistId },
    });

    if (!setlist) {
      req.flash("error", "Setlist not found. Please try again.");
      return res.redirect(`/bands/${bandId}`);
    }

    // Find song matches for each song
    const songMatches = await Promise.all(
      songs.map(async (song) => {
        const matches = await findSongMatches(song.title, song.artist);

        // Only pre-select if we have a high-confidence match
        let selectedMatch = null;
        let shouldPreferExisting = false;

        if (matches.length > 0) {
          const bestMatch = matches[0];
          // Pre-select if exact match OR fuzzy match with high confidence (70%+)
          if (bestMatch.matchType === "exact" || bestMatch.confidence >= 0.7) {
            selectedMatch = bestMatch;
            shouldPreferExisting = true;
          }
        }

        return {
          ...song,
          matches: matches,
          selectedMatch: selectedMatch,
          shouldPreferExisting: shouldPreferExisting, // Flag for frontend
          needsCreation: matches.length === 0,
        };
      })
    );

    res.render("bands/quick-set-confirm", {
      title: `Confirm Setlist - ${band.name}`,
      band,
      setlist,
      sets,
      songMatches,
      totalSongs: songs.length,
    });
  } catch (error) {
    console.error("Quick set confirm error:", error);
    req.flash("error", "An error occurred loading the confirmation page");
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
async function findSongMatches(title, artist = "") {
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
  };

  // Split input into groups separated by blank lines
  const groups = input.trim().split(/\n\s*\n/);
  let lineNumber = 0;

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
    return parseBlankLineSeparatedFormat(input);
  }

  // Otherwise, use the existing header-based format
  const lines = rawLines.map((line) => line.trim()).filter((line) => line);

  const result = {
    sets: [],
    songs: [],
    errors: [],
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

module.exports = router;
