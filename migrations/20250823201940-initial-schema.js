"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create users table
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create bands table
    await queryInterface.createTable("bands", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create band_members table
    await queryInterface.createTable("band_members", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      band_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bands",
          key: "id",
        },
      },
      role: {
        type: Sequelize.ENUM("owner", "member"),
        defaultValue: "member",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create unique index for band_members
    await queryInterface.addIndex("band_members", ["user_id", "band_id"], {
      unique: true,
    });

    // Create vocalists table
    await queryInterface.createTable("vocalists", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create songs table
    await queryInterface.createTable("songs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      key: {
        type: Sequelize.ENUM(
          "C",
          "C#",
          "Db",
          "D",
          "D#",
          "Eb",
          "E",
          "F",
          "F#",
          "Gb",
          "G",
          "G#",
          "Ab",
          "A",
          "A#",
          "Bb",
          "B",
          "Cm",
          "C#m",
          "Dbm",
          "Dm",
          "D#m",
          "Ebm",
          "Em",
          "Fm",
          "F#m",
          "Gbm",
          "Gm",
          "G#m",
          "Abm",
          "Am",
          "A#m",
          "Bbm",
          "Bm"
        ),
      },
      time: {
        type: Sequelize.INTEGER,
      },
      bpm: {
        type: Sequelize.INTEGER,
      },
      vocalist_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "vocalists",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create artists table
    await queryInterface.createTable("artists", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create gig_documents table
    await queryInterface.createTable("gig_documents", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      created_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      type: {
        type: Sequelize.ENUM("chords", "bass-tab", "guitar-tab", "lyrics"),
        allowNull: false,
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      content: {
        type: Sequelize.TEXT,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create unique index for gig_documents
    await queryInterface.addIndex(
      "gig_documents",
      ["song_id", "type", "version"],
      {
        unique: true,
      }
    );

    // Create band_songs table
    await queryInterface.createTable("band_songs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      band_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bands",
          key: "id",
        },
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      gig_document_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "gig_documents",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create unique index for band_songs
    await queryInterface.addIndex("band_songs", ["band_id", "song_id"], {
      unique: true,
    });

    // Create setlists table
    await queryInterface.createTable("setlists", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      band_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bands",
          key: "id",
        },
      },
      date: {
        type: Sequelize.DATE,
      },
      is_finalized: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      recordings_url: {
        type: Sequelize.TEXT,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create setlist_sets table
    await queryInterface.createTable("setlist_sets", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      setlist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "setlists",
          key: "id",
        },
      },
      name: {
        type: Sequelize.ENUM("Set 1", "Set 2", "Set 3", "Set 4", "Maybe"),
        allowNull: false,
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create unique index for setlist_sets
    await queryInterface.addIndex("setlist_sets", ["setlist_id", "name"], {
      unique: true,
    });

    // Create setlist_songs table
    await queryInterface.createTable("setlist_songs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      setlist_set_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "setlist_sets",
          key: "id",
        },
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create medleys table
    await queryInterface.createTable("medleys", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      key: {
        type: Sequelize.ENUM(
          "C",
          "C#",
          "Db",
          "D",
          "D#",
          "Eb",
          "E",
          "F",
          "F#",
          "Gb",
          "G",
          "G#",
          "Ab",
          "A",
          "A#",
          "Bb",
          "B",
          "Cm",
          "C#m",
          "Dbm",
          "Dm",
          "D#m",
          "Ebm",
          "Em",
          "Fm",
          "F#m",
          "Gbm",
          "Gm",
          "G#m",
          "Abm",
          "Am",
          "A#m",
          "Bbm",
          "Bm"
        ),
      },
      vocalist_id: {
        type: Sequelize.INTEGER,
        references: {
          model: "vocalists",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create medley_songs table
    await queryInterface.createTable("medley_songs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      medley_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "medleys",
          key: "id",
        },
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create unique index for medley_songs
    await queryInterface.addIndex("medley_songs", ["medley_id", "song_id"], {
      unique: true,
    });

    // Create band_invitations table
    await queryInterface.createTable("band_invitations", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      band_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bands",
          key: "id",
        },
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      role: {
        type: Sequelize.ENUM("member"),
        defaultValue: "member",
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      used_at: {
        type: Sequelize.DATE,
      },
      invited_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create password_resets table
    await queryInterface.createTable("password_resets", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      used_at: {
        type: Sequelize.DATE,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create links table
    await queryInterface.createTable("links", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      type: {
        type: Sequelize.ENUM(
          "youtube",
          "spotify",
          "apple-music",
          "soundcloud",
          "bandcamp",
          "lyrics",
          "tab",
          "bass tab",
          "chords",
          "guitar tutorial",
          "bass tutorial",
          "keyboard tutorial",
          "audio",
          "sheet-music",
          "backing-track",
          "karaoke",
          "horn chart",
          "other"
        ),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create song_artists table (junction table)
    await queryInterface.createTable("song_artists", {
      song_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "songs",
          key: "id",
        },
      },
      artist_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "artists",
          key: "id",
        },
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create composite primary key for song_artists
    await queryInterface.addConstraint("song_artists", {
      fields: ["song_id", "artist_id"],
      type: "primary key",
      name: "song_artists_pkey",
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (respecting foreign key constraints)
    await queryInterface.dropTable("song_artists");
    await queryInterface.dropTable("links");
    await queryInterface.dropTable("password_resets");
    await queryInterface.dropTable("band_invitations");
    await queryInterface.dropTable("medley_songs");
    await queryInterface.dropTable("medleys");
    await queryInterface.dropTable("setlist_songs");
    await queryInterface.dropTable("setlist_sets");
    await queryInterface.dropTable("setlists");
    await queryInterface.dropTable("band_songs");
    await queryInterface.dropTable("gig_documents");
    await queryInterface.dropTable("artists");
    await queryInterface.dropTable("songs");
    await queryInterface.dropTable("vocalists");
    await queryInterface.dropTable("band_members");
    await queryInterface.dropTable("bands");
    await queryInterface.dropTable("users");
  },
};
