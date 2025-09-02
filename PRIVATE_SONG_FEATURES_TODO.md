# Private Song Features - Complete Implementation Todo List

## Overview

Implement comprehensive private song features for the quickset functionality, including proper filtering, user permissions, editing capabilities, and smart merge logic for privacy changes.

## Phase 1: Fix Quickset Suggestions (Steps 1-2)

### Step 1: Fix findSongMatches to exclude private songs from suggestions

- **File:** `routes/bands.js` - `findSongMatches()` function
- **Action:** Add private filtering to the `allSongs` query
- **Filter Logic:** `{ private: false } OR { private: true, createdById: userId }`
- **Goal:** Private songs should not appear as suggestions for other users

### Step 2: Test that private songs no longer appear in quickset suggestions for other users

- **Test:** Create private song as User A, try quickset as User B
- **Expected:** Private song should not appear in suggestions for User B
- **Verify:** Only public songs and User B's own private songs appear

## Phase 2: Add Private Checkbox to Quickset (Steps 3-6)

### Step 3: Add can_make_private checkbox to new song cards in quickset confirm page

- **File:** `views/bands/quick-set-confirm.ejs`
- **Action:** Add checkbox to "Create New" cards
- **Condition:** Only show for users with `can_make_private=true`
- **Location:** Inside the new song card form

### Step 4: Test that users with can_make_private=true see the checkbox, users with can_make_private=false do not

- **Test:** Check UI with different user permission levels
- **Expected:** Checkbox visible only for users with permission
- **Verify:** Form submission includes private value when checkbox is present

### Step 5: Update quickset song creation logic to respect the private checkbox value

- **File:** `routes/bands.js` - quickset creation route
- **Action:** Replace hardcoded `private: false` with checkbox value
- **Logic:** Use `req.body.private` or default to `false`

### Step 6: Test that private songs are created when checkbox is checked in quickset

- **Test:** Create song via quickset with private checkbox checked
- **Expected:** Song is created with `private: true`
- **Verify:** Check database and song visibility

## Phase 3: Allow Private Song Editing (Steps 7-8)

### Step 7: Allow private song owners to edit title and artist fields

- **File:** `routes/songs.js` - song edit route
- **Action:** Modify validation to allow title/artist editing for private songs
- **Condition:** Only for private songs owned by the current user
- **Logic:** Check `song.private && song.createdById === userId`

### Step 8: Test that private song owners can edit title/artist, public song owners cannot

- **Test:** Try editing private vs public songs
- **Expected:** Private song owners can edit title/artist, public song owners cannot
- **Verify:** Form fields are editable/read-only based on permissions

## Phase 4: Implement Smart Merge Logic (Steps 9-12)

### Step 9: Implement smart merge logic for private→public conflicts

- **File:** New merge function in `routes/songs.js`
- **Logic:** `publicData || privateData` for each field
- **Fields:** `bpm`, `vocalistId`, `time`, `key`
- **Relationships:** Merge `links` and `gigDocuments` arrays

### Step 10: Test private→public merge: public song keeps its data, private song fills missing gaps

- **Test Cases:**
  - Public song has more data → keep public data
  - Private song has more data → use private data
  - Mixed data → merge best of both
- **Verify:** No data loss, logical precedence

### Step 11: Implement reference updates for private→public merge

- **Action:** Update all references when merging private song into public song
- **Tables:** `setlist_songs`, `band_songs`, `links`, `gig_documents`, `medley_songs`
- **Logic:** Change `songId` from private song ID to public song ID
- **Cleanup:** Delete private song after merge

### Step 12: Test that all references are updated when private song merges with public song

- **Test:** Create private song, add to setlist, make public (with conflict)
- **Expected:** Setlist now references public song, private song is deleted
- **Verify:** All relationships point to correct song

## Phase 5: Update Constraint Logic (Steps 13-14)

### Step 13: Update duplicate detection logic to allow private songs with same title/artist across different users

- **Files:** `routes/songs.js`, `routes/bands.js`, `routes/bulk-add-songs.js`
- **Action:** Modify duplicate detection queries
- **Logic:** Only check conflicts with public songs and same-user private songs
- **Allow:** Different users to have private songs with same title/artist

### Step 14: Test that different users can create private songs with same title/artist

- **Test:** User A creates private "Sugaree" by "Grateful Dead"
- **Test:** User B creates private "Sugaree" by "Grateful Dead"
- **Expected:** Both users can have their own private versions
- **Verify:** No constraint violations

## Phase 6: End-to-End Testing (Step 15)

### Step 15: Test end-to-end: create private song in quickset, edit it, make it public (with and without conflicts)

- **Scenario 1 - No Conflict:**
  1. Create private song via quickset
  2. Edit title/artist if needed
  3. Make public
  4. Verify song becomes public successfully

- **Scenario 2 - With Conflict:**
  1. Create private song via quickset
  2. Try to make public (conflict with existing public song)
  3. Verify merge happens correctly
  4. Verify all references are updated
  5. Verify private song is deleted

## Testing Strategy

### User Accounts Needed

- **User A:** `can_make_private=true`
- **User B:** `can_make_private=false`
- **User C:** `can_make_private=true` (for cross-user testing)

### Test Data

- Create test songs with various data combinations
- Test with and without artists
- Test with missing vs complete metadata

### Verification Points

- Database integrity after each operation
- UI behavior matches permissions
- No data loss during merges
- All references properly updated

## Success Criteria

- ✅ Private songs don't appear in suggestions for other users
- ✅ Users can create private songs via quickset (with permission)
- ✅ Private song owners can edit title/artist
- ✅ Private→public changes work with smart merging
- ✅ Different users can have private songs with same title/artist
- ✅ All database references are properly maintained
- ✅ No data loss or corruption during operations

## Files to Modify

- `routes/bands.js` - findSongMatches, quickset creation
- `routes/songs.js` - song editing, privacy changes
- `views/bands/quick-set-confirm.ejs` - add private checkbox
- `routes/bulk-add-songs.js` - duplicate detection (if needed)

## Database Considerations

- No schema changes needed
- Existing `private` and `created_by_id` fields are sufficient
- Focus on query logic and reference updates
