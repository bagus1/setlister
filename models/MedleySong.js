const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const MedleySong = sequelize.define(
    "MedleySong",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      medleyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "medley_id",
        references: {
          model: "medleys",
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
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "medley_songs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return MedleySong;
};
