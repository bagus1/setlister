# Setlist Manager

A real-time collaborative setlist management system for bands. Multiple band members can simultaneously edit setlists with live drag-and-drop updates via Socket.io.

## Features

- **User Authentication** - Register/login with session management and password reset
- **Band Management** - Create bands, invite members via email
- **Song Database** - Add songs with artist, vocalist, key, duration, and BPM
- **Real-time Collaboration** - Live setlist editing with Socket.io
- **Drag & Drop Interface** - Intuitive setlist creation with 4 sets + "Maybe" list
- **Export & Print** - Finalize setlists with export options
- **Bulk Song Import** - Add multiple songs via text or CSV format
- **Gig Documents** - Rich text editor for song lyrics, chords, and notes
- **Gig View** - Clean, print-friendly view for performance use
- **Audio Playlist** - Listen to all songs in a setlist with audio files before gigs

## Core Features

### Gig Documents

- **Rich Text Editor** - TinyMCE WYSIWYG editor with advanced formatting
- **Song-Specific Content** - Each song can have multiple document versions
- **Formatting Options** - Font sizes (5px-24px), weights, colors, line heights
- **Advanced Features** - Tables, indentation, paste cleanup, keyboard shortcuts
- **Version Control** - Track different versions of song documents
- **Public Access** - View documents without logging in

### Gig View

- **Performance-Ready** - Clean, legible view for on-stage use
- **Print Optimized** - Proper margins and formatting for printing
- **Song Metadata** - Shows song titles, keys, and timing
- **Compact Layout** - Minimal spacing for maximum content visibility
- **Font Consistency** - Matches WYSIWYG editor styling

### Audio Playlist

- **Pre-Gig Rehearsal** - Listen to all songs with audio files for a setlist before performances
- **Smart Filtering** - Only shows songs that have audio links attached
- **Player Controls** - Previous, restart, and next song navigation
- **Auto-Advance** - Automatically plays next song when current one ends
- **Set Organization** - Shows which set each song belongs to
- **Mobile Friendly** - Responsive design for all devices

## Prerequisites

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **Git** (for cloning the repository)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/bagus1/setlister.git
   cd setlister
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)
   Create a `.env` file for production configuration:

   ```bash
   # Required for production
   NODE_ENV=production
   SESSION_SECRET=generate-a-very-long-random-secure-string-at-least-a-billion-characters-long
   FROM_EMAIL=noreply@yourdomain.com
   BASE_URL=https://yourdomain.com

   # Optional - for email invitations
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   ```

   _Note: Email invitations will be disabled if no SendGrid API key is provided_

## Database Setup

The application uses SQLite with Sequelize ORM. The database will be automatically created when you first run the application.

### First Run - Database Creation

When you start the application for the first time:

1. **Sequelize will automatically create** `database.sqlite` in the project root
2. **All tables will be created** with proper schema and relationships
3. **No manual SQL commands needed** - everything is handled by the ORM

### Database Schema

The following tables will be created automatically:

- `users` - User accounts and authentication
- `bands` - Band information
- `band_members` - User-band relationships
- `songs` - Song database with title, key, time, BPM, etc.
- `artists` & `vocalists` - Auto-created from song entries
- `band_songs` - Songs associated with each band
- `setlists` - Setlist metadata
- `setlist_sets` - Set organization (Set 1, Set 2, Set 3, Set 4, Maybe)
- `setlist_songs` - Songs within sets with ordering
- `medleys` - Song combinations
- `band_invitations` - Email invitation system
- `password_resets` - Password reset tokens with expiration

### Resetting the Database

To start with a fresh database:

```bash
# Stop the server first
pkill -f "node server.js"

# Remove the existing database
rm database.sqlite

# Restart - a new database will be created automatically
npm start
```

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The application will be available at: **http://localhost:3000**

## Deployment & Production

### cPanel Deployment Setup

This application is configured to run on cPanel with Passenger. The deployment uses a Git-based workflow with automatic dependency management.

#### Prerequisites

- cPanel hosting with Node.js support
- Git repository (GitHub, GitLab, etc.)
- SSH access to your server

#### Server Configuration

