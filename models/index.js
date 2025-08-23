const { Sequelize } = require("sequelize");
const path = require("path");

// Get database configuration based on environment
const env = process.env.NODE_ENV || "development";
const config = require("../config/database")[env];

// Initialize Sequelize with configuration
const sequelize = new Sequelize(config);

// Import models
const User = require("./User")(sequelize);
const Band = require("./Band")(sequelize);
const BandMember = require("./BandMember")(sequelize);
const Song = require("./Song")(sequelize);
const Artist = require("./Artist")(sequelize);
const Vocalist = require("./Vocalist")(sequelize);
const BandSong = require("./BandSong")(sequelize);
const Setlist = require("./Setlist")(sequelize);
const SetlistSet = require("./SetlistSet")(sequelize);
const SetlistSong = require("./SetlistSong")(sequelize);
const Medley = require("./Medley")(sequelize);
const MedleySong = require("./MedleySong")(sequelize);
const BandInvitation = require("./BandInvitation")(sequelize);
const PasswordReset = require("./PasswordReset")(sequelize);
const Link = require("./Link")(sequelize);
const GigDocument = require("./GigDocument")(sequelize);
const SongArtist = require("./SongArtist")(sequelize);

// Define associations
// User-Band (many-to-many through BandMember)
User.belongsToMany(Band, { through: "band_members", foreignKey: "user_id" });
Band.belongsToMany(User, { through: "band_members", foreignKey: "band_id" });

// Band-Song (many-to-many through BandSong)
Band.belongsToMany(Song, { through: BandSong, foreignKey: "band_id" });
Song.belongsToMany(Band, { through: BandSong, foreignKey: "song_id" });

// Song-Artist (many-to-many)
Song.belongsToMany(Artist, {
  through: "song_artists",
  foreignKey: "song_id",
  otherKey: "artist_id",
});
Artist.belongsToMany(Song, {
  through: "song_artists",
  foreignKey: "artist_id",
  otherKey: "song_id",
});

// Song-Vocalist (one-to-many)
Song.belongsTo(Vocalist, { foreignKey: "vocalist_id" });
Vocalist.hasMany(Song, { foreignKey: "vocalist_id" });

// Medley-Vocalist (one-to-many)
Medley.belongsTo(Vocalist, { foreignKey: "vocalist_id" });
Vocalist.hasMany(Medley, { foreignKey: "vocalist_id" });

// BandSong junction table associations
BandSong.belongsTo(Song, { foreignKey: "song_id" });
BandSong.belongsTo(Band, { foreignKey: "band_id" });
BandSong.belongsTo(GigDocument, { foreignKey: "gig_document_id" });
Song.hasMany(BandSong, { foreignKey: "song_id" });
Band.hasMany(BandSong, { foreignKey: "band_id" });
GigDocument.hasMany(BandSong, { foreignKey: "gig_document_id" });

// Band-Setlist (one-to-many)
Band.hasMany(Setlist, { foreignKey: "band_id" });
Setlist.belongsTo(Band, { foreignKey: "band_id" });

// Setlist-SetlistSet (one-to-many)
Setlist.hasMany(SetlistSet, { foreignKey: "setlist_id" });
SetlistSet.belongsTo(Setlist, { foreignKey: "setlist_id" });

// SetlistSet-SetlistSong (one-to-many)
SetlistSet.hasMany(SetlistSong, { foreignKey: "setlist_set_id" });
SetlistSong.belongsTo(SetlistSet, { foreignKey: "setlist_set_id" });

// Song-SetlistSong (one-to-many)
Song.hasMany(SetlistSong, { foreignKey: "song_id" });
SetlistSong.belongsTo(Song, { foreignKey: "song_id" });

// Medley-Song (many-to-many through MedleySong)
Medley.belongsToMany(Song, { through: MedleySong, foreignKey: "medley_id" });
Song.belongsToMany(Medley, { through: MedleySong, foreignKey: "song_id" });

// BandInvitation associations
BandInvitation.belongsTo(Band, { foreignKey: "band_id" });
Band.hasMany(BandInvitation, { foreignKey: "band_id" });

// BandInvitation-User (for invitedBy field)
BandInvitation.belongsTo(User, { as: "Inviter", foreignKey: "invited_by" });
User.hasMany(BandInvitation, {
  as: "SentInvitations",
  foreignKey: "invited_by",
});

// PasswordReset associations (if any needed)
// Currently no associations needed for PasswordReset

// Song-Link (one-to-many)
Song.hasMany(Link, { foreignKey: "song_id" });
Link.belongsTo(Song, { foreignKey: "song_id" });

// GigDocument associations
GigDocument.belongsTo(Song, { foreignKey: "song_id" });
Song.hasMany(GigDocument, { foreignKey: "song_id" });

// GigDocument creator association
GigDocument.belongsTo(User, { foreignKey: "created_by_id", as: "Creator" });
User.hasMany(GigDocument, {
  foreignKey: "created_by_id",
  as: "CreatedGigDocuments",
});

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
  BandInvitation,
  PasswordReset,
  Link,
  GigDocument,
  SongArtist,
};
