#!/usr/bin/env node

const {
  User,
  Band,
  Song,
  Artist,
  BandMember,
  BandInvitation,
  Setlist,
  SetlistSet,
  BandSong,
  Link,
  GigDocument,
} = require("./models");
const readline = require("readline");

// Environment variables for server connection
const HOST_USER = process.env.HOST_USER || "bagus1";
const HOST_DOMAIN = process.env.HOST_DOMAIN || "bagus.org";
const SETLIST_PATH =
  process.env.SETLIST_PATH || "/home/bagus1/repositories/setlister";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Colors for console output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[94m", // Light blue (bright blue) - much more readable
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  reset: "\x1b[0m",
};

// Check if colors are supported
const supportsColor = process.stdout.isTTY && process.env.TERM !== "dumb";

function log(message, color = "reset") {
  if (supportsColor && colors[color]) {
    console.log(`${colors[color]}${message}${colors.reset}`);
  } else {
    console.log(message);
  }
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function confirmAction(action) {
  const answer = await question(
    `Are you sure you want to ${action}? (yes/no): `
  );
  return answer.toLowerCase() === "yes" || answer.toLowerCase() === "y";
}

async function showServerInstructions() {
  log("\n🎵 Setlist Manager - Database Management Tool", "cyan");
  log("==============================================", "cyan");
  log("\n📡 Server Database Access", "blue");
  log("========================", "blue");
  log(`Server: ${HOST_USER}@${HOST_DOMAIN}`, "blue");
  log(`Path: ${SETLIST_PATH}`, "blue");
  log("\nTo manage the server database, use one of these commands:", "yellow");
  log(
    '1. Interactive mode: ssh bagus1@bagus.org "/home/bagus1/repositories/setlister/manage-server.sh"',
    "white"
  );
  log("2. Command line mode: npm run manage server <command>", "white");
  log("   Examples:", "white");
  log("   npm run manage server list-bands", "white");
  log("   npm run manage server list-users", "white");
  log("   npm run manage server stats", "white");
  log("\nContinuing with local database...", "blue");
  log("==============================================", "cyan");
}

async function listUsers() {
  log("\n=== Users ===", "cyan");
  const users = await User.findAll({
    attributes: ["id", "username", "email", "createdAt"],
    include: [
      {
        model: Band,
        through: { attributes: ["role"] },
        attributes: ["id", "name"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  users.forEach((user) => {
    const bands =
      user.Bands && user.Bands.length > 0
        ? user.Bands.map(
            (band) => `${band.name}(${band.BandMember.role})`
          ).join(", ")
        : "No bands";

    log(
      `ID: ${user.id} | ${user.username} | ${user.email} | Created: ${user.createdAt.toLocaleDateString()}`,
      "blue"
    );
    log(`  Bands: ${bands}`, "white");
  });
  log(`Total users: ${users.length}`, "green");
}

async function listBands() {
  log("\n=== Bands ===", "cyan");
  const bands = await Band.findAll({
    include: [
      {
        model: User,
        through: { attributes: ["role"] },
        attributes: ["id", "username", "email"],
      },
      {
        model: Song,
        through: { attributes: [] },
        include: ["Artists"],
        attributes: ["id", "title"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (bands.length === 0) {
    log("No bands found.", "yellow");
    return;
  }

  // Show simple list first
  bands.forEach((band, index) => {
    const memberCount = band.Users ? band.Users.length : 0;
    const songCount = band.Songs ? band.Songs.length : 0;
    log(
      `${index + 1}. ${band.name} (ID: ${band.id}) | Members: ${memberCount} | Songs: ${songCount} | Created: ${band.createdAt.toLocaleDateString()}`,
      "blue"
    );
  });

  log(`\nTotal bands: ${bands.length}`, "green");

  // Prompt for detailed view
  const choice = await question(
    "\nEnter band number for detailed info (or press Enter to skip): "
  );

  if (!choice.trim()) {
    return; // User chose to skip
  }

  const bandIndex = parseInt(choice) - 1;
  if (isNaN(bandIndex) || bandIndex < 0 || bandIndex >= bands.length) {
    log("Invalid band number.", "red");
    return;
  }

  const selectedBand = bands[bandIndex];

  log(`\n=== Detailed Info for "${selectedBand.name}" ===`, "cyan");
  log(
    `ID: ${selectedBand.id} | Created: ${selectedBand.createdAt.toLocaleDateString()}`,
    "blue"
  );

  // Show detailed members
  if (selectedBand.Users && selectedBand.Users.length > 0) {
    log("\nMembers:", "yellow");
    selectedBand.Users.forEach((user) => {
      const role = user.BandMember ? user.BandMember.role : "member";
      log(`  - ${user.username} (${user.email}) - ${role}`, "white");
    });
  } else {
    log("\nMembers: None", "yellow");
  }

  // Show detailed songs
  if (selectedBand.Songs && selectedBand.Songs.length > 0) {
    log("\nSongs:", "yellow");
    selectedBand.Songs.forEach((song) => {
      const artist =
        song.Artists && song.Artists.length > 0
          ? song.Artists[0].name
          : "Unknown Artist";
      log(`  - ID: ${song.id} | "${song.title}" by ${artist}`, "white");
    });
  } else {
    log("\nSongs: None", "yellow");
  }
}

async function listSongs() {
  log("\n=== Songs ===", "cyan");
  const songs = await Song.findAll({
    include: ["Artists", "Vocalist"],
    order: [["id", "ASC"]],
  });

  songs.forEach((song) => {
    const artist =
      song.Artists && song.Artists.length > 0
        ? song.Artists[0].name
        : "Unknown";
    log(
      `ID: ${song.id} | ${song.title} | ${artist} | Created: ${song.createdAt.toLocaleDateString()}`,
      "blue"
    );
  });
  log(`Total songs: ${songs.length}`, "green");
}

async function mergeArtists() {
  log("\n=== Merge Artists ===", "yellow");

  try {
    // First, show all artists to help user choose
    log("\nAvailable artists:", "blue");
    const allArtists = await Artist.findAll({
      include: [
        {
          model: Song,
          attributes: ["id", "title"],
        },
      ],
      order: [["name", "ASC"]],
    });

    if (allArtists.length < 2) {
      log("Need at least 2 artists to perform a merge.", "red");
      return;
    }

    allArtists.forEach((artist, index) => {
      const songCount = artist.Songs ? artist.Songs.length : 0;
      log(
        `${index + 1}. ${artist.name} (ID: ${artist.id}) - ${songCount} songs`,
        "white"
      );
    });

    // Get source artist (the one to be merged)
    const sourceChoice = await question(
      "\nEnter the number of the artist to merge FROM (source): "
    );
    const sourceIndex = parseInt(sourceChoice) - 1;

    if (
      isNaN(sourceIndex) ||
      sourceIndex < 0 ||
      sourceIndex >= allArtists.length
    ) {
      log("Invalid choice.", "red");
      return;
    }

    const sourceArtist = allArtists[sourceIndex];

    // Get target artist (the one to merge into)
    const targetChoice = await question(
      "Enter the number of the artist to merge INTO (target): "
    );
    const targetIndex = parseInt(targetChoice) - 1;

    if (
      isNaN(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= allArtists.length
    ) {
      log("Invalid choice.", "red");
      return;
    }

    if (sourceIndex === targetIndex) {
      log("Cannot merge an artist into itself.", "red");
      return;
    }

    const targetArtist = allArtists[targetIndex];

    // Show what will happen
    log(`\nMerge Summary:`, "cyan");
    log(
      `FROM: ${sourceArtist.name} (ID: ${sourceArtist.id}) - ${sourceArtist.Songs ? sourceArtist.Songs.length : 0} songs`,
      "yellow"
    );
    log(
      `INTO: ${targetArtist.name} (ID: ${targetArtist.id}) - ${targetArtist.Songs ? targetArtist.Songs.length : 0} songs`,
      "green"
    );

    const confirmed = await confirmAction(
      `merge "${sourceArtist.name}" into "${targetArtist.name}"? This will move all songs and delete the source artist.`
    );

    if (!confirmed) {
      log("Merge cancelled.", "yellow");
      return;
    }

    // Perform the merge
    log("\nPerforming merge...", "blue");

    // Update all songs from source artist to target artist
    if (sourceArtist.Songs && sourceArtist.Songs.length > 0) {
      for (const song of sourceArtist.Songs) {
        // Remove the source artist association
        await song.removeArtist(sourceArtist);
        // Add the target artist association
        await song.addArtist(targetArtist);
        log(`Moved song: ${song.title}`, "white");
      }
    }

    // Delete the source artist
    await sourceArtist.destroy();
    log(`Deleted source artist: ${sourceArtist.name}`, "yellow");

    // Show final result
    log(`\n✅ Merge completed successfully!`, "green");
    log(`\nSongs now belonging to "${targetArtist.name}":`, "cyan");

    const finalSongs = await Song.findAll({
      include: [
        {
          model: Artist,
          where: { id: targetArtist.id },
          attributes: ["id", "name"],
        },
      ],
      order: [["title", "ASC"]],
    });

    if (finalSongs.length > 0) {
      finalSongs.forEach((song, index) => {
        log(`  ${index + 1}. ${song.title}`, "white");
      });
      log(`\nTotal songs: ${finalSongs.length}`, "green");
    } else {
      log("  No songs found.", "yellow");
    }
  } catch (error) {
    log(`Error during merge: ${error.message}`, "red");
  }
}

async function listArtists() {
  log("\n=== Artists ===", "cyan");
  const artists = await Artist.findAll({
    include: [
      {
        model: Song,
        attributes: ["id"],
      },
    ],
    order: [["name", "ASC"]],
  });

  artists.forEach((artist) => {
    const songCount = artist.Songs ? artist.Songs.length : 0;
    log(`ID: ${artist.id} | ${artist.name} | Songs: ${songCount}`, "blue");
  });
  log(`Total artists: ${artists.length}`, "green");
}

async function deleteUser() {
  const userId = await question("Enter user ID to delete: ");
  const user = await User.findByPk(userId);

  if (!user) {
    log("User not found!", "red");
    return;
  }

  log(`Found user: ${user.username} (${user.email})`, "yellow");

  if (await confirmAction(`delete user ${user.username}`)) {
    // Delete related data first
    await BandInvitation.destroy({ where: { invitedBy: userId } });
    await BandMember.destroy({ where: { userId } });

    // Delete user
    await user.destroy();
    log(`User ${user.username} deleted successfully!`, "green");
  } else {
    log("Deletion cancelled.", "yellow");
  }
}

async function deleteBand() {
  const bandId = await question("Enter band ID to delete: ");
  const band = await Band.findByPk(bandId);

  if (!band) {
    log("Band not found!", "red");
    return;
  }

  log(`Found band: ${band.name}`, "yellow");

  if (await confirmAction(`delete band ${band.name}`)) {
    // Delete related data first
    await BandInvitation.destroy({ where: { bandId } });
    await BandMember.destroy({ where: { bandId } });
    await BandSong.destroy({ where: { bandId } });

    // Delete setlists and sets
    const setlists = await Setlist.findAll({ where: { bandId } });
    for (const setlist of setlists) {
      await SetlistSet.destroy({ where: { setlistId: setlist.id } });
    }
    await Setlist.destroy({ where: { bandId } });

    // Delete band
    await band.destroy();
    log(`Band ${band.name} deleted successfully!`, "green");
  } else {
    log("Deletion cancelled.", "yellow");
  }
}

async function deleteSong() {
  log("\n=== Delete Song ===", "red");
  const songId = await question("Enter song ID to delete: ");

  try {
    const song = await Song.findByPk(songId, {
      include: ["Artists", "Vocalist", "Links"],
    });

    if (!song) {
      log("Song not found!", "red");
      return;
    }

    log(`\nSong: ${song.title}`, "blue");
    if (song.Artists && song.Artists.length > 0) {
      log(`Artist: ${song.Artists[0].name}`, "blue");
    }
    if (song.Vocalist) {
      log(`Vocalist: ${song.Vocalist.name}`, "blue");
    }

    if (song.Links && song.Links.length > 0) {
      log(`\nLinks (${song.Links.length}):`, "yellow");
      song.Links.forEach((link, index) => {
        log(
          `  ${index + 1}. [${link.type}] ${link.description || "No description"} - ${link.url}`,
          "white"
        );
      });
    } else {
      log("\nNo links found for this song.", "yellow");
    }

    const confirmed = await confirmAction(`delete song "${song.title}"`);
    if (confirmed) {
      await song.destroy();
      log("Song deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  }
}

async function deleteLinks() {
  log("\n=== Delete Links from Song ===", "red");
  const songId = await question("Enter song ID: ");

  try {
    const song = await Song.findByPk(songId, {
      include: ["Artists", "Links"],
    });

    if (!song) {
      log("Song not found!", "red");
      return;
    }

    log(`\nSong: ${song.title}`, "blue");
    if (song.Artists && song.Artists.length > 0) {
      log(`Artist: ${song.Artists[0].name}`, "blue");
    }

    if (!song.Links || song.Links.length === 0) {
      log("\nNo links found for this song.", "yellow");
      return;
    }

    log(`\nLinks (${song.Links.length}):`, "yellow");
    song.Links.forEach((link, index) => {
      log(
        `  ${index + 1}. [${link.type}] ${link.description || "No description"} - ${link.url}`,
        "white"
      );
    });

    log("\nOptions:", "cyan");
    log(
      `- Enter a number (1-${song.Links.length}) to delete that specific link`,
      "white"
    );
    log('- Type "all" to delete all links', "white");
    log('- Type "cancel" to abort', "white");

    const choice = (await question("\nEnter your choice: "))
      .toLowerCase()
      .trim();

    if (choice === "cancel") {
      log("Operation cancelled.", "yellow");
      return;
    }

    if (choice === "all") {
      const confirmed = await confirmAction(
        `delete all ${song.Links.length} links from "${song.title}"`
      );
      if (confirmed) {
        await Link.destroy({
          where: { songId: song.id },
        });
        log(`${song.Links.length} links deleted successfully!`, "green");
      } else {
        log("Deletion cancelled.", "yellow");
      }
      return;
    }

    const linkIndex = parseInt(choice) - 1;
    if (isNaN(linkIndex) || linkIndex < 0 || linkIndex >= song.Links.length) {
      log('Invalid choice. Please enter a valid number or "all".', "red");
      return;
    }

    const selectedLink = song.Links[linkIndex];
    const confirmed = await confirmAction(
      `delete link [${selectedLink.type}] ${selectedLink.description || "No description"} from "${song.title}"`
    );

    if (confirmed) {
      await Link.destroy({
        where: { id: selectedLink.id },
      });
      log("Link deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  }
}

async function deleteArtist() {
  log("\n=== Delete Artist ===", "red");
  const artistId = await question("Enter artist ID to delete: ");

  try {
    const artist = await Artist.findByPk(artistId, {
      include: [
        {
          model: Song,
          attributes: ["id", "title"],
        },
      ],
    });

    if (!artist) {
      log("Artist not found!", "red");
      return;
    }

    log(`\nArtist: ${artist.name}`, "blue");

    if (artist.Songs && artist.Songs.length > 0) {
      log(
        `\nThis artist has ${artist.Songs.length} song(s) that will also be deleted:`,
        "yellow"
      );
      artist.Songs.forEach((song, index) => {
        log(`  ${index + 1}. ${song.title}`, "white");
      });

      log(
        "\n⚠️  WARNING: Deleting this artist will also delete all associated songs!",
        "red"
      );
    } else {
      log("\nThis artist has no songs.", "yellow");
    }

    const confirmed = await confirmAction(
      `delete artist "${artist.name}" and all ${artist.Songs ? artist.Songs.length : 0} associated songs`
    );

    if (confirmed) {
      // Delete all songs by this artist first
      if (artist.Songs && artist.Songs.length > 0) {
        for (const song of artist.Songs) {
          await song.destroy();
        }
        log(`${artist.Songs.length} songs deleted.`, "yellow");
      }

      // Delete the artist
      await artist.destroy();
      log(`Artist "${artist.name}" deleted successfully!`, "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  }
}

async function deleteGigDocuments() {
  log("\n=== Delete Gig Documents from Song ===", "red");
  const songId = await question("Enter song ID: ");

  try {
    const song = await Song.findByPk(songId, {
      include: ["Artists", "GigDocuments"],
    });

    if (!song) {
      log("Song not found!", "red");
      return;
    }

    log(`\nSong: ${song.title}`, "blue");
    if (song.Artists && song.Artists.length > 0) {
      log(`Artist: ${song.Artists[0].name}`, "blue");
    }

    if (!song.GigDocuments || song.GigDocuments.length === 0) {
      log("\nNo gig documents found for this song.", "yellow");
      return;
    }

    log(`\nGig Documents (${song.GigDocuments.length}):`, "yellow");
    song.GigDocuments.forEach((doc, index) => {
      log(
        `  ${index + 1}. [${doc.type || "No type"}] ${doc.title || "No title"} - ${doc.content ? doc.content.substring(0, 100) + "..." : "No content"}`,
        "white"
      );
    });

    log("\nOptions:", "cyan");
    log(
      `- Enter a number (1-${song.GigDocuments.length}) to delete that specific gig document`,
      "white"
    );
    log('- Type "all" to delete all gig documents', "white");
    log('- Type "cancel" to abort', "white");

    const choice = (await question("\nEnter your choice: "))
      .toLowerCase()
      .trim();

    if (choice === "cancel") {
      log("Operation cancelled.", "yellow");
      return;
    }

    if (choice === "all") {
      const confirmed = await confirmAction(
        `delete all ${song.GigDocuments.length} gig documents from "${song.title}"`
      );
      if (confirmed) {
        await GigDocument.destroy({
          where: { songId: song.id },
        });
        log(
          `${song.GigDocuments.length} gig documents deleted successfully!`,
          "green"
        );
      } else {
        log("Deletion cancelled.", "yellow");
      }
      return;
    }

    const docIndex = parseInt(choice) - 1;
    if (
      isNaN(docIndex) ||
      docIndex < 0 ||
      docIndex >= song.GigDocuments.length
    ) {
      log('Invalid choice. Please enter a valid number or "all".', "red");
      return;
    }

    const selectedDoc = song.GigDocuments[docIndex];
    const confirmed = await confirmAction(
      `delete gig document [${selectedDoc.type || "No type"}] ${selectedDoc.title || "No title"} from "${song.title}"`
    );

    if (confirmed) {
      await GigDocument.destroy({
        where: { id: selectedDoc.id },
      });
      log("Gig document deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  }
}

async function editSong() {
  log("\n=== Edit Song ===", "cyan");
  const songId = await question("Enter song ID: ");

  try {
    const song = await Song.findByPk(songId, {
      include: ["Artists", "Vocalist"],
    });

    if (!song) {
      log("Song not found!", "red");
      return;
    }

    log(`\nCurrent song details:`, "blue");
    log(`Title: ${song.title}`, "white");
    if (song.Artists && song.Artists.length > 0) {
      log(`Artist: ${song.Artists[0].name}`, "white");
    } else {
      log(`Artist: None assigned`, "white");
    }
    if (song.Vocalist) {
      log(`Vocalist: ${song.Vocalist.name}`, "white");
    }
    if (song.key) {
      log(`Key: ${song.key}`, "white");
    }
    if (song.time) {
      const minutes = Math.floor(song.time / 60);
      const seconds = song.time % 60;
      log(
        `Duration: ${minutes}:${seconds.toString().padStart(2, "0")}`,
        "white"
      );
    }

    // Edit title
    const newTitle = await question(
      "\nEnter new title (or press Enter to keep current): "
    );
    if (newTitle.trim()) {
      song.title = newTitle.trim();
      log(`Title updated to: ${song.title}`, "green");
    }

    // Edit artist
    const currentArtist =
      song.Artists && song.Artists.length > 0 ? song.Artists[0].name : "";
    const newArtist = await question(
      `Enter new artist (or press Enter to keep current: ${currentArtist}): `
    );

    if (newArtist.trim()) {
      // Find or create the artist
      let artist = await Artist.findOne({
        where: { name: newArtist.trim() },
      });

      if (!artist) {
        artist = await Artist.create({ name: newArtist.trim() });
        log(`Created new artist: ${artist.name}`, "green");
      }

      // Remove existing artist associations and add the new one
      await song.setArtists([artist]);
      log(`Artist updated to: ${artist.name}`, "green");
    }

    // Save the song
    await song.save();
    log("\nSong updated successfully!", "green");

    // Show final result
    log("\nUpdated song details:", "blue");
    log(`Title: ${song.title}`, "white");
    const updatedSong = await Song.findByPk(songId, {
      include: ["Artists", "Vocalist"],
    });
    if (updatedSong.Artists && updatedSong.Artists.length > 0) {
      log(`Artist: ${updatedSong.Artists[0].name}`, "white");
    } else {
      log(`Artist: None assigned`, "white");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  }
}

async function cleanupOrphanedData() {
  log("\n=== Cleaning up orphaned data ===", "cyan");

  // Clean up orphaned band invitations
  const orphanedInvitations = await BandInvitation.findAll({
    where: {
      expiresAt: { [require("sequelize").Op.lt]: new Date() },
    },
  });

  if (orphanedInvitations.length > 0) {
    log(`Found ${orphanedInvitations.length} expired invitations`, "yellow");
    if (await confirmAction("delete expired invitations")) {
      await BandInvitation.destroy({
        where: {
          expiresAt: { [require("sequelize").Op.lt]: new Date() },
        },
      });
      log("Expired invitations cleaned up!", "green");
    }
  } else {
    log("No expired invitations found.", "green");
  }
}

async function showStats() {
  log("\n=== Application Statistics ===", "cyan");

  const userCount = await User.count();
  const bandCount = await Band.count();
  const songCount = await Song.count();
  const setlistCount = await Setlist.count();
  const invitationCount = await BandInvitation.count({
    where: {
      usedAt: null,
      expiresAt: { [require("sequelize").Op.gt]: new Date() },
    },
  });

  log(`Users: ${userCount}`, "blue");
  log(`Bands: ${bandCount}`, "blue");
  log(`Songs: ${songCount}`, "blue");
  log(`Setlists: ${setlistCount}`, "blue");
  log(`Active Invitations: ${invitationCount}`, "blue");
}

async function showMenu() {
  log("\n🎵 Setlist Manager - Administration Tool", "magenta");
  log("=====================================", "magenta");
  log("1. List all users", "blue");
  log("2. List all bands", "blue");
  log("3. List all songs", "blue");
  log("4. List all artists", "blue");
  log("5. Delete user", "red");
  log("6. Delete band", "red");
  log("7. Delete song", "red");
  log("8. Delete artist", "red");
  log("9. Delete links from song", "red");
  log("10. Delete gig documents from song", "red");
  log("11. Edit song", "cyan");
  log("12. Cleanup orphaned data", "yellow");
  log("13. Show statistics", "cyan");
  log("14. Merge artists", "yellow");
  log("15. Exit (or type q/quit)", "reset");
  log("=====================================", "magenta");
}

async function main() {
  try {
    await showServerInstructions();

    // Sync database
    await require("./models").sequelize.sync();
    log("Database connected successfully!", "green");

    while (true) {
      await showMenu();
      const choice = await question("Enter your choice (1-15, q to quit): ");

      switch (choice.toLowerCase()) {
        case "1":
          await listUsers();
          break;
        case "2":
          await listBands();
          break;
        case "3":
          await listSongs();
          break;
        case "4":
          await listArtists();
          break;
        case "5":
          await deleteUser();
          break;
        case "6":
          await deleteBand();
          break;
        case "7":
          await deleteSong();
          break;
        case "8":
          await deleteArtist();
          break;
        case "9":
          await deleteLinks();
          break;
        case "10":
          await deleteGigDocuments();
          break;
        case "11":
          await editSong();
          break;
        case "12":
          await cleanupOrphanedData();
          break;
        case "13":
          await showStats();
          break;
        case "14":
          await mergeArtists();
          break;
        case "q":
        case "quit":
          log("Goodbye!", "green");
          rl.close();
          process.exit(0);
        default:
          log("Invalid choice. Please try again.", "red");
      }
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
    rl.close();
    process.exit(1);
  }
}

// Handle command line arguments for non-interactive mode
if (process.argv.length > 2) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  (async () => {
    try {
      // Check if this is a server command
      if (command === "server") {
        const serverCommand = args[0];
        if (!serverCommand) {
          log("Usage: npm run manage server <command>", "red");
          log("Example: npm run manage server list-bands", "yellow");
          process.exit(1);
        }

        const { exec } = require("child_process");
        const sshCommand = `ssh ${HOST_USER}@${HOST_DOMAIN} "${SETLIST_PATH}/manage-server.sh ${serverCommand}"`;

        exec(sshCommand, (error, stdout, stderr) => {
          if (error) {
            console.error("Error connecting to server:", error.message);
            process.exit(1);
          }
          if (stderr) {
            console.error("Server error:", stderr);
          }
          if (stdout) {
            console.log(stdout);
          }
        });
        return;
      }

      await require("./models").sequelize.sync();

      switch (command) {
        case "list-users":
          await listUsers();
          break;
        case "list-bands":
          await listBands();
          break;
        case "list-songs":
          await listSongs();
          break;
        case "delete-links":
          await deleteLinks();
          break;
        case "delete-gig-documents":
          await deleteGigDocuments();
          break;
        case "edit-song":
          await editSong();
          break;
        case "cleanup":
          await cleanupOrphanedData();
          break;
        case "stats":
          await showStats();
          break;
        case "merge-artists":
          await mergeArtists();
          break;
        default:
          log(`Unknown command: ${command}`, "red");
          log(
            "Available commands: list-users, list-bands, list-songs, delete-links, delete-gig-documents, edit-song, cleanup, stats, merge-artists",
            "yellow"
          );
          log("For server commands: npm run manage server <command>", "yellow");
      }

      process.exit(0);
    } catch (error) {
      log(`Error: ${error.message}`, "red");
      process.exit(1);
    }
  })();
} else {
  main();
}