1. **Create a Git repository** in cPanel's Git Version Control
2. **Set up the repository path**: `/home/username/repositories/setlister`
3. **Configure Passenger** via `.htaccess` file (automatically handled)
4. **Set environment variables** in cPanel's Node.js app settings

#### Environment Variables (Production)

Configure these in your cPanel Node.js app settings:

```
NODE_ENV=production
SESSION_SECRET=your-very-long-random-secret-string
FROM_EMAIL=noreply@yourdomain.com
BASE_URL=https://yourdomain.com
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

**⚠️ Security Note**: Environment variables are managed via a `.env` file on the server (not in Git) for security. The `.htaccess` file only contains non-sensitive configuration.

#### `.htaccess` Configuration

The `.htaccess` file configures Passenger and environment variables for each deployment environment. **This file is NOT in the repository** and must be created manually on the server.

**Production `.htaccess`** (`/home/username/repositories/setlister/.htaccess`):

```apache
### DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION BEGIN
<IfModule Litespeed>
SetEnv NODE_ENV production
SetEnv FROM_EMAIL noreply@yourdomain.com
SetEnv BASE_URL https://yourdomain.com
</IfModule>
### DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION END
### Passenger configuration
PassengerAppRoot /home/username/repositories/setlister
PassengerBaseURI /
PassengerNodejs /opt/alt/alt-nodejs20/root/usr/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerAppLogFile /home/username/logs/setlist-passenger.log
```

**Demo/Staging `.htaccess`** (if using separate demo environment):

```apache
### DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION BEGIN
<IfModule Litespeed>
SetEnv NODE_ENV demo
SetEnv FROM_EMAIL noreply@yourdomain.com
SetEnv BASE_URL https://demo.yourdomain.com
</IfModule>
### DO NOT REMOVE OR MODIFY. CLOUDLINUX ENV VARS CONFIGURATION END
### Passenger configuration
PassengerAppRoot /home/username/repositories/demoset
PassengerBaseURI /
PassengerNodejs /opt/alt/alt-nodejs20/root/usr/bin/node
PassengerAppType node
PassengerStartupFile server.js
PassengerAppLogFile /home/username/logs/setlist-passenger.log
```

**Important Notes:**

- Replace `username` with your actual cPanel username
- Replace `yourdomain.com` with your actual domain
- The `PassengerAppRoot` must point to the correct repository directory
- `NODE_ENV` determines which database configuration is used
- `.htaccess` is in `.gitignore` to prevent accidental commits

## Deployment

The project includes `deploy.sh` for automated deployment and server management.

### 🎯 Quick Reference

**Most Common Commands:**

```bash
./deploy.sh quick     # Fast updates (UI/templates) - no restart
./deploy.sh deploy    # Full deployment with restart
./deploy.sh migrate   # Run database migrations (Prisma)
./deploy.sh restart   # Just restart the server
./deploy.sh status    # Check deployment status
```

**Emergency Commands:**

```bash
./deploy.sh rollback  # Revert to previous commit
./deploy.sh backup    # Create backup before changes
./deploy.sh stop      # Stop server
./deploy.sh start     # Start server
```

### Setup

1. **Make the script executable**:

   ```bash
   chmod +x deploy.sh
   ```

2. **Configure environment variables** (optional):
   ```bash
   export HOST_USER=your_username
   export HOST_DOMAIN=your_domain.com
   export SETLIST_PATH=/path/to/your/app
   ```

### Deployment Modes

The script provides multiple deployment modes for different scenarios:

#### **📋 Deployment Modes Reference Table**

| Mode               | **Local Git Operations**                           | **Server Git Operations** | **Server Restart**   | **Use Case**                              |
| ------------------ | -------------------------------------------------- | ------------------------- | -------------------- | ----------------------------------------- |
| **`deploy`**       | ✅ `git add .`<br>✅ `git commit`<br>✅ `git push` | ✅ `git pull`             | ✅ Yes               | Full deployment with new changes          |
| **`update`**       | ✅ `git add .`<br>✅ `git commit`<br>✅ `git push` | ✅ `git pull`             | ✅ Yes               | Quick deploy (push and pull with restart) |
| **`quick`**        | ✅ `git add .`<br>✅ `git commit`<br>✅ `git push` | ✅ `git pull`             | ❌ No                | Fast file updates (UI/templates)          |
| **`migrate`**      | ❌ None                                            | ❌ None                   | ✅ Yes               | Run database migrations (Prisma)          |
| **`safe-migrate`** | ❌ None                                            | ❌ None                   | ✅ Yes               | Safe migrations with backup (Prisma)      |
| **`restart`**      | ❌ None                                            | ❌ None                   | ✅ Yes               | Just restart the server                   |
| **`stop`**         | ❌ None                                            | ❌ None                   | ❌ Kills process     | Stop the server                           |
| **`start`**        | ❌ None                                            | ❌ None                   | ✅ Touch restart.txt | Start the server                          |
| **`deps`**         | ❌ None                                            | ❌ None                   | ❌ No                | Update npm dependencies                   |
| **`status`**       | ❌ None                                            | ❌ None                   | ❌ No                | Show deployment status                    |
| **`backup`**       | ❌ None                                            | ❌ None                   | ❌ No                | Create server backup                      |
| **`rollback`**     | ✅ `git reset --hard`<br>✅ `git push --force`     | ✅ `git reset --hard`     | ✅ Yes               | Rollback to previous commit               |

#### **🚀 Primary Deployment Modes**

#### **Quick Updates** (Most Common)

```bash
./deploy.sh quick
```

- Commits and pushes changes
- Updates files on server
- **No server restart** (fastest!)
- Perfect for: UI changes, templates, CSS, JavaScript

#### **Full Deployment**

```bash
./deploy.sh deploy
```

- Commits and pushes changes
- Updates files on server
- **Restarts server**
- Use for: major changes, server.js updates, dependencies

#### **Quick Deploy with Restart**

```bash
./deploy.sh update
```

- Commits and pushes changes
- Updates files on server
- **Restarts server**
- Use for: quick deployments that need server restart

#### **Server Management**

```bash
./deploy.sh restart    # Restart server
./deploy.sh stop       # Stop server
./deploy.sh start      # Start server
./deploy.sh status     # Check deployment status
```

#### **Dependencies**

```bash
./deploy.sh deps       # Update dependencies on server
```

#### **Backup & Recovery**

```bash
./deploy.sh backup     # Create backup
./deploy.sh rollback   # Rollback to previous commit
```

### 🗄️ **Prisma Database Migrations** (NEW!)

The deployment script now includes **automatic Prisma schema change detection** and **safe database migration handling** for PostgreSQL deployments.

#### **🔍 Automatic Schema Detection**

The script automatically detects when `prisma/schema.prisma` changes and:

- ✅ **Stops the server** before making database changes
- ✅ **Regenerates the Prisma client** after schema changes
- ✅ **Runs database migrations** using `prisma migrate deploy`
- ✅ **Restarts the server** with the new schema
- ✅ **Verifies server health** after deployment

#### **🚀 Prisma-Safe Deployment Modes**

| Mode               | **Schema Changes** | **Server Stop/Start** | **Prisma Client** | **Use Case**                          |
| ------------------ | ------------------ | --------------------- | ----------------- | ------------------------------------- |
| **`deploy`**       | ✅ Auto-detected   | ✅ Smart handling     | ✅ Regenerated    | Full deployment with schema awareness |
| **`migrate`**      | ✅ Manual trigger  | ✅ Full stop/start    | ✅ Regenerated    | Just run database migrations          |
| **`safe-migrate`** | ✅ Manual trigger  | ✅ Full stop/start    | ✅ Regenerated    | Extra safe with backup capability     |

#### **📋 Prisma Migration Commands**

```bash
# Run migrations with server stop/start
./deploy.sh migrate

