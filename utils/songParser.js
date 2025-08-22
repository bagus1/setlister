const { Song, Artist } = require("../models");

/**
 * Parse a song list input and detect sets
 * @param {string} input - Raw input text from user
 * @returns {Object} Parsed result with sets and songs
 */
function parseSongList(input) {
  const lines = input
    .trim()
    .split("\n")
    .filter((line) => line.trim());
  const result = {
    sets: [],
    currentSet: { name: "Set 1", songs: [] },
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if this line is a set separator
    if (isSetSeparator(line)) {
      // Save current set if it has songs
      if (result.currentSet.songs.length > 0) {
        result.sets.push({ ...result.currentSet });
      }

      // Start new set
      const setNumber = extractSetNumber(line, result.sets.length + 1);
      result.currentSet = { name: setNumber, songs: [] };
    } else {
      // Parse song line
      const song = parseSongLine(line, i + 1);
      if (song) {
        result.currentSet.songs.push(song);
      }
    }
  }

  // Add the last set
  if (result.currentSet.songs.length > 0) {
    result.sets.push(result.currentSet);
  }

  // If no sets were detected, put everything in a default set
  if (result.sets.length === 0) {
    result.sets.push({ name: "Set 1", songs: [] });
  }

  return result;
}

/**
 * Check if a line is a set separator
 * @param {string} line - Line to check
 * @returns {boolean} True if line is a set separator
 */
