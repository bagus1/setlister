/**
 * Migration script to generate share tokens for existing setlists
 * 
 * This script finds all setlists without shareTokens and generates them.
 * 
 * Usage: node scripts/generate-share-tokens.js
 */

const { prisma } = require('../lib/prisma');
const { Prisma } = require('@prisma/client');
const { generateShareTokens } = require('../utils/shareTokens');

async function generateTokensForExistingSetlists() {
  try {
    console.log('Starting share token generation for existing setlists...');
    
    // Find all setlists - we'll check for null tokens in JS
    const setlists = await prisma.setlist.findMany({
      select: {
        id: true,
        title: true,
        shareTokens: true,
      }
    });
    
    // Filter out setlists that need tokens (null, empty, or missing youtube-playlist)
    const expectedViewTypes = ['gig-view', 'final', 'print', 'rehearsal', 'listen', 'playlist', 'youtube-playlist', 'midi', 'leadsheets'];
    const setlistsWithoutTokens = setlists.filter(s => {
      if (!s.shareTokens || (typeof s.shareTokens === 'object' && Object.keys(s.shareTokens).length === 0)) {
        return true;
      }
      // Check if all expected view types exist
      const existingViewTypes = new Set(Object.values(s.shareTokens));
      return !expectedViewTypes.every(vt => existingViewTypes.has(vt));
    });
    
    console.log(`Found ${setlistsWithoutTokens.length} setlists without share tokens (out of ${setlists.length} total)`);
    
    if (setlistsWithoutTokens.length === 0) {
      console.log('No setlists need share tokens. All done!');
      return;
    }
    
    // Generate and update tokens for each setlist
    let successCount = 0;
    let errorCount = 0;
    
    for (const setlist of setlistsWithoutTokens) {
      try {
        const shareTokens = generateShareTokens();
        
        await prisma.setlist.update({
          where: { id: setlist.id },
          data: { shareTokens }
        });
        
        successCount++;
        console.log(`✓ Generated tokens for setlist #${setlist.id}: "${setlist.title}"`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error generating tokens for setlist #${setlist.id}:`, error.message);
      }
    }
    
    console.log('\n=== Migration Complete ===');
    console.log(`Successfully updated: ${successCount} setlists`);
    if (errorCount > 0) {
      console.log(`Errors encountered: ${errorCount} setlists`);
    }
    console.log('==========================\n');
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
generateTokensForExistingSetlists();

