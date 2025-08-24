# SQLite to PostgreSQL Migration Summary

Generated on: 2025-08-23T23:11:22.512Z

## Tables Migrated
- users
- bands
- band_members
- songs
- artists
- vocalists
- band_songs
- setlists
- setlist_sets
- setlist_songs
- medleys
- medley_songs
- BandInvitations
- password_resets
- links
- gig_documents
- SongArtist

## Next Steps

1. **Verify the generated SQL files** in the `./migration-output` directory
2. **Review column mappings** to ensure they match your PostgreSQL schema
3. **Import data** using one of these methods:
   - Run the SQL files directly in PostgreSQL
   - Use `psql` command line tool
   - Use a database management tool like DBeaver

## Import Commands

```bash
# Connect to your PostgreSQL database
psql -h localhost -U setlists_dev -d setlists_dev

# Import each table (example)
\i ./migration-output/users.sql
\i ./migration-output/bands.sql
# ... etc
```

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
