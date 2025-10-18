const fs = require('fs');
const path = require('path');

// Load 4-letter words from file
let words = [];
const wordsPath = path.join(__dirname, 'words.txt');

try {
  const fileContent = fs.readFileSync(wordsPath, 'utf8');
  words = fileContent
    .split('\n')
    .map(w => w.trim())
    .filter(w => w.length === 4); // Only 4-letter words
  
  console.log(`Loaded ${words.length} 4-letter words for share tokens`);
} catch (error) {
  console.error('Error loading words file:', error);
  // Fallback to some default words if file load fails
  words = ['SONG', 'BAND', 'PLAY', 'TUNE', 'ROCK', 'JAZZ', 'BEAT', 'NOTE'];
}

/**
 * Get a random 4-letter word from the list
 * @param {Set} excludeWords - Set of words to exclude (already used)
 * @returns {string} - Random word in lowercase
 */
function getRandomWord(excludeWords = new Set()) {
  const availableWords = words.filter(w => !excludeWords.has(w.toLowerCase()));
  
  if (availableWords.length === 0) {
    throw new Error('No available words left for token generation');
  }
  
  const randomIndex = Math.floor(Math.random() * availableWords.length);
  return availableWords[randomIndex].toLowerCase();
}

/**
 * Generate share tokens for all public view types
 * @returns {Object} - Mapping of token -> view type
 */
function generateShareTokens() {
  const viewTypes = [
    'gig-view',
    'final',
    'print',
    'rehearsal',
    'listen',
    'playlist',
    'youtube-playlist',
    'midi',
    'leadsheets'
  ];
  
  const tokens = {};
  const usedWords = new Set();
  
  for (const viewType of viewTypes) {
    const word = getRandomWord(usedWords);
    tokens[word] = viewType;
    usedWords.add(word);
  }
  
  return tokens;
}

/**
 * Validate if a token is valid for a setlist
 * @param {Object} shareTokens - The setlist's shareTokens JSON object
 * @param {string} token - The token to validate
 * @returns {string|null} - View type if valid, null otherwise
 */
function getViewTypeFromToken(shareTokens, token) {
  if (!shareTokens || typeof shareTokens !== 'object') {
    return null;
  }
  
  return shareTokens[token] || null;
}

/**
 * Get token for a specific view type
 * @param {Object} shareTokens - The setlist's shareTokens JSON object
 * @param {string} viewType - The view type to get token for
 * @returns {string|null} - Token if found, null otherwise
 */
function getTokenForViewType(shareTokens, viewType) {
  if (!shareTokens || typeof shareTokens !== 'object') {
    return null;
  }
  
  for (const [token, view] of Object.entries(shareTokens)) {
    if (view === viewType) {
      return token;
    }
  }
  
  return null;
}

module.exports = {
  generateShareTokens,
  getViewTypeFromToken,
  getTokenForViewType,
  getRandomWord
};

