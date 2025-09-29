const fs = require('fs');
const csv = require('csv-parser');

async function createOpenBookSQL() {
  const songs = [];
  const artists = new Set();
  const links = [];

  // Read the CSV file
  await new Promise((resolve, reject) => {
    fs.createReadStream('/Users/john/coding-practice/setlists/openbook/openbook_metadata_clean.csv')
      .pipe(csv())
      .on('data', (row) => {
        songs.push(row);
        if (row.Artists) {
          row.Artists.split(';').forEach(artist => {
            artists.add(artist.trim());
          });
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  let sql = '-- OpenBook Songs Import SQL\n';
  sql += '-- Generated automatically\n\n';

  // Insert artists
  sql += '-- Insert artists\n';
  sql += 'INSERT INTO artists (name, created_at, updated_at) VALUES\n';
  const artistArray = Array.from(artists).sort();
  const artistValues = artistArray.map((artist, index) => {
    return `  ('${artist.replace(/'/g, "''")}', NOW(), NOW())`;
  }).join(',\n');
  sql += artistValues + '\nON CONFLICT (name) DO NOTHING;\n\n';

  // Insert songs
  sql += '-- Insert songs\n';
  sql += 'INSERT INTO songs (title, composer, lyricist, style, key_signature, time_signature, tempo, structure, copyright_info, year_composed, source, created_by_id, private, created_at, updated_at) VALUES\n';
  
  const songValues = songs.map((song, index) => {
    const values = [
      `'${song.Title.replace(/'/g, "''")}'`, // title
      song.Composer ? `'${song.Composer.replace(/'/g, "''")}'` : 'NULL', // composer
      song.Lyricist ? `'${song.Lyricist.replace(/'/g, "''")}'` : 'NULL', // lyricist
      song.Style ? `'${song.Style.replace(/'/g, "''")}'` : 'NULL', // style
      song['Key Signature'] ? `'${song['Key Signature'].replace(/'/g, "''")}'` : 'NULL', // key_signature
      song['Time Signature'] ? `'${song['Time Signature'].replace(/'/g, "''")}'` : 'NULL', // time_signature
      song.Tempo ? parseInt(song.Tempo) || 'NULL' : 'NULL', // tempo
      song.Structure ? `'${song.Structure.replace(/'/g, "''")}'` : 'NULL', // structure
      song['Copyright Info'] ? `'${song['Copyright Info'].replace(/'/g, "''")}'` : 'NULL', // copyright_info
      song['Year Composed'] ? parseInt(song['Year Composed']) || 'NULL' : 'NULL', // year_composed
      `'${song.Source}'`, // source
      '1', // created_by_id (user 1)
      'false', // private
      'NOW()', // created_at
      'NOW()' // updated_at
    ];
    return `  (${values.join(', ')})`;
  }).join(',\n');
  
  sql += songValues + ';\n\n';

  // Create song-artist relationships
  sql += '-- Create song-artist relationships\n';
  const songArtistValues = [];
  songs.forEach((song, songIndex) => {
    if (song.Artists) {
      song.Artists.split(';').forEach(artistName => {
        const artist = artistName.trim();
        songArtistValues.push(`  ((SELECT id FROM songs WHERE title = '${song.Title.replace(/'/g, "''")}' AND source = 'openbook' LIMIT 1), (SELECT id FROM artists WHERE name = '${artist.replace(/'/g, "''")}'), NOW(), NOW())`);
      });
    }
  });
  
  if (songArtistValues.length > 0) {
    sql += 'INSERT INTO song_artists (song_id, artist_id, created_at, updated_at) VALUES\n';
    sql += songArtistValues.join(',\n') + '\nON CONFLICT (song_id, artist_id) DO NOTHING;\n\n';
  }

  // Create links for PDFs and MIDI files
  sql += '-- Create links for PDF and MIDI files\n';
  const linkValues = [];
  
  songs.forEach((song) => {
    const songTitle = song.Title.replace(/'/g, "''");
    const filename = song.Title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // PDF link
    linkValues.push(`  ((SELECT id FROM songs WHERE title = '${songTitle}' AND source = 'openbook' LIMIT 1), 'pdf', '/openbook/${filename}/${filename}.pdf', 'PDF Lead Sheet', 1, NOW())`);
    
    // MIDI link
    linkValues.push(`  ((SELECT id FROM songs WHERE title = '${songTitle}' AND source = 'openbook' LIMIT 1), 'midi', '/openbook/${filename}/${filename}.midi', 'MIDI File', 1, NOW())`);
  });
  
  sql += 'INSERT INTO links (song_id, type, url, description, created_by_id, created_at) VALUES\n';
  sql += linkValues.join(',\n') + ';\n\n';

  // Write to file
  fs.writeFileSync('/Users/john/coding-practice/setlists/openbook/openbook_import.sql', sql);
  console.log(`✅ Created openbook_import.sql with ${songs.length} songs and ${artists.size} artists`);
  console.log(`📊 Will create ${linkValues.length} links (${songs.length} PDFs + ${songs.length} MIDI files)`);
}

createOpenBookSQL().catch(console.error);
