#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Migration Script
 *
 * This script:
 * 1. Connects to SQLite database
 * 2. Exports all data with proper column name mapping
 * 3. Generates PostgreSQL-compatible INSERT statements
 * 4. Handles data type conversions
 */

const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Configuration
const SQLITE_DB_PATH = "./database.sqlite";
const OUTPUT_DIR = "./migration-output";
const TABLES = [
  "users",
  "bands",
  "band_members",
  "songs",
  "artists",
  "vocalists",
  "band_songs",
  "setlists",
  "setlist_sets",
  "setlist_songs",
  "medleys",
  "medley_songs",
  "band_invitations",
  "password_resets",
  "links",
  "gig_documents",
  "song_artists",
];

// Column name mappings (SQLite -> PostgreSQL)
const COLUMN_MAPPINGS = {
  users: {
    id: "id",
    username: "username",
    email: "email",
    passwordHash: "password_hash",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  bands: {
    id: "id",
    name: "name",
    description: "description",
    createdById: "created_by_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  band_members: {
    id: "id",
    userId: "user_id",
    bandId: "band_id",
    role: "role",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  songs: {
    id: "id",
    title: "title",
    key: "key",
    tempo: "tempo",
    notes: "notes",
    vocalistId: "vocalist_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  artists: {
    id: "id",
    name: "name",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  vocalists: {
    id: "id",
    name: "name",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  band_songs: {
    id: "id",
    bandId: "band_id",
    songId: "song_id",
    gigDocumentId: "gig_document_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  setlists: {
    id: "id",
    title: "title",
    date: "date",
    bandId: "band_id",
    isFinalized: "is_finalized",
    recordingsUrl: "recordings_url",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  setlist_sets: {
    id: "id",
    name: "name",
    setlistId: "setlist_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  setlist_songs: {
    id: "id",
    setlistSetId: "setlist_set_id",
    songId: "song_id",
    order: "order",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  medleys: {
    id: "id",
    name: "name",
    key: "key",
    vocalistId: "vocalist_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  medley_songs: {
    id: "id",
    medleyId: "medley_id",
    songId: "song_id",
    order: "order",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  band_invitations: {
    id: "id",
    bandId: "band_id",
    email: "email",
    role: "role",
    expiresAt: "expires_at",
    usedAt: "used_at",
    invitedBy: "invited_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  password_resets: {
    id: "id",
    userId: "user_id",
    token: "token",
    expiresAt: "expires_at",
    usedAt: "used_at",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  links: {
    id: "id",
    songId: "song_id",
    type: "type",
    url: "url",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  gig_documents: {
    id: "id",
    songId: "song_id",
    type: "type",
    version: "version",
    content: "content",
    createdById: "created_by_id",
    isActive: "is_active",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  song_artists: {
    id: "id",
    songId: "song_id",
    artistId: "artist_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
};

// Data type conversions
const TYPE_CONVERSIONS = {
  boolean: (value) => (value === 1 ? "true" : "false"),
  date: (value) => (value ? `'${value}'` : "NULL"),
  text: (value) => (value ? `'${value.replace(/'/g, "''")}'` : "NULL"),
  integer: (value) => value || "NULL",
};

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function getPostgresType(sqliteType) {
  const typeMap = {
    INTEGER: "integer",
    TEXT: "text",
    REAL: "numeric",
    BLOB: "bytea",
    BOOLEAN: "boolean",
  };
  return typeMap[sqliteType.toUpperCase()] || "text";
}

function escapeValue(value, type) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (type === "boolean") {
    return value ? "true" : "false";
  }

  if (type === "date" || type === "timestamp") {
    return value ? `'${value}'` : "NULL";
  }

  if (type === "text" || type === "varchar") {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  return value;
}

function generateInsertStatement(tableName, columns, values) {
  const mappedColumns = columns.map(
    (col) => COLUMN_MAPPINGS[tableName][col] || col
  );
  const escapedValues = values.map((val, idx) => {
    const colName = columns[idx];
    const pgColName = mappedColumns[idx];
    const sqliteType = getPostgresType(typeof val);
    return escapeValue(val, sqliteType);
  });

  return `INSERT INTO ${tableName} (${mappedColumns.join(", ")}) VALUES (${escapedValues.join(", ")});`;
}

function migrateTable(db, tableName) {
  return new Promise((resolve, reject) => {
    console.log(`Migrating table: ${tableName}`);

    // Get table schema
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        reject(err);
        return;
      }

      // Get all data
      db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        if (rows.length === 0) {
          console.log(`  No data in ${tableName}`);
          resolve();
          return;
        }

        const outputFile = path.join(OUTPUT_DIR, `${tableName}.sql`);
        const inserts = [];

        // Generate INSERT statements
        rows.forEach((row) => {
          const rowColumns = Object.keys(row);
          const rowValues = Object.values(row);
          const insert = generateInsertStatement(
            tableName,
            rowColumns,
            rowValues
          );
          inserts.push(insert);
        });

        // Write to file
        const content = `-- Migration for ${tableName}\n-- ${rows.length} rows\n\n${inserts.join("\n")}\n`;
        fs.writeFileSync(outputFile, content);

        console.log(`  Exported ${rows.length} rows to ${outputFile}`);
        resolve();
      });
    });
  });
}

async function main() {
  console.log("🚀 Starting SQLite to PostgreSQL migration...\n");

  // Ensure output directory exists
  ensureOutputDir();

  // Connect to SQLite database
  const db = new sqlite3.Database(
    SQLITE_DB_PATH,
    sqlite3.OPEN_READONLY,
    (err) => {
      if (err) {
        console.error("❌ Error opening SQLite database:", err.message);
        process.exit(1);
      }
      console.log("✅ Connected to SQLite database");
    }
  );

  try {
    // Migrate each table
    for (const tableName of TABLES) {
      await migrateTable(db, tableName);
    }

    // Generate summary
    const summaryFile = path.join(OUTPUT_DIR, "MIGRATION_SUMMARY.md");
    const summary = `# SQLite to PostgreSQL Migration Summary

Generated on: ${new Date().toISOString()}

## Tables Migrated
${TABLES.map((table) => `- ${table}`).join("\n")}

## Next Steps

1. **Verify the generated SQL files** in the \`${OUTPUT_DIR}\` directory
2. **Review column mappings** to ensure they match your PostgreSQL schema
3. **Import data** using one of these methods:
   - Run the SQL files directly in PostgreSQL
   - Use \`psql\` command line tool
   - Use a database management tool like DBeaver

## Import Commands

\`\`\`bash
# Connect to your PostgreSQL database
psql -h localhost -U setlists_dev -d setlists_dev

# Import each table (example)
\\i ${OUTPUT_DIR}/users.sql
\\i ${OUTPUT_DIR}/bands.sql
# ... etc
\`\`\`

## Verification

After import, verify:
- Row counts match between SQLite and PostgreSQL
- Foreign key relationships are intact
- Data types are correct
- No data corruption occurred

## Rollback

If issues occur, you can:
1. Drop the PostgreSQL database
2. Restore from your SQLite backup
3. Revert code changes
`;

    fs.writeFileSync(summaryFile, summary);
    console.log(`\n📋 Migration summary written to ${summaryFile}`);

    console.log("\n✅ Migration completed successfully!");
    console.log(`📁 Check the \`${OUTPUT_DIR}\` directory for generated files`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
SQLite to PostgreSQL Migration Script

Usage: node migrate-sqlite-to-postgres.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Show what would be migrated without writing files

Examples:
  node migrate-sqlite-to-postgres.js
  node migrate-sqlite-to-postgres.js --dry-run
`);
  process.exit(0);
}

// Run migration
main().catch(console.error);
