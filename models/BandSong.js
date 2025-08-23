const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const BandSong = sequelize.define(
    "BandSong",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      bandId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "band_id",
        references: {
          model: "bands",
          key: "id",
        },
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
      gigDocumentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "gig_document_id",
        references: {
          model: "gig_documents",
          key: "id",
        },
        comment: "Preferred gig document for this band/song combination",
      },
    },
    {
      tableName: "band_songs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["band_id", "song_id"],
        },
      ],
    }
  );

  return BandSong;
};
