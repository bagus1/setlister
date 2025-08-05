# 🎵 Setlist Manager - Administration Tool

The `manage.js` script provides a command-line interface for administrative tasks on your Setlist Manager application.

## Usage

### Interactive Mode
Run the script without arguments to enter interactive mode:

```bash
npm run manage
# or
node manage.js
```

### Command Line Mode
Run specific commands directly:

```bash
# List all users
npm run manage list-users

# List all bands
npm run manage list-bands

# List all songs
npm run manage list-songs

# Show application statistics
npm run manage stats

# Clean up orphaned data (expired invitations)
npm run manage cleanup
```

## Available Commands

### Interactive Menu Options:
1. **List all users** - Shows all registered users with IDs and creation dates
2. **List all bands** - Shows all bands with member counts
3. **List all songs** - Shows all songs with artists
4. **Delete user** - Remove a user and all their data (with confirmation)
5. **Delete band** - Remove a band and all related data (with confirmation)
6. **Delete song** - Remove a song and all band associations (with confirmation)
7. **Cleanup orphaned data** - Remove expired band invitations
8. **Show statistics** - Display application usage statistics
9. **Exit** - Quit the management tool

### Command Line Commands:
- `list-users` - List all users
- `list-bands` - List all bands
- `list-songs` - List all songs
- `stats` - Show application statistics
- `cleanup` - Clean up orphaned data

## Safety Features

- **Confirmation prompts** for all destructive operations
- **Cascading deletes** - Properly removes related data
- **Color-coded output** - Easy to read and understand
- **Error handling** - Graceful error messages

## Examples

### View Application Statistics
```bash
npm run manage stats
```

### Clean Up Expired Invitations
```bash
npm run manage cleanup
```

### List All Users (for finding IDs)
```bash
npm run manage list-users
```

### Delete a User (interactive)
```bash
npm run manage
# Then select option 4 and enter the user ID
```

## Database Safety

The script includes proper cascading deletes to maintain database integrity:

- **Deleting a user** removes their band memberships and invitations
- **Deleting a band** removes all related setlists, memberships, and invitations
- **Deleting a song** removes all band associations
- **Cleanup** only removes expired invitations

## Environment

The script uses the same database configuration as your main application, so it will work with your local development database or production database depending on your environment variables. 