# Extra safe migration with backup
./deploy.sh safe-migrate

# Check if migrations are needed
./deploy.sh status
```

#### **🛡️ Safety Features**

- **Server State Management**: Automatically stops server before database changes
- **Process Verification**: Ensures server actually stops/starts
- **Health Checks**: Verifies server responds after deployment
- **Rollback Capability**: Can recover from failed migrations
- **Migration Safety**: Uses `prisma migrate deploy` instead of `db push`

#### **⚠️ Important Notes**

- **Always test locally** before deploying schema changes
- **Backup your database** before major schema changes
- **Server will be briefly unavailable** during migrations
- **Use `safe-migrate`** for critical production changes

### Typical Workflow

1. **Make changes** to your code
2. **Quick update**: `./deploy.sh quick` (for most changes)
3. **If issues arise**: `./deploy.sh restart` to restart server
4. **For major changes**: `./deploy.sh deploy` for full deployment

### Production Deployment

1. **Initial Setup**:

   ```bash
   ./deploy.sh deps
   ```

2. **Deploy**: `./deploy.sh deploy` (automatically installs on server)

### Development Workflow

1. **Make changes** locally
2. **Test locally**: `npm start`
3. **Deploy**: `./deploy.sh deploy`

### Server Management

- **Check status**: `./deploy.sh status`
- **Restart server**: `./deploy.sh restart`
- **Update dependencies**: `./deploy.sh deps`
- **Create backup**: `./deploy.sh backup`
- **Rollback**: `./deploy.sh rollback`

### Best Practices

- **Use `quick` mode** for most UI/template changes
- **Use `deploy` mode** for server.js or dependency changes
- **Use `migrate` mode** for database schema changes (Prisma)
- **Use `safe-migrate` mode** for critical production schema changes
- **Backup regularly**: Use `./deploy.sh backup` to create backups
- **Check status**: Use `./deploy.sh status` to verify deployment
- **Test locally** before deploying to production
- **Always backup database** before major schema changes

### Dependency Management

#### Automatic Dependency Updates

The deployment script automatically detects when `package.json` changes and installs dependencies:

- **`deploy`** mode: Full deployment with auto-dependency install
- **`quick`** mode: Quick deploy with auto-dependency install

#### Manual Dependency Updates

If you need to update dependencies manually:

```bash
./deploy.sh deps
```

#### Adding New Dependencies

1. **Add locally**: `npm install package-name`
2. **Commit changes**: `git add package.json package-lock.json && git commit -m "Add new dependency"`
3. **Deploy**: `./deploy.sh deploy` (automatically installs on server)

#### Updating Existing Dependencies

1. **Update locally**: `npm update` or `npm install package@version`
2. **Commit changes**: `git add package.json package-lock.json && git commit -m "Update dependencies"`
3. **Deploy**: `./deploy.sh deploy`

#### Troubleshooting Dependencies

If you encounter dependency issues:

1. **Check Passenger logs**:

   ```bash
   ssh username@server.com "tail -20 /home/username/logs/setlist-passenger.log"
   ```

2. **Force reinstall dependencies**:

   ```bash
   ./deploy.sh deps
   ```

3. **Check if node_modules exists**:

   ```bash
   ssh username@server.com "ls -la /home/username/repositories/setlister/node_modules"
   ```

4. **Manual dependency installation** (if needed):
   ```bash
   ssh username@server.com "cd /home/username/repositories/setlister && PATH=/opt/alt/alt-nodejs20/root/usr/bin:\$PATH /opt/alt/alt-nodejs20/root/usr/bin/npm install --production"
   ```

### Production Considerations

#### Database

- **SQLite file**: Located at `/home/username/repositories/setlister/database.sqlite`
- **Backup regularly**: Use `./deploy.sh backup` to create backups
- **File permissions**: Ensure the database file is writable by the web server

#### Logs

- **Passenger logs**: `/home/username/logs/setlist-passenger.log`
- **Application logs**: Check server console output in cPanel Node.js manager

#### Performance

- **Static assets**: Served directly by Apache/Passenger
- **Database**: SQLite is suitable for small to medium-sized applications
- **Memory**: Monitor memory usage in cPanel

#### Security

- **Environment variables**: Never commit sensitive data to Git
- **Session secret**: Use a strong, random string for `SESSION_SECRET`
- **HTTPS**: Configure SSL certificate for production domain
- **Email verification**: Set up proper SendGrid configuration for invitations

### Deployment Workflow

#### Typical Development Cycle

1. **Make changes locally**
2. **Test thoroughly** on local development server
3. **Commit changes**: `git add . && git commit -m "Description of changes"`
4. **Deploy**: `./deploy.sh deploy`
5. **Verify**: Check the production site

#### Emergency Rollback

If a deployment causes issues:

```bash
./deploy.sh rollback
```

#### Creating Backups

Before major changes:

```bash
./deploy.sh backup
```

### Monitoring & Maintenance

#### Check Server Status

```bash
./deploy.sh status
```

#### View Recent Logs

```bash
ssh username@server.com "tail -f /home/username/logs/setlist-passenger.log"
```

#### Monitor Process

```bash
ssh username@server.com "ps aux | grep -E '(server|setlist|node)'"
```

#### Restart After Configuration Changes

```bash
./deploy.sh restart
```

## First Time Setup

1. **Access the application** at http://localhost:3000
2. **Register** a new user account
3. **Create your first band**
4. **Add some songs** to the system
5. **Manage your band's repertoire** by selecting songs
6. **Create a setlist** and start organizing with drag & drop

## Usage

### Adding Songs

- Use the "Add New Song" form with artist and vocalist auto-complete
- Optionally add key, duration (minutes:seconds), and BPM
- Use "Bulk Add Songs" for importing multiple songs at once

### Managing Band Songs

- Go to "Manage Songs" for your band
- Click song cards to add/remove them from your band's repertoire
- Visual feedback shows selected songs with borders

### Creating Setlists

- Create a new setlist from your band dashboard
- Drag songs from "Band Songs" into Set 1, Set 2, Set 3, Set 4, or Maybe
- Changes sync in real-time with other band members
- Reorder songs within sets by dragging

### Collaboration

- Multiple band members can edit the same setlist simultaneously
- All changes appear instantly via Socket.io
- No need to refresh or coordinate - just start editing

### Finalizing Setlists

- Review total time and song counts (excluding "Maybe" songs)
- Use "Copy Titles" to copy set lists to clipboard
- Export setlist as CSV with song details (Set, Order, Title, Artist, Vocalist, Key, Time, BPM)
- Print view available for physical setlists

### Gig Documents

- Create detailed song documents with lyrics, chords, and notes
- Use the rich text editor for advanced formatting and styling
- Set preferred gig documents for each song in your band's repertoire
- Access documents publicly without logging in
- Print optimized views for on-stage use

### Gig View

- View finalized setlists in a clean, performance-ready format
- Optimized for printing with proper margins and spacing
- Shows song titles, keys, and timing information
- Compact layout maximizes content visibility
- Perfect for on-stage reference during performances

### Audio Playlist

- Access playlist view from the finalize page
- Listen to all songs with audio files before gigs
- Navigate between songs with previous, restart, and next controls
- Auto-advance to next song when current one finishes
- See set organization and song metadata
- Mobile-friendly interface for rehearsal anywhere

## Administrative Tools

### CLI Management Tool

Certain administrative functions are only available through the command-line interface (CLI) for security and data integrity reasons.

#### Available Commands

**Local Database Management:**

```bash
npm run manage
```

**Server Database Management:**

```bash
# Interactive mode
ssh bagus1@bagus.org "/home/bagus1/repositories/setlister/manage-server.sh"
# Note: if your environmental variables are set properly your command will be
#       printed out properly when you run npm run manage locally to make
#       it easy to connect to the cli on your server.

