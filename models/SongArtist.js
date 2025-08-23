const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SongArtist = sequelize.define(
    "SongArtist",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      songId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "song_id",
        references: {
          model: "songs",
          key: "id",
        },
      },
      artistId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "artist_id",
        references: {
          model: "artists",
          key: "id",
        },
      },
    },
    {
      tableName: "song_artists",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return SongArtist;
};
