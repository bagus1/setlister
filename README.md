# Setlist Manager

A real-time collaborative setlist management system for bands. Multiple band members can simultaneously edit setlists with live drag-and-drop updates via Socket.io.

## Features

- **User Authentication** - Register/login with session management
- **Band Management** - Create bands, invite members via email
- **Song Database** - Add songs with artist, vocalist, key, duration, and BPM
- **Real-time Collaboration** - Live setlist editing with Socket.io
- **Drag & Drop Interface** - Intuitive setlist creation with 4 sets + "Maybe" list
- **Export & Print** - Finalize setlists with export options
- **Bulk Song Import** - Add multiple songs via text or CSV format

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
   *Note: Email invitations will be disabled if no SendGrid API key is provided*

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
├── models/                   # Sequelize database models
│   ├── index.js             # Database connection & associations
│   ├── User.js              # User authentication model
│   ├── Band.js              # Band model
│   ├── Song.js              # Song model with BPM field
│   └── ...                  # Other models
├── routes/                   # Express route handlers  
│   ├── auth.js              # Authentication routes
│   ├── dashboard.js         # Dashboard routes
│   ├── bands.js             # Band management
│   ├── songs.js             # Song CRUD operations
│   ├── setlists.js          # Setlist management
│   └── ...                  # Other route files
├── views/                    # EJS templates
│   ├── layout.ejs           # Main layout template
│   ├── dashboard/           # Dashboard views
│   ├── auth/                # Login/register forms
│   ├── bands/               # Band management pages
│   ├── songs/               # Song forms and lists
│   └── setlists/            # Setlist editor and export
├── public/                   # Static assets
│   └── js/
│       └── setlist-editor.js # Client-side drag & drop
└── utils/                    # Utility functions
    └── emailService.js       # SendGrid email integration
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