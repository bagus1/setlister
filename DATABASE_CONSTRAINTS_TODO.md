# Database Constraints for Song Duplication Prevention

## Current Status

✅ **Code-level duplicate prevention implemented** in all 3 song creation paths:

- Bulk Add Songs (`routes/bulk-add-songs.js`) - ✅ Already had proper logic
- Single Song Add (`routes/songs.js`) - ❌ Only checks title (needs fix)
- Quick Set Creation (`routes/bands.js`) - ✅ Fixed with proper logic

## Problem

Currently, there are no database-level constraints preventing duplicate songs. This allows:

- Multiple songs with identical `(title, artist)` combinations
- Multiple songs with identical `title` and no artist
- Data integrity issues if code-level checks are bypassed

## Proposed Database Constraints

### Option 1: Composite Unique Constraint (Recommended)

```sql
-- Add a computed column for primary artist (or NULL if no artists)
ALTER TABLE songs ADD COLUMN primary_artist_id INT REFERENCES artists(id);

-- Create unique constraint that handles both cases
CREATE UNIQUE INDEX unique_song_title_artist
ON songs (title, primary_artist_id);

-- This allows:
-- ✅ "Sugaree" by "Grateful Dead" (primary_artist_id = 123)
-- ✅ "Sugaree" by "Jerry Garcia" (primary_artist_id = 456)
-- ✅ "Instrumental Song" (primary_artist_id = NULL)
-- ❌ Duplicate "Sugaree" by "Grateful Dead"
-- ❌ Duplicate "Instrumental Song" with no artist
```

### Option 2: Partial Unique Constraints (PostgreSQL)

```sql
-- Constraint for songs with artists
CREATE UNIQUE INDEX unique_song_with_artist
ON songs (title, (SELECT artist_id FROM song_artists WHERE song_id = songs.id LIMIT 1))
WHERE EXISTS (SELECT 1 FROM song_artists WHERE song_id = songs.id);

-- Constraint for songs without artists
CREATE UNIQUE INDEX unique_song_without_artist
ON songs (title)
WHERE NOT EXISTS (SELECT 1 FROM song_artists WHERE song_id = songs.id);
```

### Option 3: Function-Based Constraint

```sql
-- Create a function to get primary artist or special value
CREATE OR REPLACE FUNCTION get_song_artist_key(song_id INT)
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT artist_id::TEXT FROM song_artists WHERE song_id = $1 LIMIT 1),
    '__NO_ARTIST__'
  );
END;
$$ LANGUAGE plpgsql;

-- Create unique constraint using the function
CREATE UNIQUE INDEX unique_song_title_artist_func
ON songs (title, get_song_artist_key(id));
```

## Migration Strategy

### Phase 1: Clean Existing Duplicates

```sql
-- Find current duplicates
WITH duplicates AS (
  SELECT title,
         COALESCE(sa.artist_id, -1) as artist_key,
         array_agg(s.id ORDER BY s.created_at) as song_ids,
         count(*) as dup_count
  FROM songs s
  LEFT JOIN song_artists sa ON s.id = sa.song_id
  GROUP BY title, COALESCE(sa.artist_id, -1)
  HAVING count(*) > 1
)
SELECT * FROM duplicates;

-- Merge duplicates (keep oldest, update references)
-- This would need careful handling of:
-- - setlist_songs references
-- - band_songs references
-- - links references
-- - gig_documents references
```

### Phase 2: Add Constraints

```sql
-- Add the chosen constraint from options above
-- Test thoroughly before applying to production
```

## Code Changes Needed

### Fix Single Song Add (routes/songs.js)

The single song add currently only checks title, ignoring artist:

```javascript
// CURRENT (BROKEN) - lines 208-227
const existingSong = await prisma.song.findFirst({
  where: {
    title: { equals: title.trim(), mode: "insensitive" },
    // ❌ Missing artist check!
  },
});

// SHOULD BE (like bulk-add and quick-set):
if (artistId) {
  existingSong = await prisma.song.findFirst({
    where: {
      title: { equals: title.trim(), mode: "insensitive" },
      artists: { some: { artistId: artistId } },
    },
  });
} else {
  existingSong = await prisma.song.findFirst({
    where: {
      title: { equals: title.trim(), mode: "insensitive" },
      artists: { none: {} },
    },
  });
}
```

## Benefits of Database Constraints

1. **Data Integrity**: Prevents duplicates even if code bugs slip through
2. **Performance**: Database can optimize queries knowing uniqueness
3. **Concurrent Safety**: Prevents race conditions between simultaneous requests
4. **Documentation**: Makes business rules explicit in schema
5. **Admin Tools**: Prevents manual data entry mistakes

## Risks

1. **Migration Complexity**: Need to clean existing duplicates first
2. **Application Changes**: May need to handle constraint violation errors
3. **Flexibility Loss**: Harder to change uniqueness rules later
4. **Index Overhead**: Additional storage and maintenance cost

## Timeline

- **Immediate**: Code-level fixes (✅ Done for bulk-add and quick-set)
- **Next Sprint**: Fix single song add duplicate detection
- **Future**: Plan and implement database constraints during maintenance window

## Testing Checklist

Before implementing constraints:

- [ ] Verify all 3 song creation paths have proper duplicate detection
- [ ] Test concurrent song creation (multiple users, same song)
- [ ] Test case sensitivity handling
- [ ] Test songs with/without artists
- [ ] Test songs with multiple artists
- [ ] Plan rollback strategy for constraint addition
