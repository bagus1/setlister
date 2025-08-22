const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  User,
  Band,
  BandMember,
  Song,
  BandSong,
  Setlist,
  SetlistSet,
  BandInvitation,
  Artist,
  Vocalist,
  Link,
  GigDocument,
} = require("../models");
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
    const bands = await Band.findAll({
      include: [
        {
          model: User,
          where: { id: userId },
          through: { attributes: ["role"] },
        },
      ],
      order: [["name", "ASC"]],
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

      // Create band
      const band = await Band.create({
        name,
        description,
        createdById: userId,
      });

      // Add creator as owner
      await BandMember.create({
        bandId: band.id,
        userId,
        role: "owner",
      });

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

    const band = await Band.findByPk(bandId, {
      include: [
        {
          model: User,
          through: { attributes: ["role"] },
        },
      ],
    });

    if (!band) {
      req.flash("error", "Band not found");
      return res.redirect("/bands");
    }

    // Check if user is a member
    const isMember = band.Users.some((user) => user.id === userId);
    if (!isMember) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    // Get setlists
    const setlists = await Setlist.findAll({
      where: { bandId },
      order: [["updatedAt", "DESC"]],
    });

    // Get band songs - simplified query to avoid complex includes
    const bandSongs = await BandSong.findAll({
      where: { bandId },
      include: [
        {
          model: Song,
          include: [
            { model: Artist, through: { attributes: [] } },
            { model: Vocalist },
          ],
        },
      ],
      order: [[Song, "title", "ASC"]],
    });

    // Get pending invitations (not used, not expired)
    let pendingInvitations = [];
    try {
      pendingInvitations = await BandInvitation.findAll({
        where: {
          bandId,
          usedAt: null,
          expiresAt: { [require("sequelize").Op.gt]: new Date() },
        },
        include: [
          {
            model: User,
            as: "Inviter",
            attributes: ["username"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } catch (associationError) {
      console.error(
        `[${new Date().toISOString()}] Association error, falling back to basic query:`,
        associationError
      );
      // Fallback: get invitations without the association
      pendingInvitations = await BandInvitation.findAll({
        where: {
          bandId,
          usedAt: null,
          expiresAt: { [require("sequelize").Op.gt]: new Date() },
        },
        order: [["createdAt", "DESC"]],
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
      const membership = await BandMember.findOne({
        where: { bandId, userId },
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

      // Create setlist
      const setlist = await Setlist.create({
        title,
        bandId,
        date: date || null,
      });

      // Create default sets
      const setNames = ["Set 1", "Set 2", "Set 3", "Set 4", "Maybe"];
      for (let i = 0; i < setNames.length; i++) {
        await SetlistSet.create({
          setlistId: setlist.id,
          name: setNames[i],
          order: i,
        });
      }

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
      const membership = await BandMember.findOne({
        where: { bandId, userId, role: "owner" },
      });

      if (!membership) {
        req.flash("error", "Only band owners can invite members");
        return res.redirect(`/bands/${bandId}`);
      }

      // Get band details
      const band = await Band.findByPk(bandId);
      if (!band) {
        req.flash("error", "Band not found");
        return res.redirect("/bands");
      }

      // Check if user already exists and handle accordingly
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        const existingMembership = await BandMember.findOne({
          where: { bandId, userId: existingUser.id },
        });

        if (existingMembership) {
          req.flash("error", "This person is already a member of the band");
          return res.redirect(`/bands/${bandId}`);
        }

        // User exists but is not a member of this band - add them automatically
        await BandMember.create({
          bandId,
          userId: existingUser.id,
          role: "member",
        });

        // Get inviter name
        const inviter = await User.findByPk(userId);

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
      const existingInvitation = await BandInvitation.findOne({
        where: {
          bandId,
          email,
          usedAt: null,
          expiresAt: { [require("sequelize").Op.gt]: new Date() },
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
      const invitation = await BandInvitation.create({
        bandId,
        email,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedBy: userId,
      });

      // Get inviter name
      const inviter = await User.findByPk(userId);

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

// GET /bands/:id/instant-set - Show instant set creation form
router.get("/:id/instant-set", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Verify user has access to this band
    const band = await Band.findByPk(bandId, {
      include: [
        {
          model: User,
          where: { id: userId },
          through: { attributes: ["role"] },
        },
      ],
    });

    if (!band) {
      req.flash("error", "Band not found or access denied");
      return res.redirect("/bands");
    }

    res.render("bands/instant-set", {
      title: `Instant Set - ${band.name}`,
      band,
    });
  } catch (error) {
    console.error("Instant set form error:", error);
    req.flash("error", "An error occurred loading the instant set form");
    res.redirect("/bands");
  }
});

// POST /bands/:id/instant-set - Process instant set and show confirmation
router.post("/:id/instant-set", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;
    const { songList, setlistTitle, setlistDate } = req.body;

    // Verify user has access to this band
    const band = await Band.findByPk(bandId, {
      include: [
        {
          model: User,
          where: { id: userId },
          through: { attributes: ["role"] },
        },
      ],
    });

    if (!band) {
      req.flash("error", "Band not found or access denied");
      return res.redirect("/bands");
    }

    // Parse the song list
    const {
      parseSongList,
      findSongMatches,
      titleize,
    } = require("../utils/songParser");
    const parsedResult = parseSongList(songList);

    // Find matches for each song
    const processedSets = [];
    for (const set of parsedResult.sets) {
      const processedSongs = [];
      for (const song of set.songs) {
        const matchResult = await findSongMatches(song);
        processedSongs.push({
          ...song,
          ...matchResult,
        });
      }
      processedSets.push({
        ...set,
        songs: processedSongs,
      });
    }

    res.render("bands/instant-set-confirm", {
      title: `Confirm Instant Set - ${band.name}`,
      band,
      setlistTitle,
      setlistDate,
      sets: processedSets,
      songList, // Pass original input for form resubmission if needed
      titleize, // Pass the titleize function to the template
    });
  } catch (error) {
    console.error("Instant set processing error:", error);
    req.flash("error", "An error occurred processing your song list");
    res.redirect(`/bands/${req.params.id}/instant-set`);
  }
});

// POST /bands/:id/instant-set/create - Create the setlist from confirmed songs
router.post("/:id/instant-set/create", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;
    const { setlistTitle, setlistDate } = req.body;

    // Verify user has access to this band
    const band = await Band.findByPk(bandId, {
      include: [
        {
          model: User,
          where: { id: userId },
          through: { attributes: ["role"] },
        },
      ],
    });

    if (!band) {
      req.flash("error", "Band not found or access denied");
      return res.redirect("/bands");
    }

    // Get the confirmed songs from the form
    const songs = req.body.songs || [];

    console.log("Received songs data:", JSON.stringify(songs, null, 2));
    console.log("Songs array length:", songs.length);

    // Flatten the nested array structure (sets within sets)
    const flattenedSongs = [];
    for (const set of songs) {
      if (Array.isArray(set)) {
        flattenedSongs.push(...set);
      } else {
        flattenedSongs.push(set);
      }
    }

    console.log("Flattened songs:", JSON.stringify(flattenedSongs, null, 2));
    console.log("Flattened songs length:", flattenedSongs.length);

    // Process each song
    const {
      Song,
      BandSong,
      Setlist,
      SetlistSet,
      SetlistSong,
      Artist,
    } = require("../models");
    const processedSongs = [];
    const newSongs = [];

    for (const songData of flattenedSongs) {
      console.log("Processing song data:", songData);

      // Handle cases where fields might be arrays (take first value)
      const action = Array.isArray(songData.action)
        ? songData.action[0]
        : songData.action;
      const title = songData.title || songData.manualTitle;
      const artist = songData.artist || songData.manualArtist;
      const songId = songData.songId;
      const setName = Array.isArray(songData.setName)
        ? songData.setName[0]
        : songData.setName;
      const order = Array.isArray(songData.order)
        ? songData.order[0]
        : songData.order;

      console.log(`Raw songData.songId: ${JSON.stringify(songData.songId)}`);
      console.log(`Extracted songId: ${songId}`);
      console.log(`songId type: ${typeof songId}, truthy: ${!!songId}`);

      console.log("Extracted fields:", {
        action,
        title,
        artist,
        songId,
        setName,
        order,
      });

      // First check if we should use an existing song (if songId is provided)
      console.log(
        `Checking if we should use existing song: songId=${songId}, action=${JSON.stringify(action)}, original action=${JSON.stringify(songData.action)}`
      );
      if (
        songId &&
        (action === "use" ||
          (Array.isArray(songData.action) && songData.action.includes("use")))
      ) {
        console.log(`Using existing song with ID: ${songId}`);
        // Get existing song
        let existingSong = await Song.findByPk(songId, {
          include: [{ model: Artist, as: "Artists" }],
        });

        if (existingSong) {
          // Check if we need to update the artist
          const manualArtist = songData.manualArtist || "";
          if (
            manualArtist.trim() &&
            (!existingSong.Artists || existingSong.Artists.length === 0)
          ) {
            console.log(
              `Song "${existingSong.title}" has no artist, updating with "${manualArtist}"`
            );

            // Find or create the artist
            let artistRecord = await Artist.findOne({
              where: { name: manualArtist.trim() },
            });

            if (!artistRecord) {
              console.log(`Creating new artist: "${manualArtist.trim()}"`);
              artistRecord = await Artist.create({ name: manualArtist.trim() });
            }

            // Update the song's artist association
            await existingSong.setArtists([artistRecord]);

            // Refresh the song data to include the new artist
            existingSong = await Song.findByPk(songId, {
              include: [{ model: Artist, as: "Artists" }],
            });

            console.log(
              `Updated song "${existingSong.title}" with artist "${artistRecord.name}"`
            );
          }

          console.log(
            `Using song: ${existingSong.title} by ${existingSong.Artists?.[0]?.name || "Unknown"}`
          );
          processedSongs.push({
            song: existingSong,
            setName,
            order: parseInt(order),
          });
          continue; // Skip to next song
        } else {
          console.log(`Song with ID ${songId} not found, will create new one`);
        }
      } else {
        console.log(
          `Not using existing song: songId=${songId}, action=${JSON.stringify(action)}`
        );
      }

      // If we get here, we need to create a new song
      if (action === "create" || action === "manual") {
        const songTitle = action === "manual" ? songData.manualTitle : title;
        const songArtist = action === "manual" ? songData.manualArtist : artist;

        // Check if song already exists
        let existingSong = await Song.findOne({
          include: [
            {
              model: Artist,
              as: "Artists",
              where: { name: songArtist },
            },
          ],
          where: { title: songTitle },
        });

        if (!existingSong) {
          // Create new artist if needed
          console.log(`Looking for existing artist: "${songArtist}"`);
          let artistRecord = await Artist.findOne({
            where: { name: songArtist },
          });

          if (!artistRecord) {
            console.log(
              `Artist "${songArtist}" not found, creating new one...`
            );
            try {
              artistRecord = await Artist.create({ name: songArtist });
              console.log(
                `Created artist: ${artistRecord.name} with ID: ${artistRecord.id}`
              );
            } catch (error) {
              console.error(`Error creating artist "${songArtist}":`, error);
              throw error;
            }
          } else {
            console.log(
              `Found existing artist: ${artistRecord.name} with ID: ${artistRecord.id}`
            );
          }

          // Create new song
          existingSong = await Song.create(
            {
              title: songTitle,
              Artists: [artistRecord],
            },
            {
              include: [{ model: Artist, as: "Artists" }],
            }
          );
        }

        newSongs.push(existingSong);
        processedSongs.push({
          song: existingSong,
          setName,
          order: parseInt(order),
        });
      }
    }

    // Add all songs to band's song list
    for (const processedSong of processedSongs) {
      const existingBandSong = await BandSong.findOne({
        where: { bandId, songId: processedSong.song.id },
      });

      if (!existingBandSong) {
        await BandSong.create({
          bandId,
          songId: processedSong.song.id,
        });
      }
    }

    // Create the setlist
    const setlist = await Setlist.create({
      title: setlistTitle || "Instant Set",
      date: setlistDate || null,
      bandId,
      createdById: userId,
    });

    // Group songs by set
    const setGroups = {};
    for (const processedSong of processedSongs) {
      if (!setGroups[processedSong.setName]) {
        setGroups[processedSong.setName] = [];
      }
      setGroups[processedSong.setName].push(processedSong);
    }

    // Create sets and add songs
    let setOrder = 1;
    for (const [setName, setSongs] of Object.entries(setGroups)) {
      // Sort songs by order within the set
      setSongs.sort((a, b) => a.order - b.order);

      const setlistSet = await SetlistSet.create({
        setlistId: setlist.id,
        name: setName,
        order: setOrder,
      });

      // Add songs to the set
      for (const processedSong of setSongs) {
        await SetlistSong.create({
          setlistId: setlist.id,
          setlistSetId: setlistSet.id,
          songId: processedSong.song.id,
          order: processedSong.order,
        });
      }

      setOrder++;
    }

    req.flash(
      "success",
      `Setlist "${setlist.title}" created successfully with ${processedSongs.length} songs!`
    );
    res.redirect(`/setlists/${setlist.id}`);
  } catch (error) {
    console.error("Error creating instant setlist:", error);
    req.flash("error", "An error occurred while creating the setlist");
    res.redirect(`/bands/${req.params.id}/instant-set`);
  }
});

// GET /bands/:id/songs - Show band's songs with checkboxes
router.get("/:id/songs", async (req, res) => {
  try {
    const bandId = req.params.id;
    const userId = req.session.user.id;

    // Check if user is a member
    const membership = await BandMember.findOne({
      where: { bandId, userId },
    });

    if (!membership) {
      req.flash("error", "You are not a member of this band");
      return res.redirect("/bands");
    }

    const band = await Band.findByPk(bandId);

    // Check if referrer is a setlist edit page
    const referrer = req.get("Referer");
    let fromSetlist = null;

    if (referrer) {
      // Look for setlist edit URL pattern: /setlists/:id/edit
      const setlistEditMatch = referrer.match(/\/setlists\/(\d+)\/edit/);
      if (setlistEditMatch) {
        const setlistId = setlistEditMatch[1];
        // Verify the setlist exists and belongs to this band
        const { Setlist } = require("../models");
        const setlist = await Setlist.findOne({
          where: { id: setlistId, bandId: bandId },
        });
        if (setlist) {
          fromSetlist = {
            id: setlist.id,
            title: setlist.title,
          };
        }
      }
    }

    // Get all songs
    const allSongs = await Song.findAll({
      include: [
        "Vocalist",
        "Artists",
        {
          model: require("../models").GigDocument,
          as: "GigDocuments",
          required: false,
        },
        {
          model: require("../models").Link,
          as: "Links",
          required: false,
        },
      ],
      order: [["title", "ASC"]],
    });

    // Get band's current songs
    const bandSongs = await BandSong.findAll({
      where: { bandId },
      include: [
        {
          model: Song,
          include: ["Vocalist", "Artists"],
        },
      ],
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
    const membership = await BandMember.findOne({
      where: { bandId, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Check if already added
    const existing = await BandSong.findOne({
      where: { bandId, songId },
    });

    if (existing) {
      return res.status(400).json({ error: "Song already in band" });
    }

    await BandSong.create({ bandId, songId });
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
    const membership = await BandMember.findOne({
      where: { bandId, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await BandSong.destroy({
      where: { bandId, songId },
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
    const membership = await BandMember.findOne({
      where: { bandId, userId },
    });

    if (!membership) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await BandSong.destroy({
      where: { bandId, songId },
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
    const membership = await BandMember.findOne({
      where: { bandId, userId, role: "owner" },
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
    await BandInvitation.destroy({
      where: {
        id: invitationId,
        bandId,
        usedAt: null, // Only delete unused invitations
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
    const membership = await BandMember.findOne({
      where: { bandId, userId, role: "owner" },
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
    await BandInvitation.destroy({
      where: {
        id: invitationId,
        bandId,
        usedAt: null, // Only delete unused invitations
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

module.exports = router;
