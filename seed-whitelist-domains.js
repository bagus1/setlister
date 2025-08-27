const { prisma } = require("./lib/prisma");

// Common whitelist domains for each link type
const whitelistData = [
  // YouTube and video platforms
  {
    linkType: "youtube",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "youtube",
    domain: "youtu.be",
    pattern: "^https?:\\/\\/youtu\\.be\\/.*$",
  },
  {
    linkType: "video",
    domain: "vimeo.com",
    pattern: "^https?:\\/\\/(www\\.)?vimeo\\.com\\/.*$",
  },
  {
    linkType: "video",
    domain: "dailymotion.com",
    pattern: "^https?:\\/\\/(www\\.)?dailymotion\\.com\\/.*$",
  },

  // Music streaming platforms
  {
    linkType: "spotify",
    domain: "open.spotify.com",
    pattern: "^https?:\\/\\/open\\.spotify\\.com\\/.*$",
  },
  {
    linkType: "apple-music",
    domain: "music.apple.com",
    pattern: "^https?:\\/\\/music\\.apple\\.com\\/.*$",
  },
  {
    linkType: "soundcloud",
    domain: "soundcloud.com",
    pattern: "^https?:\\/\\/(www\\.)?soundcloud\\.com\\/.*$",
  },
  {
    linkType: "bandcamp",
    domain: "bandcamp.com",
    pattern: "^https?:\\/\\/(www\\.)?bandcamp\\.com\\/.*$",
  },

  // Lyrics sites
  {
    linkType: "lyrics",
    domain: "genius.com",
    pattern: "^https?:\\/\\/(www\\.)?genius\\.com\\/.*$",
  },
  {
    linkType: "lyrics",
    domain: "azlyrics.com",
    pattern: "^https?:\\/\\/(www\\.)?azlyrics\\.com\\/.*$",
  },
  {
    linkType: "lyrics",
    domain: "lyrics.com",
    pattern: "^https?:\\/\\/(www\\.)?lyrics\\.com\\/.*$",
  },
  {
    linkType: "lyrics",
    domain: "metrolyrics.com",
    pattern: "^https?:\\/\\/(www\\.)?metrolyrics\\.com\\/.*$",
  },

  // Tab and tutorial sites
  {
    linkType: "tab",
    domain: "ultimate-guitar.com",
    pattern: "^https?:\\/\\/(www\\.)?ultimate-guitar\\.com\\/.*$",
  },
  {
    linkType: "tab",
    domain: "tabs.ultimate-guitar.com",
    pattern: "^https?:\\/\\/tabs\\.ultimate-guitar\\.com\\/.*$",
  },
  {
    linkType: "tab",
    domain: "guitaretab.com",
    pattern: "^https?:\\/\\/(www\\.)?guitaretab\\.com\\/.*$",
  },
  {
    linkType: "tab",
    domain: "e-chords.com",
    pattern: "^https?:\\/\\/(www\\.)?e-chords\\.com\\/.*$",
  },

  {
    linkType: "bass tab",
    domain: "ultimate-guitar.com",
    pattern: "^https?:\\/\\/(www\\.)?ultimate-guitar\\.com\\/.*$",
  },
  {
    linkType: "bass tab",
    domain: "bassmasta.net",
    pattern: "^https?:\\/\\/(www\\.)?bassmasta\\.net\\/.*$",
  },

  {
    linkType: "chords",
    domain: "ultimate-guitar.com",
    pattern: "^https?:\\/\\/(www\\.)?ultimate-guitar\\.com\\/.*$",
  },
  {
    linkType: "chords",
    domain: "e-chords.com",
    pattern: "^https?:\\/\\/(www\\.)?e-chords\\.com\\/.*$",
  },
  {
    linkType: "chords",
    domain: "chordie.com",
    pattern: "^https?:\\/\\/(www\\.)?chordie\\.com\\/.*$",
  },

  // Tutorial sites
  {
    linkType: "guitar tutorial",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "guitar tutorial",
    domain: "guitarlessons.com",
    pattern: "^https?:\\/\\/(www\\.)?guitarlessons\\.com\\/.*$",
  },
  {
    linkType: "guitar tutorial",
    domain: "justinguitar.com",
    pattern: "^https?:\\/\\/(www\\.)?justinguitar\\.com\\/.*$",
  },

  {
    linkType: "bass tutorial",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "bass tutorial",
    domain: "bassbuzz.com",
    pattern: "^https?:\\/\\/(www\\.)?bassbuzz\\.com\\/.*$",
  },

  {
    linkType: "keyboard tutorial",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "keyboard tutorial",
    domain: "pianote.com",
    pattern: "^https?:\\/\\/(www\\.)?pianote\\.com\\/.*$",
  },

  // Audio and sheet music
  {
    linkType: "audio",
    domain: "soundcloud.com",
    pattern: "^https?:\\/\\/(www\\.)?soundcloud\\.com\\/.*$",
  },
  {
    linkType: "audio",
    domain: "bandcamp.com",
    pattern: "^https?:\\/\\/(www\\.)?bandcamp\\.com\\/.*$",
  },
  {
    linkType: "audio",
    domain: "spotify.com",
    pattern: "^https?:\\/\\/(www\\.)?spotify\\.com\\/.*$",
  },

  {
    linkType: "sheet-music",
    domain: "imslp.org",
    pattern: "^https?:\\/\\/(www\\.)?imslp\\.org\\/.*$",
  },
  {
    linkType: "sheet-music",
    domain: "musescore.com",
    pattern: "^https?:\\/\\/(www\\.)?musescore\\.com\\/.*$",
  },
  {
    linkType: "sheet-music",
    domain: "8notes.com",
    pattern: "^https?:\\/\\/(www\\.)?8notes\\.com\\/.*$",
  },

  // Backing tracks and karaoke
  {
    linkType: "backing-track",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "backing-track",
    domain: "karaoke-version.com",
    pattern: "^https?:\\/\\/(www\\.)?karaoke-version\\.com\\/.*$",
  },

  {
    linkType: "karaoke",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "karaoke",
    domain: "karaoke-version.com",
    pattern: "^https?:\\/\\/(www\\.)?karaoke-version\\.com\\/.*$",
  },

  // Horn charts
  {
    linkType: "horn chart",
    domain: "youtube.com",
    pattern: "^https?:\\/\\/(www\\.)?youtube\\.com\\/.*$",
  },
  {
    linkType: "horn chart",
    domain: "jazzleadsheets.com",
    pattern: "^https?:\\/\\/(www\\.)?jazzleadsheets\\.com\\/.*$",
  },
];

async function seedWhitelistDomains() {
  try {
    console.log("🌱 Seeding whitelist domains...");

    let addedCount = 0;
    let skippedCount = 0;

    for (const data of whitelistData) {
      try {
        // Check if this domain already exists for this link type
        const existing = await prisma.whitelistDomain.findFirst({
          where: {
            linkType: data.linkType,
            domain: data.domain,
          },
        });

        if (existing) {
          console.log(
            `⏭️  Skipped: ${data.linkType} - ${data.domain} (already exists)`
          );
          skippedCount++;
          continue;
        }

        // Add new whitelist domain
        await prisma.whitelistDomain.create({
          data: {
            linkType: data.linkType,
            domain: data.domain,
            pattern: data.pattern,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(`✅ Added: ${data.linkType} - ${data.domain}`);
        addedCount++;
      } catch (error) {
        console.error(
          `❌ Error adding ${data.linkType} - ${data.domain}:`,
          error.message
        );
      }
    }

    console.log(`\n🎉 Seeding complete!`);
    console.log(`   Added: ${addedCount} new domains`);
    console.log(`   Skipped: ${skippedCount} existing domains`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedWhitelistDomains();
