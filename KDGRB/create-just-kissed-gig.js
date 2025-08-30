const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createJustKissedGig() {
  try {
    console.log('Creating gig document for "Just Kissed My Baby"...');
    
    // Song content (excluding title and cleaning up)
    const songContent = `guitar riffs: e f Gb G fgf, Bb Bb..
bass comes in. e f Gb g G FG. organ comes in.

I feel like a king, yeah ,'Cause I just kissed my baby
And money don't mean a thing to me, no, 'Cause I just kissed my baby
Feels so good, ha, That I just kissed my baby
Well, well, well I'm no [?], 'Cause I just kissed by baby

2x more..

Gb    G    Ab   A walkup, then 
                                GAbAa, d c d e c a riff. 
Well, well, well, ya
I know I can't go wrong
All we ever do, ha
Is decide to get along, yeah

G
I feel brand new, 'Cause I just kissed by baby
And I'm going back to nothing to do, 'Cause I just kissed by baby
And I feel so doggone great, just can't wait, Just kissed by baby
Me and my girl need to hibernate, 'Cause I just kissed by baby

4x more g,

Well, well, well Just kissed my baby, Just kissed my baby
Just kissed my baby, Just kissed my baby
Just kissed my baby, Just kissed my baby
Just kissed my baby, Just kissed my baby, Wait on
2x g

G
I feel so good inside, Just kissed by baby
I was on my side, that's a bad day,
'Cause I just kissed by baby, Just got so bad,
Just kissed my baby, I keep on, 
Just kissed by baby
Just kissed my baby, Keep a-walking, keep a-moving, 
Just kissed my baby, good god`;

    // YouTube links to extract
    const youtubeLinks = [
      'https://www.youtube.com/watch?v=Ma8ABYwo1Ew',
      'https://www.youtube.com/watch?v=m0LW8_dWpuk'
    ];

    // Create the gig document
    const gigDocument = await prisma.gigDocument.create({
      data: {
        songId: 283, // "Just Kissed My Baby"
        content: songContent,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`Created gig document with ID: ${gigDocument.id}`);

    // Add the YouTube links as song links
    for (const linkUrl of youtubeLinks) {
      const songLink = await prisma.link.create({
        data: {
          songId: 283,
          url: linkUrl,
          type: 'YOUTUBE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Added YouTube link: ${linkUrl}`);
    }

    console.log('Successfully created gig document and added YouTube links for "Just Kissed My Baby"');

  } catch (error) {
    console.error('Error creating gig document:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createJustKissedGig();
