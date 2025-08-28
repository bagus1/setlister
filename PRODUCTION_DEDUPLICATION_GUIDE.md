# Production Deduplication Guide

This guide provides safe scripts and procedures for identifying and removing duplicate songs in the production database.

## ⚠️ SAFETY FIRST

**ALWAYS run reports first before any deletions!** These scripts are designed to analyze first, then optionally delete in separate steps.

## 🔍 Step 1: Generate Reports

### General Duplicate Report

```javascript
// report-duplicates.js
const { prisma } = require("./lib/prisma");

async function reportDuplicates() {
  console.log("🔍 PRODUCTION DUPLICATE ANALYSIS REPORT\n");
  console.log("Generated:", new Date().toISOString());
  console.log("=====================================\n");

  try {
    // Find songs with same title and artist
    const songsWithArtists = await prisma.song.findMany({
      include: {
        artists: { include: { artist: true } },
        links: true,
        gigDocuments: true,
        setlistSongs: true,
        bandSongs: true,
      },
      where: {
        artists: { some: {} },
      },
    });

    const titleArtistGroups = {};
    songsWithArtists.forEach((song) => {
      const key = `${song.title.toLowerCase()}|||${song.artists[0].artist.name.toLowerCase()}`;
      if (!titleArtistGroups[key]) titleArtistGroups[key] = [];
      titleArtistGroups[key].push(song);
    });

    const duplicateGroups = Object.values(titleArtistGroups).filter(
      (group) => group.length > 1
    );

    console.log(
      `📊 SONGS WITH ARTISTS: Found ${duplicateGroups.length} duplicate groups\n`
    );

    duplicateGroups.forEach((group, i) => {
      console.log(
        `Group ${i + 1}: "${group[0].title}" by ${group[0].artists[0].artist.name}`
      );
      group.forEach((song) => {
        const usage =
          song.links.length +
          song.gigDocuments.length +
          song.setlistSongs.length;
        console.log(
          `  ID ${song.id}: "${song.title}" - Usage Score: ${usage} (${song.links.length} links, ${song.gigDocuments.length} gig docs, ${song.setlistSongs.length} setlists)`
        );
      });
      console.log("");
    });

    // Find songs without artists (duplicates by title only)
    const songsWithoutArtists = await prisma.song.findMany({
      include: {
        artists: true,
        links: true,
        gigDocuments: true,
        setlistSongs: true,
        bandSongs: true,
      },
      where: {
        artists: { none: {} },
      },
    });

    const titleOnlyGroups = {};
    songsWithoutArtists.forEach((song) => {
      const key = song.title.toLowerCase();
      if (!titleOnlyGroups[key]) titleOnlyGroups[key] = [];
      titleOnlyGroups[key].push(song);
    });

    const duplicateTitleOnlyGroups = Object.values(titleOnlyGroups).filter(
      (group) => group.length > 1
    );

    console.log(
      `📊 SONGS WITHOUT ARTISTS: Found ${duplicateTitleOnlyGroups.length} duplicate groups\n`
    );

    duplicateTitleOnlyGroups.forEach((group, i) => {
      console.log(`Group ${i + 1}: "${group[0].title}" (no artist)`);
      group.forEach((song) => {
        const usage =
          song.links.length +
          song.gigDocuments.length +
          song.setlistSongs.length;
        console.log(
          `  ID ${song.id}: "${song.title}" - Usage Score: ${usage} (${song.links.length} links, ${song.gigDocuments.length} gig docs, ${song.setlistSongs.length} setlists)`
        );
      });
      console.log("");
    });

    // Find artist vs no-artist conflicts
    const artistlessConflicts = [];
    songsWithoutArtists.forEach((artistlessSong) => {
      const conflictingSongs = songsWithArtists.filter(
        (artistSong) =>
          artistSong.title.toLowerCase() === artistlessSong.title.toLowerCase()
      );
      if (conflictingSongs.length > 0) {
        artistlessConflicts.push({
          artistless: artistlessSong,
          withArtists: conflictingSongs,
        });
      }
    });

    console.log(
      `📊 ARTIST vs NO-ARTIST CONFLICTS: Found ${artistlessConflicts.length} conflicts\n`
    );

    artistlessConflicts.forEach((conflict, i) => {
      console.log(`Conflict ${i + 1}: "${conflict.artistless.title}"`);
      const usage =
        conflict.artistless.links.length +
        conflict.artistless.gigDocuments.length +
        conflict.artistless.setlistSongs.length;
      console.log(
        `  ID ${conflict.artistless.id}: (no artist) - Usage Score: ${usage}`
      );

      conflict.withArtists.forEach((song) => {
        const usage =
          song.links.length +
          song.gigDocuments.length +
          song.setlistSongs.length;
        console.log(
          `  ID ${song.id}: by ${song.artists[0].artist.name} - Usage Score: ${usage}`
        );
      });
      console.log("");
    });

    console.log("📋 SUMMARY");
    console.log("==========");
    console.log(
      `• ${duplicateGroups.length} duplicate groups (same title + artist)`
    );
    console.log(
      `• ${duplicateTitleOnlyGroups.length} duplicate groups (same title, no artist)`
    );
    console.log(
      `• ${artistlessConflicts.length} artist vs no-artist conflicts`
    );

    const totalDuplicates =
      duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0) +
      duplicateTitleOnlyGroups.reduce(
        (sum, group) => sum + group.length - 1,
        0
      ) +
      artistlessConflicts.length;

    console.log(`• ~${totalDuplicates} songs could potentially be removed`);
  } catch (error) {
    console.error("❌ Error generating report:", error);
  } finally {
    await prisma.$disconnect();
  }
}

reportDuplicates();
```

