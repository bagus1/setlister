const { Sequelize } = require("sequelize");
const path = require("path");

// Create Sequelize instance for migration
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "database.sqlite"),
  logging: console.log,
});

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    // Check if gig_documents table exists
    const tableExists = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='gig_documents'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (tableExists.length === 0) {
      console.log("Creating gig_documents table...");
      await sequelize.query(`
                CREATE TABLE gig_documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    songId INTEGER NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('chords', 'bass-tab', 'guitar-tab', 'lyrics')),
                    version INTEGER NOT NULL DEFAULT 1,
                    content TEXT,
                    isActive BOOLEAN NOT NULL DEFAULT 1,
                    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
                )
            `);

      // Create unique index
      await sequelize.query(`
                CREATE UNIQUE INDEX gig_documents_song_id_type_version 
                ON gig_documents (songId, type, version)
            `);

      console.log("✅ gig_documents table created successfully");
    } else {
      console.log("✅ gig_documents table already exists");
    }

    // Check if gigDocumentId column exists in band_songs
    const columnExists = await sequelize.query(
      "PRAGMA table_info(band_songs)",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const hasGigDocumentId = columnExists.some(
      (col) => col.name === "gigDocumentId"
    );

    if (!hasGigDocumentId) {
      console.log("Adding gigDocumentId column to band_songs table...");
      await sequelize.query(`
                ALTER TABLE band_songs 
                ADD COLUMN gigDocumentId INTEGER 
                REFERENCES gig_documents(id) ON DELETE SET NULL
            `);
      console.log("✅ gigDocumentId column added successfully");
    } else {
      console.log("✅ gigDocumentId column already exists");
    }

    // Check and add recordingsUrl column to setlists table if it doesn't exist
    try {
      const setlistsTableInfo = await sequelize.query(
        "PRAGMA table_info(setlists)",
        { type: sequelize.QueryTypes.SELECT }
      );
      const hasRecordingsUrl = setlistsTableInfo.some(
        (col) => col.name === "recordingsUrl"
      );

      if (!hasRecordingsUrl) {
        console.log("Adding recordingsUrl column to setlists table...");
        await sequelize.query(
          "ALTER TABLE setlists ADD COLUMN recordingsUrl TEXT"
        );
        console.log("✅ recordingsUrl column added to setlists table");
      } else {
        console.log("✅ recordingsUrl column already exists in setlists table");
      }
    } catch (error) {
      console.error("Error checking/adding recordingsUrl column:", error);
    }

    // Check and add createdById column to gig_documents table if it doesn't exist
    try {
      const gigDocumentsTableInfo = await sequelize.query(
        "PRAGMA table_info(gig_documents)",
        { type: sequelize.QueryTypes.SELECT }
      );
      const hasCreatedById = gigDocumentsTableInfo.some(
        (col) => col.name === "createdById"
      );

      if (!hasCreatedById) {
        console.log("Adding createdById column to gig_documents table...");
        await sequelize.query(
          "ALTER TABLE gig_documents ADD COLUMN createdById INTEGER REFERENCES users(id)"
        );

        // Set a default creator for existing documents (assuming user ID 1 as default)
        console.log("Setting default creator for existing gig documents...");
        await sequelize.query(
          "UPDATE gig_documents SET createdById = 1 WHERE createdById IS NULL"
        );

        console.log("✅ createdById column added to gig_documents table");
      } else {
        console.log(
          "✅ createdById column already exists in gig_documents table"
        );
      }
    } catch (error) {
      console.error("Error checking/adding createdById column:", error);
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await sequelize.close();
  }
}

// Run migrations
runMigrations();