# Command line mode
npm run manage server list-bands
npm run manage server list-users
npm run manage server stats
```

#### CLI-Only Functions

The following functions are **only available through the CLI** and cannot be performed through the web interface:

- **User Management**
  - List all users with creation dates
  - Delete users (with cascading cleanup of related data)
  - View user statistics

- **Band Management**
  - List all bands with member counts
  - Delete bands (removes all associated data)
  - View band statistics

- **Song Management**
  - List all songs in the database
  - Delete songs (removes from all bands and setlists)
  - View song statistics

- **Data Cleanup**
  - Remove orphaned data (expired invitations, unused records)
  - Clean up database inconsistencies
  - View overall application statistics

- **System Statistics**
  - Total users, bands, songs, setlists
  - Active invitations count
  - Database health metrics

#### Security Considerations

- **No web interface** for destructive operations to prevent accidental data loss
- **Confirmation prompts** for all delete operations
- **Cascading deletes** ensure data consistency when removing records
- **Local and remote access** with proper authentication

#### Usage Examples

```bash
# View all users
npm run manage list-users

# Delete a specific user (with confirmation)
npm run manage delete-user

# View system statistics
npm run manage stats

# Clean up orphaned data
npm run manage cleanup

# Server operations
npm run manage server list-bands
npm run manage server stats
```

For detailed CLI documentation, see [MANAGEMENT.md](MANAGEMENT.md).

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite with Sequelize ORM
- **Frontend**: EJS templates, Bootstrap 5
- **Real-time**: Socket.io
- **Authentication**: express-session, bcryptjs
- **Email**: SendGrid (optional)
- **File Upload**: Multer (for bulk imports)

## File Structure

```
setlister/
├── server.js                 # Main application server
├── package.json              # Dependencies and scripts
├── manage.js                 # CLI management tool
├── manage-server.sh          # Server management script
├── deploy.sh                 # Git-based deployment script
├── ftploy.sh                 # FTP deployment script (legacy)
├── Passengerfile.json        # Passenger configuration
├── database.sqlite           # SQLite database file
├── .gitignore                # Git ignore rules
├── models/                   # Sequelize database models
│   ├── index.js             # Database connection & associations
│   ├── User.js              # User authentication model
│   ├── Band.js              # Band model
│   ├── Song.js              # Song model with BPM field
│   ├── Artist.js            # Artist model
│   ├── Vocalist.js          # Vocalist model
│   ├── BandMember.js        # Band membership model
│   ├── BandSong.js          # Band-song associations
│   ├── Setlist.js           # Setlist model
│   ├── SetlistSet.js        # Set organization model
│   ├── SetlistSong.js       # Setlist song model
│   ├── Medley.js            # Medley model
│   ├── MedleySong.js        # Medley song associations
│   ├── BandInvitation.js    # Email invitation model
│   ├── PasswordReset.js     # Password reset model
│   ├── GigDocument.js       # Song documents and lyrics
│   └── Link.js              # Song links (audio, video, etc.)
├── routes/                   # Express route handlers
│   ├── auth.js              # Authentication routes
│   ├── dashboard.js         # Dashboard routes
│   ├── bands.js             # Band management
│   ├── songs.js             # Song CRUD operations
│   ├── setlists.js          # Setlist management
│   ├── bulk-add-songs.js    # Bulk song import
│   ├── invitations.js       # Invitation management
│   ├── medleys.js           # Medley management
│   ├── artists.js           # Artist management
│   ├── gig-documents.js     # Gig document management
│   └── links.js             # Song link management
├── views/                    # EJS templates
│   ├── layout.ejs           # Main layout template
│   ├── error.ejs            # Error page template
│   ├── dashboard/           # Dashboard views
│   ├── auth/                # Login/register forms
│   ├── bands/               # Band management pages
│   ├── songs/               # Song forms and lists
│   ├── setlists/            # Setlist editor and export
│   ├── invitations/         # Invitation pages
│   ├── artists/             # Artist management pages
│   ├── gig-documents/       # Gig document editor and views
│   └── links/               # Song link management
├── public/                   # Static assets
│   └── js/
│       ├── setlist-editor.js # Client-side drag & drop
│       └── gig-document-editor.js # WYSIWYG editor functionality
├── utils/                    # Utility functions
│   └── emailService.js       # SendGrid email integration
└── docs/                     # Documentation
    └── user-guide.html       # HTML user guide
```

## Troubleshooting

### Port Already in Use

If port 3000 is busy, kill existing processes:

```bash
pkill -f "node server.js"
```

### Database Connection Issues

If you encounter database connection errors:

1. Ensure the project directory is writable
2. Try deleting `database.sqlite` and restarting (creates fresh database)
3. Check that no other processes are using the database file

## Development

### Adding New Features

1. Create/modify Sequelize models in `models/`
2. Add routes in appropriate files under `routes/`
3. Create EJS templates in `views/`
4. Update client-side JavaScript if needed

### Database Changes

For schema changes, either:

- Delete `database.sqlite` to recreate (loses data)
- Manually alter tables with SQL commands
- Use Sequelize migrations (not currently configured)

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions, please create an issue on the GitHub repository.