### Case-Insensitive Duplicate Report

```javascript
// report-case-duplicates.js
const { prisma } = require("./lib/prisma");

async function reportCaseDuplicates() {
  console.log("🔍 CASE-INSENSITIVE DUPLICATE ANALYSIS REPORT\n");
  console.log("Generated:", new Date().toISOString());
  console.log("==========================================\n");

  try {
    const allSongs = await prisma.song.findMany({
      include: {
        artists: { include: { artist: true } },
        links: true,
        gigDocuments: true,
        setlistSongs: true,
        bandSongs: true,
      },
    });

    // Group by normalized title (case-insensitive)
    const titleGroups = {};
    allSongs.forEach((song) => {
      const normalizedTitle = song.title.toLowerCase().trim();
      if (!titleGroups[normalizedTitle]) titleGroups[normalizedTitle] = [];
      titleGroups[normalizedTitle].push(song);
    });

    // Find groups with different casing
    const caseConflicts = Object.values(titleGroups).filter((group) => {
      if (group.length <= 1) return false;
      const uniqueTitles = new Set(group.map((s) => s.title));
      return uniqueTitles.size > 1; // Different casing exists
    });

    console.log(
      `📊 CASE CONFLICTS: Found ${caseConflicts.length} groups with casing differences\n`
    );

    caseConflicts.forEach((group, i) => {
      console.log(
        `Group ${i + 1}: Various casings of "${group[0].title.toLowerCase()}"`
      );

      group.forEach((song) => {
        const artistName = song.artists[0]?.artist?.name || "(no artist)";
        const usage =
          song.links.length +
          song.gigDocuments.length +
          song.setlistSongs.length;
        const isProperCase =
          /^[A-Z]/.test(song.title) && !/^[A-Z ]+$/.test(song.title);
        const caseNote = isProperCase ? "✅ Good case" : "❌ Poor case";

        console.log(
          `  ID ${song.id}: "${song.title}" by ${artistName} - Usage: ${usage} - ${caseNote}`
        );
      });
      console.log("");
    });

    console.log("📋 SUMMARY");
    console.log("==========");
    console.log(`• ${caseConflicts.length} groups with casing conflicts`);
    const totalCaseIssues = caseConflicts.reduce(
      (sum, group) => sum + group.length - 1,
      0
    );
    console.log(
      `• ~${totalCaseIssues} songs with poor casing could be removed`
    );
  } catch (error) {
    console.error("❌ Error generating case report:", error);
  } finally {
    await prisma.$disconnect();
  }
}

reportCaseDuplicates();
```

