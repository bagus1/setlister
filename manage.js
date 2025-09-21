#!/usr/bin/env node

const { Client } = require("pg");
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

// Database connection function
function createDbClient() {
  return new Client({
    host: "localhost",
    port: 5432,
    database: process.env.DB_NAME || "bagus1_setlists_prod",
    user: process.env.DB_USER || "bagus1_setlists_app",
    password: process.env.DB_PASSWORD || "allofmyfriends",
  });
}

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
  const client = createDbClient();

  try {
    await client.connect();

    const usersQuery = `
      SELECT u.id, u.username, u.email, u.created_at,
             bm.role, b.name as band_name
      FROM users u
      LEFT JOIN band_members bm ON u.id = bm.user_id
      LEFT JOIN bands b ON bm.band_id = b.id
      ORDER BY u.id ASC
    `;

    const result = await client.query(usersQuery);

    // Group users by their data
    const userMap = new Map();

    result.rows.forEach((row) => {
      if (!userMap.has(row.id)) {
        userMap.set(row.id, {
          id: row.id,
          username: row.username,
          email: row.email,
          created_at: row.created_at,
          bands: [],
        });
      }

      if (row.band_name) {
        userMap.get(row.id).bands.push({
          role: row.role,
          band: { name: row.band_name },
        });
      }
    });

    const users = Array.from(userMap.values());

    users.forEach((user) => {
      const bands =
        user.bands && user.bands.length > 0
          ? user.bands
              .map((member) => `${member.band.name}(${member.role})`)
              .join(", ")
          : "No bands";

      log(
        `ID: ${user.id} | ${user.username} | ${user.email} | Created: ${new Date(user.created_at).toLocaleDateString()}`,
        "blue"
      );
      log(`  Bands: ${bands}`, "white");
    });
    log(`Total users: ${users.length}`, "green");
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listBands() {
  log("\n=== Bands ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    const bandsQuery = `
      SELECT b.id, b.name, b.created_at,
             COUNT(DISTINCT bm.user_id) as member_count,
             COUNT(DISTINCT bs.song_id) as song_count
      FROM bands b
      LEFT JOIN band_members bm ON b.id = bm.band_id
      LEFT JOIN band_songs bs ON b.id = bs.band_id
      GROUP BY b.id, b.name, b.created_at
      ORDER BY b.id ASC
    `;

    const result = await client.query(bandsQuery);

    if (result.rows.length === 0) {
      log("No bands found.", "yellow");
      return;
    }

    // Show simple list first
    result.rows.forEach((band) => {
      log(
        `${band.id}. ${band.name} | Members: ${band.member_count} | Songs: ${band.song_count} | Created: ${new Date(band.created_at).toLocaleDateString()}`,
        "blue"
      );
    });

    log(`\nTotal bands: ${result.rows.length}`, "green");

    // Prompt for detailed view
    const choice = await question(
      "\nEnter the ID of the band for detailed info (or press Enter to skip): "
    );

    if (!choice.trim()) {
      return; // User chose to skip
    }

    const bandId = parseInt(choice);
    if (isNaN(bandId)) {
      log("Invalid band ID.", "red");
      return;
    }

    // Get detailed band info
    const detailedBandQuery = `
      SELECT b.id, b.name, b.created_at
      FROM bands b
      WHERE b.id = $1
    `;

    const bandResult = await client.query(detailedBandQuery, [bandId]);
    if (bandResult.rows.length === 0) {
      log(`No band found with ID ${bandId}.`, "red");
      return;
    }

    const selectedBand = bandResult.rows[0];

    log(`\n=== Detailed Info for "${selectedBand.name}" ===`, "cyan");
    log(
      `ID: ${selectedBand.id} | Created: ${new Date(selectedBand.created_at).toLocaleDateString()}`,
      "blue"
    );

    // Show detailed members
    const membersQuery = `
      SELECT bm.role, u.username, u.email
      FROM band_members bm
      JOIN users u ON bm.user_id = u.id
      WHERE bm.band_id = $1
      ORDER BY u.username
    `;

    const membersResult = await client.query(membersQuery, [bandId]);

    if (membersResult.rows.length > 0) {
      log("\nMembers:", "yellow");
      membersResult.rows.forEach((member) => {
        const role = member.role || "member";
        log(`  - ${member.username} (${member.email}) - ${role}`, "white");
      });
    } else {
      log("\nMembers: None", "yellow");
    }

    // Show detailed songs
    const songsQuery = `
      SELECT bs.song_id, s.title, a.name as artist_name
      FROM band_songs bs
      JOIN songs s ON bs.song_id = s.id
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      WHERE bs.band_id = $1
      ORDER BY s.title
    `;

    const songsResult = await client.query(songsQuery, [bandId]);

    if (songsResult.rows.length > 0) {
      log("\nSongs:", "yellow");
      songsResult.rows.forEach((song) => {
        const artist = song.artist_name || "Unknown Artist";
        log(`  - ID: ${song.song_id} | "${song.title}" by ${artist}`, "white");
      });
    } else {
      log("\nSongs: None", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listSongs() {
  log("\n=== Songs ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    const songsQuery = `
      SELECT s.id, s.title, s.created_at, a.name as artist_name
      FROM songs s
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      ORDER BY s.title ASC
    `;

    const result = await client.query(songsQuery);

    result.rows.forEach((song) => {
      const artist = song.artist_name || "Unknown";
      log(
        `ID: ${song.id} | ${song.title} | ${artist} | Created: ${new Date(song.created_at).toLocaleDateString()}`,
        "blue"
      );
    });
    log(`Total songs: ${result.rows.length}`, "green");
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function mergeArtists() {
  log("\n=== Merge Artists ===", "yellow");
  const client = createDbClient();

  try {
    await client.connect();

    // First, show all artists to help user choose
    log("\nAvailable artists:", "blue");
    const allArtistsQuery = `
      SELECT a.id, a.name, COUNT(sa.song_id) as song_count
      FROM artists a
      LEFT JOIN song_artists sa ON a.id = sa.artist_id
      GROUP BY a.id, a.name
      ORDER BY a.name ASC
    `;

    const allArtistsResult = await client.query(allArtistsQuery);

    if (allArtistsResult.rows.length < 2) {
      log("Need at least 2 artists to perform a merge.", "red");
      return;
    }

    allArtistsResult.rows.forEach((artist, index) => {
      log(
        `${index + 1}. ${artist.name} (ID: ${artist.id}) - ${artist.song_count} songs`,
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
      sourceIndex >= allArtistsResult.rows.length
    ) {
      log("Invalid choice.", "red");
      return;
    }

    const sourceArtist = allArtistsResult.rows[sourceIndex];

    // Get target artist (the one to merge into)
    const targetChoice = await question(
      "Enter the number of the artist to merge INTO (target): "
    );
    const targetIndex = parseInt(targetChoice) - 1;

    if (
      isNaN(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= allArtistsResult.rows.length
    ) {
      log("Invalid choice.", "red");
      return;
    }

    if (sourceIndex === targetIndex) {
      log("Cannot merge an artist into itself.", "red");
      return;
    }

    const targetArtist = allArtistsResult.rows[targetIndex];

    // Show what will happen
    log(`\nMerge Summary:`, "cyan");
    log(
      `FROM: ${sourceArtist.name} (ID: ${sourceArtist.id}) - ${sourceArtist.song_count} songs`,
      "yellow"
    );
    log(
      `INTO: ${targetArtist.name} (ID: ${targetArtist.id}) - ${targetArtist.song_count} songs`,
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
    const updateQuery = `
      UPDATE song_artists 
      SET artist_id = $1, updated_at = NOW()
      WHERE artist_id = $2
    `;

    const updateResult = await client.query(updateQuery, [
      targetArtist.id,
      sourceArtist.id,
    ]);
    log(
      `Moved ${updateResult.rowCount} songs from "${sourceArtist.name}" to "${targetArtist.name}"`,
      "white"
    );

    // Delete the source artist
    await client.query("DELETE FROM artists WHERE id = $1", [sourceArtist.id]);
    log(`Deleted source artist: ${sourceArtist.name}`, "yellow");

    // Show final result
    log(`\n✅ Merge completed successfully!`, "green");
    log(`\nSongs now belonging to "${targetArtist.name}":`, "cyan");

    const finalSongsQuery = `
      SELECT s.title
      FROM songs s
      JOIN song_artists sa ON s.id = sa.song_id
      WHERE sa.artist_id = $1
      ORDER BY s.title ASC
    `;

    const finalSongsResult = await client.query(finalSongsQuery, [
      targetArtist.id,
    ]);

    if (finalSongsResult.rows.length > 0) {
      finalSongsResult.rows.forEach((song, index) => {
        log(`  ${index + 1}. ${song.title}`, "white");
      });
      log(`\nTotal songs: ${finalSongsResult.rows.length}`, "green");
    } else {
      log("  No songs found.", "yellow");
    }
  } catch (error) {
    log(`Error during merge: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listArtists() {
  log("\n=== Artists ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    const artistsQuery = `
      SELECT a.id, a.name, COUNT(sa.song_id) as song_count
      FROM artists a
      LEFT JOIN song_artists sa ON a.id = sa.artist_id
      GROUP BY a.id, a.name
      ORDER BY a.name ASC
    `;

    const result = await client.query(artistsQuery);

    result.rows.forEach((artist) => {
      log(
        `ID: ${artist.id} | ${artist.name} | Songs: ${artist.song_count}`,
        "blue"
      );
    });
    log(`Total artists: ${result.rows.length}`, "green");
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteUser() {
  const userId = await question("Enter user ID to delete: ");
  const client = createDbClient();

  if (!userId.trim()) {
    log("No User Deleted", "yellow");
    return;
  }

  try {
    await client.connect();

    const userQuery = "SELECT id, username, email FROM users WHERE id = $1";
    const userResult = await client.query(userQuery, [parseInt(userId)]);

    if (userResult.rows.length === 0) {
      log("User not found!", "red");
      return;
    }

    const user = userResult.rows[0];
    log(`Found user: ${user.username} (${user.email})`, "yellow");

    if (await confirmAction(`delete user ${user.username}`)) {
      // Delete related data first
      await client.query("DELETE FROM band_invitations WHERE invited_by = $1", [
        parseInt(userId),
      ]);
      await client.query("DELETE FROM band_members WHERE user_id = $1", [
        parseInt(userId),
      ]);

      // Check if user owns any bands
      const ownedBandsQuery =
        "SELECT id, name FROM bands WHERE created_by_id = $1";
      const ownedBandsResult = await client.query(ownedBandsQuery, [
        parseInt(userId),
      ]);

      if (ownedBandsResult.rows.length > 0) {
        log(
          `\n⚠️  WARNING: User owns ${ownedBandsResult.rows.length} band(s):`,
          "red"
        );
        ownedBandsResult.rows.forEach((band) => {
          log(`  - ${band.name} (ID: ${band.id})`, "yellow");
        });

        log(
          "\nYou must transfer ownership of these bands before deleting the user.",
          "red"
        );
        const newOwnerId = await question(
          "Enter the user ID to transfer ownership to: "
        );

        if (!newOwnerId.trim()) {
          log("No new owner specified. User deletion cancelled.", "yellow");
          return;
        }

        const newOwnerQuery = "SELECT id, username FROM users WHERE id = $1";
        const newOwnerResult = await client.query(newOwnerQuery, [
          parseInt(newOwnerId),
        ]);

        if (newOwnerResult.rows.length === 0) {
          log("New owner not found. User deletion cancelled.", "red");
          return;
        }

        const newOwner = newOwnerResult.rows[0];
        log(`Transferring ownership to: ${newOwner.username}`, "green");

        // Transfer ownership of all bands
        for (const band of ownedBandsResult.rows) {
          await client.query(
            "UPDATE bands SET created_by_id = $1 WHERE id = $2",
            [parseInt(newOwnerId), band.id]
          );
          log(
            `  - ${band.name} ownership transferred to ${newOwner.username}`,
            "green"
          );
        }
      }

      // Delete user
      await client.query("DELETE FROM users WHERE id = $1", [parseInt(userId)]);
      log(`User ${user.username} deleted successfully!`, "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteBand() {
  const bandId = await question("Enter band ID to delete: ");
  const client = createDbClient();

  if (!bandId.trim()) {
    log("No Band Deleted", "yellow");
    return;
  }

  try {
    await client.connect();

    const bandQuery = "SELECT id, name FROM bands WHERE id = $1";
    const bandResult = await client.query(bandQuery, [parseInt(bandId)]);

    if (bandResult.rows.length === 0) {
      log("Band not found!", "red");
      return;
    }

    const band = bandResult.rows[0];
    log(`Found band: ${band.name}`, "yellow");

    if (await confirmAction(`delete band ${band.name}`)) {
      // Delete related data first
      await client.query("DELETE FROM band_invitations WHERE band_id = $1", [
        parseInt(bandId),
      ]);
      await client.query("DELETE FROM band_members WHERE band_id = $1", [
        parseInt(bandId),
      ]);
      await client.query("DELETE FROM band_songs WHERE band_id = $1", [
        parseInt(bandId),
      ]);

      // Delete setlists and sets
      const setlistsQuery = "SELECT id FROM setlists WHERE band_id = $1";
      const setlistsResult = await client.query(setlistsQuery, [
        parseInt(bandId),
      ]);

      for (const setlist of setlistsResult.rows) {
        // Delete setlist songs first (they reference setlist sets)
        await client.query(
          "DELETE FROM setlist_songs WHERE setlist_set_id IN (SELECT id FROM setlist_sets WHERE setlist_id = $1)",
          [setlist.id]
        );
        // Then delete setlist sets
        await client.query("DELETE FROM setlist_sets WHERE setlist_id = $1", [
          setlist.id,
        ]);
      }
      await client.query("DELETE FROM setlists WHERE band_id = $1", [
        parseInt(bandId),
      ]);

      // Delete band
      await client.query("DELETE FROM bands WHERE id = $1", [parseInt(bandId)]);
      log(`Band ${band.name} deleted successfully!`, "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteSong() {
  log("\n=== Delete Song ===", "red");
  const songId = await question("Enter song ID to delete: ");

  if (!songId.trim()) {
    log("No Song Deleted", "yellow");
    return;
  }

  const client = createDbClient();

  try {
    await client.connect();

    // Get song details with related data
    const songQuery = `
      SELECT s.id, s.title, s.key, s.time, s.created_at,
             v.name as vocalist_name,
             COUNT(l.id) as link_count,
             COUNT(gd.id) as gig_doc_count
      FROM songs s
      LEFT JOIN vocalists v ON s.vocalist_id = v.id
      LEFT JOIN links l ON s.id = l.song_id
      LEFT JOIN gig_documents gd ON s.id = gd.song_id
      WHERE s.id = $1
      GROUP BY s.id, s.title, s.key, s.time, s.created_at, v.name
    `;

    const songResult = await client.query(songQuery, [parseInt(songId)]);

    if (songResult.rows.length === 0) {
      log("Song not found!", "red");
      return;
    }

    const song = songResult.rows[0];

    // Get artist information
    const artistQuery = `
      SELECT a.name as artist_name
      FROM song_artists sa
      JOIN artists a ON sa.artist_id = a.id
      WHERE sa.song_id = $1
      LIMIT 1
    `;

    const artistResult = await client.query(artistQuery, [parseInt(songId)]);
    const artistName =
      artistResult.rows.length > 0 ? artistResult.rows[0].artist_name : null;

    // Get link details
    const linksQuery = `
      SELECT type, description, url
      FROM links
      WHERE song_id = $1
      ORDER BY id
    `;

    const linksResult = await client.query(linksQuery, [parseInt(songId)]);

    // Display song information
    log(`\nSong: ${song.title}`, "blue");
    if (artistName) {
      log(`Artist: ${artistName}`, "blue");
    }
    if (song.vocalist_name) {
      log(`Vocalist: ${song.vocalist_name}`, "blue");
    }
    if (song.key) {
      log(`Key: ${song.key}`, "blue");
    }
    if (song.time) {
      log(
        `Time: ${Math.floor(song.time / 60)}:${(song.time % 60).toString().padStart(2, "0")}`,
        "blue"
      );
    }

    if (linksResult.rows.length > 0) {
      log(`\nLinks (${linksResult.rows.length}):`, "yellow");
      linksResult.rows.forEach((link, index) => {
        log(
          `  ${index + 1}. [${link.type}] ${link.description || "No description"} - ${link.url}`,
          "white"
        );
      });
    } else {
      log("\nNo links found for this song.", "yellow");
    }

    log(`\nGig Documents: ${song.gig_doc_count}`, "yellow");

    const confirmed = await confirmAction(`delete song "${song.title}"`);
    if (confirmed) {
      // Delete in correct order due to foreign key constraints
      await client.query("DELETE FROM setlist_songs WHERE song_id = $1", [
        parseInt(songId),
      ]);
      await client.query("DELETE FROM song_artists WHERE song_id = $1", [
        parseInt(songId),
      ]);
      await client.query("DELETE FROM band_songs WHERE song_id = $1", [
        parseInt(songId),
      ]);
      await client.query("DELETE FROM links WHERE song_id = $1", [
        parseInt(songId),
      ]);
      await client.query("DELETE FROM gig_documents WHERE song_id = $1", [
        parseInt(songId),
      ]);
      await client.query("DELETE FROM songs WHERE id = $1", [parseInt(songId)]);

      log("Song deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteLinks() {
  log("\n=== Delete Links from Song ===", "red");
  const songId = await question("Enter song ID: ");
  const client = createDbClient();

  if (!songId.trim()) {
    log("No Song Selected", "yellow");
    return;
  }

  try {
    await client.connect();

    const songQuery = `
      SELECT s.id, s.title, a.name as artist_name
      FROM songs s
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      WHERE s.id = $1
      LIMIT 1
    `;

    const songResult = await client.query(songQuery, [parseInt(songId)]);

    if (songResult.rows.length === 0) {
      log("Song not found!", "red");
      return;
    }

    const song = songResult.rows[0];
    log(`\nSong: ${song.title}`, "blue");
    if (song.artist_name) {
      log(`Artist: ${song.artist_name}`, "blue");
    }

    // Get links for this song
    const linksQuery = `
      SELECT id, type, description, url
      FROM links
      WHERE song_id = $1
      ORDER BY id
    `;

    const linksResult = await client.query(linksQuery, [parseInt(songId)]);

    if (linksResult.rows.length === 0) {
      log("\nNo links found for this song.", "yellow");
      return;
    }

    log(`\nLinks (${linksResult.rows.length}):`, "yellow");
    linksResult.rows.forEach((link, index) => {
      log(
        `  ${index + 1}. [${link.type}] ${link.description || "No description"} - ${link.url}`,
        "white"
      );
    });

    log("\nOptions:", "cyan");
    log(
      `- Enter a number (1-${linksResult.rows.length}) to delete that specific link`,
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
        `delete all ${linksResult.rows.length} links from "${song.title}"`
      );
      if (confirmed) {
        await client.query("DELETE FROM links WHERE song_id = $1", [
          parseInt(songId),
        ]);
        log(`${linksResult.rows.length} links deleted successfully!`, "green");
      } else {
        log("Deletion cancelled.", "yellow");
      }
      return;
    }

    const linkIndex = parseInt(choice) - 1;
    if (
      isNaN(linkIndex) ||
      linkIndex < 0 ||
      linkIndex >= linksResult.rows.length
    ) {
      log('Invalid choice. Please enter a valid number or "all".', "red");
      return;
    }

    const selectedLink = linksResult.rows[linkIndex];
    const confirmed = await confirmAction(
      `delete link [${selectedLink.type}] ${selectedLink.description || "No description"} from "${song.title}"`
    );

    if (confirmed) {
      await client.query("DELETE FROM links WHERE id = $1", [selectedLink.id]);
      log("Link deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteArtist() {
  log("\n=== Delete Artist ===", "red");
  const artistId = await question("Enter artist ID to delete: ");
  const client = createDbClient();

  if (!artistId.trim()) {
    log("No Artist Deleted", "yellow");
    return;
  }

  try {
    await client.connect();

    const artistQuery = `
      SELECT a.id, a.name, COUNT(sa.song_id) as song_count
      FROM artists a
      LEFT JOIN song_artists sa ON a.id = sa.artist_id
      WHERE a.id = $1
      GROUP BY a.id, a.name
    `;

    const artistResult = await client.query(artistQuery, [parseInt(artistId)]);

    if (artistResult.rows.length === 0) {
      log("Artist not found!", "red");
      return;
    }

    const artist = artistResult.rows[0];
    log(`\nArtist: ${artist.name}`, "blue");

    if (artist.song_count > 0) {
      // Get song details
      const songsQuery = `
        SELECT s.id, s.title
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        WHERE sa.artist_id = $1
        ORDER BY s.title
      `;

      const songsResult = await client.query(songsQuery, [parseInt(artistId)]);

      log(
        `\nThis artist has ${songsResult.rows.length} song(s) that will also be deleted:`,
        "yellow"
      );
      songsResult.rows.forEach((song, index) => {
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
      `delete artist "${artist.name}" and all ${artist.song_count} associated songs`
    );

    if (confirmed) {
      // Delete in correct order due to foreign key constraints
      if (artist.song_count > 0) {
        // Get the song IDs first before deleting relationships
        const songIdsQuery = `
          SELECT s.id 
          FROM songs s 
          JOIN song_artists sa ON s.id = sa.song_id 
          WHERE sa.artist_id = $1
        `;
        const songIdsResult = await client.query(songIdsQuery, [
          parseInt(artistId),
        ]);
        const songIds = songIdsResult.rows.map((row) => row.id);

        if (songIds.length > 0) {
          log(
            `\nCleaning up related data for ${songIds.length} songs...`,
            "blue"
          );

          // Delete setlist_songs first (they reference setlist_sets)
          const setlistSongsResult = await client.query(
            "DELETE FROM setlist_songs WHERE song_id = ANY($1) RETURNING id",
            [songIds]
          );
          if (setlistSongsResult.rowCount > 0) {
            log(
              `Removed ${setlistSongsResult.rowCount} setlist song references.`,
              "yellow"
            );
          }

          // Delete gig_documents
          const gigDocsResult = await client.query(
            "DELETE FROM gig_documents WHERE song_id = ANY($1) RETURNING id",
            [songIds]
          );
          if (gigDocsResult.rowCount > 0) {
            log(`Removed ${gigDocsResult.rowCount} gig documents.`, "yellow");
          }

          // Delete links
          const linksResult = await client.query(
            "DELETE FROM links WHERE song_id = ANY($1) RETURNING id",
            [songIds]
          );
          if (linksResult.rowCount > 0) {
            log(`Removed ${linksResult.rowCount} links.`, "yellow");
          }

          // Delete band_songs relationships
          const bandSongsResult = await client.query(
            "DELETE FROM band_songs WHERE song_id = ANY($1) RETURNING id",
            [songIds]
          );
          if (bandSongsResult.rowCount > 0) {
            log(
              `Removed ${bandSongsResult.rowCount} band-song relationships.`,
              "yellow"
            );
          }

          // First, delete song_artists relationships
          await client.query("DELETE FROM song_artists WHERE artist_id = $1", [
            parseInt(artistId),
          ]);
          log(
            `Removed ${artist.song_count} song-artist relationships.`,
            "yellow"
          );

          // Finally delete the songs
          const deleteSongsQuery = `
            DELETE FROM songs 
            WHERE id = ANY($1)
          `;
          await client.query(deleteSongsQuery, [songIds]);
          log(`${songIds.length} songs deleted.`, "yellow");
        }
      }

      // Finally delete the artist
      await client.query("DELETE FROM artists WHERE id = $1", [
        parseInt(artistId),
      ]);
      log(`Artist "${artist.name}" deleted successfully!`, "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function deleteGigDocuments() {
  log("\n=== Delete Gig Documents from Song ===", "red");
  const songId = await question("Enter song ID: ");
  const client = createDbClient();

  if (!songId.trim()) {
    log("No Song Selected", "yellow");
    return;
  }

  try {
    await client.connect();

    const songQuery = `
      SELECT s.id, s.title, a.name as artist_name
      FROM songs s
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      WHERE s.id = $1
      LIMIT 1
    `;

    const songResult = await client.query(songQuery, [parseInt(songId)]);

    if (songResult.rows.length === 0) {
      log("Song not found!", "red");
      return;
    }

    const song = songResult.rows[0];
    log(`\nSong: ${song.title}`, "blue");
    if (song.artist_name) {
      log(`Artist: ${song.artist_name}`, "blue");
    }

    // Get gig documents for this song
    const gigDocsQuery = `
      SELECT id, type, version
      FROM gig_documents
      WHERE song_id = $1
      ORDER BY id
    `;

    const gigDocsResult = await client.query(gigDocsQuery, [parseInt(songId)]);

    if (gigDocsResult.rows.length === 0) {
      log("\nNo gig documents found for this song.", "yellow");
      return;
    }

    log(`\nGig Documents (${gigDocsResult.rows.length}):`, "yellow");
    gigDocsResult.rows.forEach((doc, index) => {
      const docTitle = `${doc.type || "No type"} - v${doc.version || "No version"}`;
      log(`  ${index + 1}. ${docTitle}`, "white");
    });

    log("\nOptions:", "cyan");
    log(
      `- Enter a number (1-${gigDocsResult.rows.length}) to delete that specific gig document`,
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
        `delete all ${gigDocsResult.rows.length} gig documents from "${song.title}"`
      );
      if (confirmed) {
        await client.query("DELETE FROM gig_documents WHERE song_id = $1", [
          parseInt(songId),
        ]);
        log(
          `${gigDocsResult.rows.length} gig documents deleted successfully!`,
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
      docIndex >= gigDocsResult.rows.length
    ) {
      log('Invalid choice. Please enter a valid number or "all".', "red");
      return;
    }

    const selectedDoc = gigDocsResult.rows[docIndex];
    const docTitle = `${selectedDoc.type || "No type"} - v${selectedDoc.version || "No version"}`;
    const confirmed = await confirmAction(
      `delete gig document ${docTitle} from "${song.title}"`
    );

    if (confirmed) {
      await client.query("DELETE FROM gig_documents WHERE id = $1", [
        selectedDoc.id,
      ]);
      log("Gig document deleted successfully!", "green");
    } else {
      log("Deletion cancelled.", "yellow");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function editSong() {
  log("\n=== Edit Song ===", "cyan");
  const songId = await question("Enter song ID: ");
  const client = createDbClient();

  if (!songId.trim()) {
    log("No Song Selected", "yellow");
    return;
  }

  try {
    await client.connect();

    const songQuery = `
      SELECT s.id, s.title, s.key, s.time, a.name as artist_name, v.name as vocalist_name
      FROM songs s
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      LEFT JOIN vocalists v ON s.vocalist_id = v.id
      WHERE s.id = $1
      LIMIT 1
    `;

    const songResult = await client.query(songQuery, [parseInt(songId)]);

    if (songResult.rows.length === 0) {
      log("Song not found!", "red");
      return;
    }

    const song = songResult.rows[0];
    log(`\nCurrent song details:`, "blue");
    log(`Title: ${song.title}`, "white");
    if (song.artist_name) {
      log(`Artist: ${song.artist_name}`, "white");
    } else {
      log(`Artist: None assigned`, "white");
    }
    if (song.vocalist_name) {
      log(`Vocalist: ${song.vocalist_name}`, "white");
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
    const currentArtist = song.artist_name || "";
    const newArtist = await question(
      `Enter new artist (or press Enter to keep current: ${currentArtist}): `
    );

    if (newArtist.trim()) {
      // Find or create the artist
      let artistQuery = "SELECT id, name FROM artists WHERE name = $1";
      let artistResult = await client.query(artistQuery, [newArtist.trim()]);
      let artist = artistResult.rows[0];

      if (!artist) {
        const createArtistQuery = `
          INSERT INTO artists (name, created_at, updated_at)
          VALUES ($1, NOW(), NOW())
          RETURNING id, name
        `;
        artistResult = await client.query(createArtistQuery, [
          newArtist.trim(),
        ]);
        artist = artistResult.rows[0];
        log(`Created new artist: ${artist.name}`, "green");
      }

      // Remove existing artist associations and add the new one
      await client.query("DELETE FROM song_artists WHERE song_id = $1", [
        song.id,
      ]);
      await client.query(
        `
        INSERT INTO song_artists (song_id, artist_id, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `,
        [song.id, artist.id]
      );
      log(`Artist updated to: ${artist.name}`, "green");
    }

    // Save the song
    await client.query(
      `
      UPDATE songs 
      SET title = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [song.title, song.id]
    );
    log("\nSong updated successfully!", "green");

    // Show final result
    log("\nUpdated song details:", "blue");
    log(`Title: ${song.title}`, "white");

    const updatedSongQuery = `
      SELECT a.name as artist_name
      FROM songs s
      LEFT JOIN song_artists sa ON s.id = sa.song_id
      LEFT JOIN artists a ON sa.artist_id = a.id
      WHERE s.id = $1
      LIMIT 1
    `;

    const updatedSongResult = await client.query(updatedSongQuery, [
      parseInt(songId),
    ]);
    if (updatedSongResult.rows[0] && updatedSongResult.rows[0].artist_name) {
      log(`Artist: ${updatedSongResult.rows[0].artist_name}`, "white");
    } else {
      log(`Artist: None assigned`, "white");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function cleanupOrphanedData() {
  log("\n=== Cleaning up orphaned data ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    // Clean up orphaned band invitations
    const orphanedInvitationsQuery = `
      SELECT id, expires_at
      FROM band_invitations
      WHERE expires_at < NOW()
    `;

    const orphanedInvitationsResult = await client.query(
      orphanedInvitationsQuery
    );

    if (orphanedInvitationsResult.rows.length > 0) {
      log(
        `Found ${orphanedInvitationsResult.rows.length} expired invitations`,
        "yellow"
      );
      if (await confirmAction("delete expired invitations")) {
        await client.query(
          "DELETE FROM band_invitations WHERE expires_at < NOW()"
        );
        log("Expired invitations cleaned up!", "green");
      }
    } else {
      log("No expired invitations found.", "green");
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function showStats() {
  log("\n=== Application Statistics ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    const userCountResult = await client.query(
      "SELECT COUNT(*) as count FROM users"
    );
    const bandCountResult = await client.query(
      "SELECT COUNT(*) as count FROM bands"
    );
    const songCountResult = await client.query(
      "SELECT COUNT(*) as count FROM songs"
    );
    const setlistCountResult = await client.query(
      "SELECT COUNT(*) as count FROM setlists"
    );
    const invitationCountResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM band_invitations 
      WHERE used_at IS NULL AND expires_at > NOW()
    `);

    const userCount = userCountResult.rows[0].count;
    const bandCount = bandCountResult.rows[0].count;
    const songCount = songCountResult.rows[0].count;
    const setlistCount = setlistCountResult.rows[0].count;
    const invitationCount = invitationCountResult.rows[0].count;

    log(`Users: ${userCount}`, "blue");
    log(`Bands: ${bandCount}`, "blue");
    log(`Songs: ${songCount}`, "blue");
    log(`Setlists: ${setlistCount}`, "blue");
    log(`Active Invitations: ${invitationCount}`, "blue");
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
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
  log("15. Manage whitelist domains", "green");
  log("16. Manage venue types", "green");
  log("17. Manage social media types", "green");
  log("18. Exit (or type q/quit)", "reset");
  log("=====================================", "magenta");
}

async function manageWhitelistDomains() {
  log("\n=== Manage Whitelist Domains ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    while (true) {
      log("\nWhitelist Domain Management:", "yellow");
      log("1. List all whitelist domains", "white");
      log("2. Add new whitelist domain", "white");
      log("3. Deactivate whitelist domain", "white");
      log("4. Reactivate whitelist domain", "white");
      log("5. Back to main menu", "white");

      const choice = await question("\nEnter your choice (1-5): ");

      switch (choice) {
        case "1":
          await listWhitelistDomains(client);
          break;
        case "2":
          await addWhitelistDomain(client);
          break;
        case "3":
          await deactivateWhitelistDomain(client);
          break;
        case "4":
          await reactivateWhitelistDomain(client);
          break;
        case "5":
          return;
        default:
          log("Invalid choice. Please try again.", "red");
      }
    }
  } catch (error) {
    log(`Error managing whitelist domains: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listWhitelistDomains(client) {
  log("\n=== Whitelist Domains ===", "cyan");

  try {
    const query = `
      SELECT wd.id, wd."linkType", wd.domain, wd.pattern, wd.is_active, wd.created_at
      FROM whitelist_domains wd
      ORDER BY wd."linkType", wd.domain
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      log("No whitelist domains found.", "yellow");
      return;
    }

    let currentType = null;
    result.rows.forEach((row, index) => {
      if (row.linkType !== currentType) {
        currentType = row.linkType;
        log(`\n${currentType.toUpperCase()}:`, "magenta");
      }

      const status = row.is_active ? "✅ Active" : "❌ Inactive";
      log(`  ${index + 1}. ${row.domain} - ${status}`, "white");
      log(`     Pattern: ${row.pattern}`, "cyan");
      log(
        `     Added: ${new Date(row.created_at).toLocaleDateString()}`,
        "blue"
      );
    });
  } catch (error) {
    log(`Error listing whitelist domains: ${error.message}`, "red");
  }
}

async function addWhitelistDomain(client) {
  log("\n=== Add Whitelist Domain ===", "cyan");

  try {
    // Get available link types
    const linkTypesQuery = `
      SELECT unnest(enum_range(NULL::enum_links_type)) as link_type
      ORDER BY link_type
    `;
    const linkTypesResult = await client.query(linkTypesQuery);

    log("\nAvailable link types:", "yellow");
    linkTypesResult.rows.forEach((row, index) => {
      log(`${index + 1}. ${row.link_type}`, "white");
    });

    const linkTypeIndex = await question(
      "\nEnter the number of the link type: "
    );
    const linkType =
      linkTypesResult.rows[parseInt(linkTypeIndex) - 1]?.link_type;

    if (!linkType) {
      log("Invalid link type selection.", "red");
      return;
    }

    const domain = await question("Enter the domain (e.g., example.com): ");
    const pattern = await question(
      "Enter the regex pattern (or press Enter for default): "
    );

    // Use default pattern if none provided
    const finalPattern =
      pattern ||
      `^https?:\\/\\/(www\\.)?${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}\\/.*$`;

    const confirm = await confirmAction(
      `add domain "${domain}" for link type "${linkType}" with pattern "${finalPattern}"`
    );

    if (!confirm) {
      log("Domain addition cancelled.", "yellow");
      return;
    }

    const insertQuery = `
      INSERT INTO whitelist_domains ("linkType", domain, pattern, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      ON CONFLICT ("linkType", domain) 
      DO UPDATE SET 
        pattern = EXCLUDED.pattern,
        is_active = true,
        updated_at = NOW()
    `;

    await client.query(insertQuery, [linkType, domain, finalPattern]);
    log(
      `Successfully added/updated whitelist domain "${domain}" for "${linkType}"`,
      "green"
    );
  } catch (error) {
    log(`Error adding whitelist domain: ${error.message}`, "red");
  }
}

async function deactivateWhitelistDomain(client) {
  log("\n=== Deactivate Whitelist Domain ===", "cyan");

  try {
    const query = `
      SELECT id, "linkType", domain, is_active
      FROM whitelist_domains
      WHERE is_active = true
      ORDER BY "linkType", domain
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      log("No active whitelist domains found.", "yellow");
      return;
    }

    log("\nActive whitelist domains:", "yellow");
    result.rows.forEach((row, index) => {
      log(`${index + 1}. ${row.domain} (${row.link_type})`, "white");
      log(`     Pattern: ${row.pattern}`, "cyan");
      log(
        `     Added: ${new Date(row.created_at).toLocaleDateString()}`,
        "blue"
      );
    });
  } catch (error) {
    log(`Error listing whitelist domains: ${error.message}`, "red");
  }
}

async function reactivateWhitelistDomain(client) {
  log("\n=== Reactivate Whitelist Domain ===", "cyan");

  try {
    const query = `
      SELECT id, "linkType", domain, is_active
      FROM whitelist_domains
      WHERE is_active = false
      ORDER BY "linkType", domain
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      log("No inactive whitelist domains found.", "yellow");
      return;
    }

    log("\nInactive whitelist domains:", "yellow");
    result.rows.forEach((row, index) => {
      log(`${index + 1}. ${row.domain} (${row.linkType})`, "white");
    });

    const domainIndex = await question(
      "\nEnter the number of the domain to reactivate: "
    );
    const selectedDomain = result.rows[parseInt(domainIndex) - 1];

    if (!selectedDomain) {
      log("Invalid domain selection.", "red");
      return;
    }

    const confirm = await confirmAction(
      `reactivate domain "${selectedDomain.domain}" for "${selectedDomain.linkType}"`
    );

    if (!confirm) {
      log("Reactivation cancelled.", "yellow");
      return;
    }

    const updateQuery = `
      UPDATE whitelist_domains 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
    `;

    await client.query(updateQuery, [selectedDomain.id]);
    log(`Successfully reactivated domain "${selectedDomain.domain}"`, "green");
  } catch (error) {
    log(`Error reactivating whitelist domain: ${error.message}`, "red");
  }
}

async function manageVenueTypes() {
  log("\n=== Manage Venue Types ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    while (true) {
      log("\n1. List venue types", "blue");
      log("2. Add venue type", "green");
      log("3. Update venue type", "yellow");
      log("4. Deactivate venue type", "red");
      log("5. Reactivate venue type", "green");
      log("6. Back to main menu", "reset");

      const choice = await question("Enter your choice (1-6): ");

      switch (choice) {
        case "1":
          await listVenueTypes(client);
          break;
        case "2":
          await addVenueType(client);
          break;
        case "3":
          await updateVenueType(client);
          break;
        case "4":
          await deactivateVenueType(client);
          break;
        case "5":
          await reactivateVenueType(client);
          break;
        case "6":
          return;
        default:
          log("Invalid choice. Please try again.", "red");
      }
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listVenueTypes(client) {
  log("\n=== Venue Types ===", "cyan");

  try {
    const result = await client.query(`
      SELECT id, name, description, is_active, sort_order, created_at
      FROM venue_types 
      ORDER BY sort_order ASC, name ASC
    `);

    if (result.rows.length === 0) {
      log("No venue types found.", "yellow");
      return;
    }

    result.rows.forEach((row) => {
      const status = row.is_active ? "✓" : "✗";
      const description = row.description ? ` - ${row.description}` : "";
      log(
        `${status} [${row.id}] ${row.name}${description} (Order: ${row.sort_order})`,
        row.is_active ? "green" : "red"
      );
    });
  } catch (error) {
    log(`Error listing venue types: ${error.message}`, "red");
  }
}

async function addVenueType(client) {
  log("\n=== Add Venue Type ===", "cyan");

  try {
    const name = await question("Enter venue type name: ");
    const description = await question("Enter description (optional): ");
    const sortOrder = await question("Enter sort order (0-999): ");

    if (!name.trim()) {
      log("Name is required.", "red");
      return;
    }

    const result = await client.query(
      `
      INSERT INTO venue_types (name, description, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      RETURNING id
    `,
      [name.trim(), description.trim() || null, parseInt(sortOrder) || 0]
    );

    log(`✓ Venue type '${name}' added with ID ${result.rows[0].id}`, "green");
  } catch (error) {
    if (error.code === "23505") {
      log("Error: A venue type with this name already exists.", "red");
    } else {
      log(`Error adding venue type: ${error.message}`, "red");
    }
  }
}

async function updateVenueType(client) {
  log("\n=== Update Venue Type ===", "cyan");

  try {
    const id = await question("Enter venue type ID to update: ");
    const name = await question("Enter new name: ");
    const description = await question("Enter new description (optional): ");
    const sortOrder = await question("Enter new sort order (0-999): ");

    if (!name.trim()) {
      log("Name is required.", "red");
      return;
    }

    const result = await client.query(
      `
      UPDATE venue_types 
      SET name = $1, description = $2, sort_order = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING name
    `,
      [
        name.trim(),
        description.trim() || null,
        parseInt(sortOrder) || 0,
        parseInt(id),
      ]
    );

    if (result.rows.length === 0) {
      log("Venue type not found.", "red");
    } else {
      log(
        `✓ Venue type '${result.rows[0].name}' updated successfully`,
        "green"
      );
    }
  } catch (error) {
    if (error.code === "23505") {
      log("Error: A venue type with this name already exists.", "red");
    } else {
      log(`Error updating venue type: ${error.message}`, "red");
    }
  }
}

async function deactivateVenueType(client) {
  log("\n=== Deactivate Venue Type ===", "cyan");

  try {
    const id = await question("Enter venue type ID to deactivate: ");

    const result = await client.query(
      `
      UPDATE venue_types 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING name
    `,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      log("Venue type not found.", "red");
    } else {
      log(`✓ Venue type '${result.rows[0].name}' deactivated`, "yellow");
    }
  } catch (error) {
    log(`Error deactivating venue type: ${error.message}`, "red");
  }
}

async function reactivateVenueType(client) {
  log("\n=== Reactivate Venue Type ===", "cyan");

  try {
    const id = await question("Enter venue type ID to reactivate: ");

    const result = await client.query(
      `
      UPDATE venue_types 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING name
    `,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      log("Venue type not found.", "red");
    } else {
      log(`✓ Venue type '${result.rows[0].name}' reactivated`, "green");
    }
  } catch (error) {
    log(`Error reactivating venue type: ${error.message}`, "red");
  }
}

async function manageSocialMediaTypes() {
  log("\n=== Manage Social Media Types ===", "cyan");
  const client = createDbClient();

  try {
    await client.connect();

    while (true) {
      log("\n1. List social media types", "blue");
      log("2. Add social media type", "green");
      log("3. Update social media type", "yellow");
      log("4. Deactivate social media type", "red");
      log("5. Reactivate social media type", "green");
      log("6. Back to main menu", "reset");

      const choice = await question("Enter your choice (1-6): ");

      switch (choice) {
        case "1":
          await listSocialMediaTypes(client);
          break;
        case "2":
          await addSocialMediaType(client);
          break;
        case "3":
          await updateSocialMediaType(client);
          break;
        case "4":
          await deactivateSocialMediaType(client);
          break;
        case "5":
          await reactivateSocialMediaType(client);
          break;
        case "6":
          return;
        default:
          log("Invalid choice. Please try again.", "red");
      }
    }
  } catch (error) {
    log(`Error: ${error.message}`, "red");
  } finally {
    await client.end();
  }
}

async function listSocialMediaTypes(client) {
  log("\n=== Social Media Types ===", "cyan");

  try {
    const result = await client.query(`
      SELECT id, name, display_name, icon_class, url_template, is_active, sort_order, created_at
      FROM venue_social_types 
      ORDER BY sort_order ASC, display_name ASC
    `);

    if (result.rows.length === 0) {
      log("No social media types found.", "yellow");
      return;
    }

    result.rows.forEach((row) => {
      const status = row.is_active ? "✓" : "✗";
      const icon = row.icon_class ? ` (${row.icon_class})` : "";
      const template = row.url_template ? ` - ${row.url_template}` : "";
      log(
        `${status} [${row.id}] ${row.display_name}${icon}${template} (Order: ${row.sort_order})`,
        row.is_active ? "green" : "red"
      );
    });
  } catch (error) {
    log(`Error listing social media types: ${error.message}`, "red");
  }
}

async function addSocialMediaType(client) {
  log("\n=== Add Social Media Type ===", "cyan");

  try {
    const name = await question("Enter platform name (e.g., 'facebook'): ");
    const displayName = await question(
      "Enter display name (e.g., 'Facebook'): "
    );
    const iconClass = await question(
      "Enter icon class (e.g., 'bi bi-facebook'): "
    );
    const urlTemplate = await question(
      "Enter URL template (e.g., 'https://facebook.com/{handle}'): "
    );
    const sortOrder = await question("Enter sort order (0-999): ");

    if (!name.trim() || !displayName.trim()) {
      log("Name and display name are required.", "red");
      return;
    }

    const result = await client.query(
      `
      INSERT INTO venue_social_types (name, display_name, icon_class, url_template, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING id
    `,
      [
        name.trim(),
        displayName.trim(),
        iconClass.trim() || null,
        urlTemplate.trim() || null,
        parseInt(sortOrder) || 0,
      ]
    );

    log(
      `✓ Social media type '${displayName}' added with ID ${result.rows[0].id}`,
      "green"
    );
  } catch (error) {
    if (error.code === "23505") {
      log("Error: A social media type with this name already exists.", "red");
    } else {
      log(`Error adding social media type: ${error.message}`, "red");
    }
  }
}

async function updateSocialMediaType(client) {
  log("\n=== Update Social Media Type ===", "cyan");

  try {
    const id = await question("Enter social media type ID to update: ");
    const name = await question("Enter new platform name: ");
    const displayName = await question("Enter new display name: ");
    const iconClass = await question("Enter new icon class: ");
    const urlTemplate = await question("Enter new URL template: ");
    const sortOrder = await question("Enter new sort order (0-999): ");

    if (!name.trim() || !displayName.trim()) {
      log("Name and display name are required.", "red");
      return;
    }

    const result = await client.query(
      `
      UPDATE venue_social_types 
      SET name = $1, display_name = $2, icon_class = $3, url_template = $4, sort_order = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING display_name
    `,
      [
        name.trim(),
        displayName.trim(),
        iconClass.trim() || null,
        urlTemplate.trim() || null,
        parseInt(sortOrder) || 0,
        parseInt(id),
      ]
    );

    if (result.rows.length === 0) {
      log("Social media type not found.", "red");
    } else {
      log(
        `✓ Social media type '${result.rows[0].display_name}' updated successfully`,
        "green"
      );
    }
  } catch (error) {
    if (error.code === "23505") {
      log("Error: A social media type with this name already exists.", "red");
    } else {
      log(`Error updating social media type: ${error.message}`, "red");
    }
  }
}

async function deactivateSocialMediaType(client) {
  log("\n=== Deactivate Social Media Type ===", "cyan");

  try {
    const id = await question("Enter social media type ID to deactivate: ");

    const result = await client.query(
      `
      UPDATE venue_social_types 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING display_name
    `,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      log("Social media type not found.", "red");
    } else {
      log(
        `✓ Social media type '${result.rows[0].display_name}' deactivated`,
        "yellow"
      );
    }
  } catch (error) {
    log(`Error deactivating social media type: ${error.message}`, "red");
  }
}

async function reactivateSocialMediaType(client) {
  log("\n=== Reactivate Social Media Type ===", "cyan");

  try {
    const id = await question("Enter social media type ID to reactivate: ");

    const result = await client.query(
      `
      UPDATE venue_social_types 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING display_name
    `,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      log("Social media type not found.", "red");
    } else {
      log(
        `✓ Social media type '${result.rows[0].display_name}' reactivated`,
        "green"
      );
    }
  } catch (error) {
    log(`Error reactivating social media type: ${error.message}`, "red");
  }
}

async function main() {
  try {
    await showServerInstructions();

    // Prisma doesn't need sync - database is already set up
    log("Database connected successfully!", "green");

    while (true) {
      await showMenu();
      const choice = await question("Enter your choice (1-18, q to quit): ");

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
        case "15":
          await manageWhitelistDomains();
          break;
        case "16":
          await manageVenueTypes();
          break;
        case "17":
          await manageSocialMediaTypes();
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

      // Prisma doesn't need sync - database is already set up

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
        case "whitelist-domains":
          await manageWhitelistDomains();
          break;
        default:
          log(`Unknown command: ${command}`, "red");
          log(
            "Available commands: list-users, list-bands, list-songs, delete-links, delete-gig-documents, edit-song, cleanup, stats, merge-artists, whitelist-domains",
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
