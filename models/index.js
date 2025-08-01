const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false, // Set to console.log to see SQL queries
});

// Import models
const User = require('./User')(sequelize);
const Band = require('./Band')(sequelize);
const BandMember = require('./BandMember')(sequelize);
const Song = require('./Song')(sequelize);
const Artist = require('./Artist')(sequelize);
const Vocalist = require('./Vocalist')(sequelize);
const BandSong = require('./BandSong')(sequelize);
const Setlist = require('./Setlist')(sequelize);
const SetlistSet = require('./SetlistSet')(sequelize);
const SetlistSong = require('./SetlistSong')(sequelize);
const Medley = require('./Medley')(sequelize);
const MedleySong = require('./MedleySong')(sequelize);
const BandInvitation = require('./BandInvitation')(sequelize);

// Define associations
// User-Band (many-to-many through BandMember)
User.belongsToMany(Band, { through: BandMember, foreignKey: 'userId' });
Band.belongsToMany(User, { through: BandMember, foreignKey: 'bandId' });

// Band-Song (many-to-many through BandSong)
Band.belongsToMany(Song, { through: BandSong, foreignKey: 'bandId' });
Song.belongsToMany(Band, { through: BandSong, foreignKey: 'songId' });

// Song-Artist (many-to-many)
Song.belongsToMany(Artist, { through: 'SongArtist', foreignKey: 'songId' });
Artist.belongsToMany(Song, { through: 'SongArtist', foreignKey: 'artistId' });

// Song-Vocalist (one-to-many)
Song.belongsTo(Vocalist, { foreignKey: 'vocalistId' });
Vocalist.hasMany(Song, { foreignKey: 'vocalistId' });

// Medley-Vocalist (one-to-many)
Medley.belongsTo(Vocalist, { foreignKey: 'vocalistId' });
Vocalist.hasMany(Medley, { foreignKey: 'vocalistId' });

// BandSong junction table associations
BandSong.belongsTo(Song, { foreignKey: 'songId' });
BandSong.belongsTo(Band, { foreignKey: 'bandId' });
Song.hasMany(BandSong, { foreignKey: 'songId' });
Band.hasMany(BandSong, { foreignKey: 'bandId' });

// Band-Setlist (one-to-many)
Band.hasMany(Setlist, { foreignKey: 'bandId' });
Setlist.belongsTo(Band, { foreignKey: 'bandId' });

// Setlist-SetlistSet (one-to-many)
Setlist.hasMany(SetlistSet, { foreignKey: 'setlistId' });
SetlistSet.belongsTo(Setlist, { foreignKey: 'setlistId' });

// SetlistSet-SetlistSong (one-to-many)
SetlistSet.hasMany(SetlistSong, { foreignKey: 'setlistSetId' });
SetlistSong.belongsTo(SetlistSet, { foreignKey: 'setlistSetId' });

// Song-SetlistSong (one-to-many)
Song.hasMany(SetlistSong, { foreignKey: 'songId' });
SetlistSong.belongsTo(Song, { foreignKey: 'songId' });

// Medley-Song (many-to-many through MedleySong)
Medley.belongsToMany(Song, { through: MedleySong, foreignKey: 'medleyId' });
Song.belongsToMany(Medley, { through: MedleySong, foreignKey: 'songId' });

// BandInvitation associations
BandInvitation.belongsTo(Band, { foreignKey: 'bandId' });
Band.hasMany(BandInvitation, { foreignKey: 'bandId' });

module.exports = {
    sequelize,
    User,
    Band,
    BandMember,
    Song,
    Artist,
    Vocalist,
    BandSong,
    Setlist,
    SetlistSet,
    SetlistSong,
    Medley,
    MedleySong,
    BandInvitation
}; 