## 📋 Step 2: Review Reports

1. **Save report output** to files for analysis:

   ```bash
   node report-duplicates.js > duplicates-report-$(date +%Y%m%d-%H%M).txt
   node report-case-duplicates.js > case-duplicates-report-$(date +%Y%m%d-%H%M).txt
   ```

2. **Review the reports** carefully:
   - Check usage scores (links + gig docs + setlists)
   - Identify which songs are actually being used
   - Look for obvious typos vs intentional variations

3. **Make manual decisions** about which songs to keep

## 🗑️ Step 3: Execute Cleanup (ONLY AFTER REVIEW!)

### Safe Cleanup Script Template

```javascript
// cleanup-production-duplicates.js
const { prisma } = require("./lib/prisma");

async function cleanupProductionDuplicates() {
  // ⚠️ MANUALLY SPECIFY IDs TO DELETE AFTER REVIEWING REPORTS
  const songsToDelete = [
    // Add specific IDs here after manual review
    // Example: 123, 456, 789
  ];

  if (songsToDelete.length === 0) {
    console.log(
      "❌ No song IDs specified for deletion. Edit this script first!"
    );
    return;
  }

  console.log("🚨 PRODUCTION CLEANUP - DELETING SONGS");
  console.log("====================================");
  console.log(
    `Will delete ${songsToDelete.length} songs: ${songsToDelete.join(", ")}\n`
  );

  try {
    for (const songId of songsToDelete) {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        include: { artists: { include: { artist: true } } },
      });

      if (!song) {
        console.log(`⚠️  Song ${songId} not found, skipping`);
        continue;
      }

      const artistName = song.artists[0]?.artist?.name || "(no artist)";
      console.log(
        `🗑️  Deleting "${song.title}" by ${artistName} (ID: ${songId})`
      );

      // Delete all foreign key references
      await prisma.setlistSong.deleteMany({ where: { songId } });
      await prisma.bandSong.deleteMany({ where: { songId } });
      await prisma.songArtist.deleteMany({ where: { songId } });
      await prisma.link.deleteMany({ where: { songId } });
      await prisma.medleySong.deleteMany({ where: { songId } });
      await prisma.gigDocument.deleteMany({ where: { songId } });

      // Delete the song
      await prisma.song.delete({ where: { id: songId } });
      console.log(`     ✅ Deleted song ${songId}`);
    }

    console.log(
      `\n🎉 Cleanup completed! Removed ${songsToDelete.length} songs.`
    );
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupProductionDuplicates();
```

## 🚀 Deployment Process

1. **Upload scripts** to production server
2. **Run reports first**:
   ```bash
   node report-duplicates.js
   node report-case-duplicates.js
   ```
3. **Download and review** report outputs locally
4. **Edit cleanup script** with specific IDs to delete
5. **Upload modified cleanup script**
6. **Run cleanup** (after thorough review)
7. **Verify results** with final report

## 🔄 Regular Maintenance

Consider running reports monthly to catch new duplicates early:

```bash
# Add to crontab or run manually
node report-duplicates.js > /path/to/reports/duplicates-$(date +%Y%m%d).txt
```

## 📁 File Organization

Keep all deduplication files in a `dedup/` folder:

```
dedup/
├── report-duplicates.js
├── report-case-duplicates.js
├── cleanup-production-duplicates.js
└── reports/
    ├── duplicates-20240101-1200.txt
    ├── case-duplicates-20240101-1200.txt
    └── ...
```

---

**Remember**: These scripts are designed for safety. Always analyze reports before making any changes to production data!