function isSetSeparator(line) {
  const setPatterns = [
    /^(?:Set\s*)?(\d+|[1-9](?:st|nd|rd|th)?|first|second|third|fourth|fifth)/i,
    /^[-=_#]{3,}$/, // Separator lines like ----, ====, _____, #####
    /^set\s+(?:one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /^first\s+set|second\s+set|third\s+set|fourth\s+set|fifth\s+set/i,
  ];

  return setPatterns.some((pattern) => pattern.test(line));
}

/**
 * Extract set name from separator line
 * @param {string} line - Set separator line
 * @param {number} fallbackNumber - Fallback set number
 * @returns {string} Set name
 */
function extractSetNumber(line, fallbackNumber) {
  // Handle numbered sets
  const numberMatch = line.match(/^set\s*(\d+)/i);
  if (numberMatch) {
    return `Set ${numberMatch[1]}`;
  }

  // Handle ordinal sets
  const ordinalMatch = line.match(/^(\d+)(?:st|nd|rd|th)/i);
  if (ordinalMatch) {
    return `Set ${ordinalMatch[1]}`;
  }

  // Handle word-based sets
  const wordMatch = line.match(
    /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+set/i
  );
  if (wordMatch) {
    const wordToNumber = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
      sixth: 6,
      seventh: 7,
      eighth: 8,
      ninth: 9,
      tenth: 10,
    };
    return `Set ${wordToNumber[wordMatch[1].toLowerCase()]}`;
  }

  // Handle separator lines
  if (/^[-=_#]{3,}$/.test(line)) {
    return `Set ${fallbackNumber}`;
  }

  return `Set ${fallbackNumber}`;
}

/**
 * Parse a single song line
 * @param {string} line - Line containing song information
 * @param {number} lineNumber - Line number for error reporting
 * @returns {Object|null} Parsed song object or null if invalid
 */
function parseSongLine(line, lineNumber) {
  // Remove line numbers and common prefixes
  let cleanLine = line.replace(/^\d+\.?\s*/, "").trim();

  if (!cleanLine) return null;

  // Try different separators for title-artist separation
  const separators = [" - ", " : ", " by ", ", "];
  let title = cleanLine;
  let artist = "";

  for (const separator of separators) {
    if (cleanLine.includes(separator)) {
      const parts = cleanLine.split(separator, 2);
      title = parts[0].trim();
      artist = parts[1].trim();
      break;
    }
  }

  // Clean up title and artist
  title = normalizeTitle(title);
  artist = normalizeArtist(artist);

  return {
    lineNumber,
    originalLine: line,
    title,
    artist,
    confidence: "unknown", // Will be set during matching
  };
}

/**
 * Normalize song title for matching
 * @param {string} title - Raw title
 * @returns {string} Normalized title
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/^the\s+/i, "") // Remove leading "The"
    .replace(/^a\s+/i, "") // Remove leading "A"
    .replace(/^an\s+/i, "") // Remove leading "An"
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Normalize artist name for matching
 * @param {string} artist - Raw artist
 * @returns {string} Normalized artist
 */
function normalizeArtist(artist) {
  if (!artist) return "";

  return artist
    .toLowerCase()
    .replace(/^the\s+/i, "") // Remove leading "The"
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Find matches for a song in the database
 * @param {Object} song - Parsed song object
 * @returns {Object} Matching results
 */
async function findSongMatches(song) {
  const matches = [];

  try {
    // First, try exact title matches
    const exactTitleMatches = await Song.findAll({
      include: [{ model: Artist, as: "Artists" }],
      where: {
        title: { [require("sequelize").Op.iLike]: song.title },
      },
    });

    for (const match of exactTitleMatches) {
      const artistMatch =
        match.Artists && match.Artists.length > 0
          ? match.Artists[0].name.toLowerCase() === song.artist
          : !song.artist;

      matches.push({
        song: match,
        confidence: artistMatch ? "exact" : "title-only",
        score: artistMatch ? 0.0 : 0.2,
        reason: artistMatch
          ? "Exact title and artist match"
          : "Exact title match, different artist",
      });
    }

    // If no exact matches, try fuzzy matching
    if (matches.length === 0) {
      const fuzzyMatches = await findFuzzyMatches(song);
      matches.push(...fuzzyMatches);
    }

    // Sort by confidence score
    matches.sort((a, b) => a.score - b.score);

    // Determine if this is likely a new song
    const isNewSong = matches.length === 0 || matches[0].score > 0.6;

    return {
      matches,
      isNewSong,
      bestMatch: matches.length > 0 ? matches[0] : null,
      confidence: isNewSong ? "new" : matches[0].confidence,
    };
  } catch (error) {
    console.error("Error finding song matches:", error);
    return {
      matches: [],
      isNewSong: true,
      bestMatch: null,
      confidence: "error",
    };
  }
}

/**
 * Find fuzzy matches using LIKE queries
 * @param {Object} song - Parsed song object
 * @returns {Array} Array of fuzzy matches
 */
async function findFuzzyMatches(song) {
  const matches = [];
  const { Op } = require("sequelize");

  try {
    // Try partial title matches
    const partialMatches = await Song.findAll({
      include: [{ model: Artist, as: "Artists" }],
      where: {
        title: { [Op.iLike]: `%${song.title}%` },
      },
      limit: 10,
    });

    for (const match of partialMatches) {
      const titleSimilarity = calculateTitleSimilarity(song.title, match.title);
      const artistMatch =
        match.Artists && match.Artists.length > 0
          ? match.Artists[0].name.toLowerCase() === song.artist
          : !song.artist;

      const score = titleSimilarity + (artistMatch ? 0.0 : 0.3);

      if (score < 0.8) {
        // Only include reasonably close matches
        matches.push({
          song: match,
          confidence: "fuzzy",
          score: score,
          reason: `Partial title match (${Math.round((1 - score) * 100)}% different)`,
        });
      }
    }

    // Try artist-based matches if we have an artist
    if (song.artist) {
      const artistMatches = await Song.findAll({
        include: [{ model: Artist, as: "Artists" }],
      });

      for (const match of artistMatches) {
        if (match.Artists && match.Artists.length > 0) {
          const artistSimilarity = calculateArtistSimilarity(
            song.artist,
            match.Artists[0].name
          );
          if (artistSimilarity > 0.7) {
            // Good artist match
            const titleSimilarity = calculateTitleSimilarity(
              song.title,
              match.title
            );
            const score = (titleSimilarity + artistSimilarity) / 2;

            if (score < 0.8) {
              matches.push({
                song: match,
                confidence: "artist-based",
                score: score,
                reason: `Similar artist (${match.Artists[0].name})`,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error finding fuzzy matches:", error);
  }

  return matches;
}

/**
 * Calculate similarity between two strings (simple implementation)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, higher is more similar)
 */
function calculateTitleSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Simple word-based similarity
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const commonWords = words1.filter((word) => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);

  return commonWords.length / totalWords;
}

/**
 * Calculate artist similarity
 * @param {string} artist1 - First artist
 * @param {string} artist2 - Second artist
 * @returns {number} Similarity score
 */
function calculateArtistSimilarity(artist1, artist2) {
  const a1 = artist1.toLowerCase();
  const a2 = artist2.toLowerCase();

  if (a1 === a2) return 1.0;
  if (a1.includes(a2) || a2.includes(a1)) return 0.9;

  // Handle "The" prefix variations
  if (a1 === `the ${a2}` || a2 === `the ${a1}`) return 0.95;

  return 0.0;
}

module.exports = {
  parseSongList,
  findSongMatches,
  normalizeTitle,
  normalizeArtist,
};
