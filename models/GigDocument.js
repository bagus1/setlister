const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const GigDocument = sequelize.define(
    "GigDocument",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      songId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      createdById: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        comment: "User ID who created this document",
      },
      type: {
        type: DataTypes.ENUM("chords", "bass-tab", "guitar-tab", "lyrics"),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment:
          "Auto-incrementing version number for this song/type combination",
      },
      title: {
        type: DataTypes.VIRTUAL,
        get() {
          const song = this.Song;
          if (song) {
            return `${song.title} - ${this.getTypeDisplayName()} - v${this.version}`;
          }
          return `${this.getTypeDisplayName()} - v${this.version}`;
        },
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Quill HTML content",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Whether this document is active/current",
      },
    },
    {
      tableName: "gig_documents",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["songId", "type", "version"],
        },
      ],
    }
  );

  // Instance method to get display name for type
  GigDocument.prototype.getTypeDisplayName = function () {
    const typeNames = {
      chords: "Chords",
      "bass-tab": "Bass Tab",
      "guitar-tab": "Guitar Tab",
      lyrics: "Lyrics",
    };
    return typeNames[this.type] || this.type;
  };

  // Instance method to get the next version number for this song/type
  GigDocument.getNextVersion = async function (songId, type) {
    const latestVersion = await this.max("version", {
      where: { songId, type },
    });
    return (latestVersion || 0) + 1;
  };

  return GigDocument;
};
