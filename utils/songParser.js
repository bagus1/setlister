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
    complexity: "simple", // Track complexity level
    message: null, // Optional message for user
  };

  // Check complexity - if too many lines or complex patterns, suggest simplification
  if (lines.length > 50) {
    result.complexity = "high";
    result.message =
      "Hey pardner, please try simplifying that list so it's just songs and artists. This list is quite long and might be hard to parse correctly.";
  }

  let unparseableLines = 0;
  let totalLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    totalLines++;

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
      // Only parse as song if it's not empty and doesn't look like a set separator
      if (line && !isSetSeparator(line)) {
        const song = parseSongLine(line, i + 1);
        if (song) {
          result.currentSet.songs.push(song);
        } else {
          unparseableLines++;
        }
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

  // Check parsing success rate
  const parseRate = (totalLines - unparseableLines) / totalLines;
  if (parseRate < 0.7 && totalLines > 10) {
    result.complexity = "medium";
    result.message =
      "Hey pardner, please try simplifying that list so it's just songs and artists. Some lines couldn't be parsed properly.";
  }

  return result;
}

/**
 * Check if a line is a set separator
 * @param {string} line - Line to check
 * @returns {boolean} True if line is a set separator
 */
function isSetSeparator(line) {
  // Simple set detection - just look for common patterns
  const lineLower = line.toLowerCase().trim();

  // Basic set patterns
  if (
    lineLower.startsWith("set ") ||
    lineLower.includes("set") ||
    lineLower.match(/^\d+[a-z]*\s+set/i) ||
    lineLower.match(/^[a-z]+\s+set/i)
  ) {
    return true;
  }

  // Separator lines
  if (/^[-=_#]{3,}$/.test(line)) {
    return true;
  }

  return false;
}

/**
 * Extract set name from separator line
 * @param {string} line - Set separator line
 * @param {number} fallbackNumber - Fallback set number
 * @returns {string} Set name
 */
function extractSetNumber(line, fallbackNumber) {
  // Simple set name extraction
  const lineLower = line.toLowerCase().trim();

  // Try to extract a number
  const numberMatch = lineLower.match(/(\d+)/);
  if (numberMatch) {
    return `Set ${numberMatch[1]}`;
  }

  // Handle ordinal sets (1st, 2nd, etc.)
  const ordinalMatch = lineLower.match(/(\d+)(?:st|nd|rd|th)/);
  if (ordinalMatch) {
    return `Set ${ordinalMatch[1]}`;
  }

  // Handle word-based sets
  const wordMatch = lineLower.match(/(first|second|third|fourth|fifth)/);
  if (wordMatch) {
    const wordToNumber = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
    return `Set ${wordToNumber[wordMatch[1]]}`;
  }

  // Default fallback
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

  // Handle tab-separated data (like from Wikipedia tables)
  if (cleanLine.includes("\t")) {
    const parts = cleanLine.split("\t").map((part) => part.trim());

    if (parts.length >= 1) {
      let title = parts[0];
      let artist = "";

      // Remove quotes from title
      title = title.replace(/^["']|["']$/g, "");

      // Look for artist in subsequent columns, but skip date/time columns
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];

        // Skip empty parts
        if (!part) continue;

        // Skip if this looks like a date or time
        if (isDateOrTime(part)) {
          continue;
        }

        // If we haven't found an artist yet and this doesn't look like metadata, use it
        if (!artist && !isMetadata(part)) {
          artist = part;
          break;
        }
      }

      return {
        lineNumber,
        originalLine: line,
        title: normalizeTitle(title),
        artist: normalizeArtist(artist),
        confidence: "unknown",
      };
    }
  }

  // Simple separator handling - just the basics
  let title = cleanLine;
  let artist = "";

  // Try common separators in order
  if (cleanLine.includes(" - ")) {
    const parts = cleanLine.split(" - ", 2);
    title = parts[0].trim();
    artist = parts[1].trim();
  } else if (cleanLine.includes(",")) {
    const parts = cleanLine.split(",", 2);
    if (parts.length === 2) {
      title = parts[0].trim();
      artist = parts[1].trim();
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
    confidence: "unknown",
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
    .replace(/[^\w\s()']/g, " ") // Replace punctuation with spaces, but preserve parentheses and apostrophes
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
    .replace(/[^\w\s()]/g, " ") // Replace punctuation with spaces, but preserve parentheses
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
        title: { [require("sequelize").Op.like]: song.title },
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

    // Always try fuzzy matching to find similar songs
    const fuzzyMatches = await findFuzzyMatches(song);
    matches.push(...fuzzyMatches);

    // Sort by confidence score
    matches.sort((a, b) => a.score - b.score);

    // Determine if this is likely a new song
    // A song is considered "new" only if we have no matches at all
    // If we have matches, even fuzzy ones, we'll show them as options
    const isNewSong = matches.length === 0;

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
 * Find fuzzy matches using a scalable multi-query approach
 * @param {Object} song - Parsed song object
 * @returns {Array} Array of fuzzy matches
 */
async function findFuzzyMatches(song) {
  const matches = [];
  const { Op } = require("sequelize");

  try {
    // Step 1: Try exact title matches (fastest)
    const exactMatches = await Song.findAll({
      include: [{ model: Artist, as: "Artists" }],
      where: {
        title: { [Op.like]: song.title },
      },
      limit: 5,
    });

    for (const match of exactMatches) {
      const artistMatch =
        match.Artists && match.Artists.length > 0
          ? match.Artists[0].name.toLowerCase() === song.artist
          : !song.artist;

      matches.push({
        song: match,
        confidence: "exact",
        score: 1.0,
        reason: artistMatch
          ? "Exact title and artist match"
          : "Exact title match",
      });
    }

    // If we found exact matches, return them (no need for fuzzy matching)
    if (exactMatches.length > 0) {
      console.log(
        `Found ${exactMatches.length} exact matches for "${song.title}"`
      );
      return matches;
    }

    // Step 2: Try partial matches with LIKE (medium speed)
    const partialMatches = await Song.findAll({
      include: [{ model: Artist, as: "Artists" }],
      where: {
        title: { [Op.like]: `%${song.title}%` },
      },
      limit: 20,
    });

    for (const match of partialMatches) {
      const titleSimilarity = calculateTitleSimilarity(song.title, match.title);
      const artistMatch =
        match.Artists && match.Artists.length > 0
          ? match.Artists[0].name.toLowerCase() === song.artist
          : !song.artist;

      const score = titleSimilarity * 0.8 + (artistMatch ? 0.2 : 0.0);

      if (score > 0.4) {
        matches.push({
          song: match,
          confidence: "partial",
          score: score,
          reason: `Partial title match (${Math.round((1 - titleSimilarity) * 100)}% different)`,
        });
      }
    }

    // Step 3: Always run similarity search for better fuzzy matching
    console.log(
      `Running similarity search for "${song.title}" to find close matches`
    );

    // Get a subset of songs for similarity calculation
    const candidateSongs = await Song.findAll({
      include: [{ model: Artist, as: "Artists" }],
      limit: 200, // Increased limit to catch more potential matches
    });

    // Calculate similarity for candidates
    const similarityMatches = [];
    for (const match of candidateSongs) {
      const titleSimilarity = calculateTitleSimilarity(song.title, match.title);

      if (titleSimilarity > 0.3) {
        similarityMatches.push({
          song: match,
          similarity: titleSimilarity,
        });
      }
    }

    // Sort by similarity and take top matches
    similarityMatches.sort((a, b) => b.similarity - a.similarity);
    const topSimilarityMatches = similarityMatches.slice(0, 10); // Increased to 10

    for (const match of topSimilarityMatches) {
      const artistMatch =
        match.song.Artists && match.song.Artists.length > 0
          ? match.song.Artists[0].name.toLowerCase() === song.artist
          : !song.artist;

      const score = match.similarity * 0.8 + (artistMatch ? 0.2 : 0.0);

      if (score > 0.3) {
        matches.push({
          song: match.song,
          confidence: "similarity",
          score: score,
          reason: `Similar title (${Math.round((1 - match.similarity) * 100)}% different)`,
        });
      }
    }

    console.log(`Total matches found for "${song.title}": ${matches.length}`);
  } catch (error) {
    console.error("Error finding fuzzy matches:", error);
  }

  return matches;
}

/**
 * Check if a string looks like a date or time
 * @param {string} str - String to check
 * @returns {boolean} True if it looks like a date or time
 */
function isDateOrTime(str) {
  if (!str) return false;

  // Check for time patterns (4:38, 5:32, etc.)
  if (/^\d{1,2}:\d{2}$/.test(str)) return true;

  // Check for date patterns (December 31, Dec 31, etc.)
  const monthPatterns = [
    /^january\s+\d{1,2}$/i,
    /^february\s+\d{1,2}$/i,
    /^march\s+\d{1,2}$/i,
    /^april\s+\d{1,2}$/i,
    /^may\s+\d{1,2}$/i,
    /^june\s+\d{1,2}$/i,
    /^july\s+\d{1,2}$/i,
    /^august\s+\d{1,2}$/i,
    /^september\s+\d{1,2}$/i,
    /^october\s+\d{1,2}$/i,
    /^november\s+\d{1,2}$/i,
    /^december\s+\d{1,2}$/i,
    /^jan\s+\d{1,2}$/i,
    /^feb\s+\d{1,2}$/i,
    /^mar\s+\d{1,2}$/i,
    /^apr\s+\d{1,2}$/i,
    /^jun\s+\d{1,2}$/i,
    /^jul\s+\d{1,2}$/i,
    /^aug\s+\d{1,2}$/i,
    /^sep\s+\d{1,2}$/i,
    /^oct\s+\d{1,2}$/i,
    /^nov\s+\d{1,2}$/i,
    /^dec\s+\d{1,2}$/i,
  ];

  return monthPatterns.some((pattern) => pattern.test(str));
}

/**
 * Check if a string looks like metadata (not an artist name)
 * @param {string} str - String to check
 * @returns {boolean} True if it looks like metadata
 */
function isMetadata(str) {
  if (!str) return false;

  // Empty or very short strings
  if (str.length < 2) return true;

  // Numbers only
  if (/^\d+$/.test(str)) return true;

  // Very long strings (likely not artist names)
  if (str.length > 50) return true;

  // Contains typical metadata indicators
  const metadataPatterns = [
    /^\d+:\d{2}$/, // Time
    /^\d+$/, // Just numbers
    /^[a-z]+\s+\d{1,2}$/i, // Month + day
    /^[a-z]{3}\s+\d{1,2}$/i, // Abbreviated month + day
  ];

  return metadataPatterns.some((pattern) => pattern.test(str));
}

/**
 * Try to extract potential artist information from the original line
 * @param {string} originalLine - The original line text
 * @param {string} title - The extracted title
 * @returns {string} Potential artist name or empty string
 */
function extractPotentialArtist(originalLine, title) {
  // Remove the title from the line to see what's left
  let remaining = originalLine.replace(title, "").trim();

  // Remove quotes and common separators
  remaining = remaining.replace(/^["']|["']$/g, "").trim();

  // Split by tabs and look for non-metadata parts
  const parts = remaining
    .split("\t")
    .map((part) => part.trim())
    .filter((part) => part);

  for (const part of parts) {
    if (!isDateOrTime(part) && !isMetadata(part) && part.length > 2) {
      return part;
    }
  }

  return "";
}

/**
 * Convert a string to title case (first letter of each word capitalized)
 * @param {string} str - String to titleize
 * @returns {string} Titleized string
 */
function titleize(str) {
  if (!str) return "";

  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Calculate similarity between two strings (improved implementation)
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

  // If we have common words, use word-based similarity
  if (commonWords.length > 0) {
    return commonWords.length / totalWords;
  }

  // For single words or no common words, use character-level similarity
  if (words1.length === 1 && words2.length === 1) {
    return calculateCharacterSimilarity(s1, s2);
  }

  return 0.0;
}

/**
 * Calculate character-level similarity using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, higher is more similar)
 */
function calculateCharacterSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  // If lengths are very different, similarity is low
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0.0;
  }

  // Calculate Levenshtein distance
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);

  // Convert distance to similarity score (0-1)
  // Distance 0 = similarity 1.0, Distance maxLen = similarity 0.0
  return Math.max(0, 1 - distance / maxLen);
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
  parseSongLine,
  isSetSeparator,
  titleize,
};
