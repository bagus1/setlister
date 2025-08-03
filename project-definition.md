# Setlist Manager - Project Definition

## 📋 **Project Overview**

A real-time collaborative setlist management system for bands, supporting multiple users working on the same setlist simultaneously with live drag-and-drop updates. This Express.js application provides comprehensive band management tools with Socket.io-powered real-time collaboration.

**Repository**: https://github.com/bagus1/setlister  
**Status**: ✅ **COMPLETE & RUNNING** on http://localhost:3000

---

## 🎯 **Core Requirements Specification**

### **Dashboard Functionality**

#### Logged In Users:
- **Bands Card**: List of bands user is part of + create button
- **Songs Card**: Most recent songs + add songs button  
- **Medleys Card**: Most recent medleys + add medleys button
- **Artists Card**: List of artists (linked)
- **User Card**: Username/signout functionality

#### Logged Out Users:
- **Bands List**: Unlinked, no create button
- **Songs List**: Linked, no create button
- **Artists List**: Linked

### **Band Management**
**Route**: `/bands/x`
- **Setlists Card**: List of setlists with edit links + create buttons (songlist/setlist)
- **Member Invitations**: Inline email field with submit button for "invite new member"
- **Band Songs Management**: `/bands/x/songs` - Card interface to add/remove songs from band

### **Song Management** 
**Route**: `/songs` (index) and `/songs/x` (individual)

#### Key Features:
- **Artist Auto-fill**: Types to search existing artists, creates new ones automatically
- **Vocalist Auto-fill**: Same system as artists, but different vocalists don't create new songs
- **Duplicate Handling**: Same title + different artist = different songs; same title + different vocalist = edit existing
- **Time Field**: Duration tracking for set length calculations
- **Color Coding**: Clear visual distinction for title, vocalist, and key
- **Excluded Features**: No lyrics, chords, tabs, or videos support

### **Artist Management**
**Route**: `/artists` (list) and `/artists/x` (artist songs)
- **Artist Pages**: Show all songs by that artist
- **Create Links**: Direct links to `/songs/new` for adding songs

### **Medley System**
- **Definition**: Combination of multiple songs into one record
- **Naming**: Auto-concatenate first two words of songs + "medley"
- **Display**: Shows as single song in song lists
- **Creation**: Form to name medley and add multiple songs

### **Setlist Management**

#### **Setlist Creation** (`/bands/x/setlists/y/edit`)
- **Auto-creation**: New setlist button creates DB record and redirects to edit
- **Socket.io Powered**: Real-time collaboration between band members
- **Layout**: 
  - Left side: All band songs
  - Right side: 5 drop areas (4 sets + "maybe" list)
- **Actions**: Save button, "Finalize setlist" button

#### **Setlist Finalization** (`/bands/x/setlists/x/finalize`)
- **Socket.io Powered**: Real-time collaborative editing
- **Layout**: Songs displayed in rows of two sets each
- **Reordering**: Drag-drop between sets and within sets
- **Deletion Logic**: 
  - Delete from set → moves to maybe list
  - Delete from maybe → removes completely
- **Controls**: Save and cancel buttons
- **Calculations**: Set length and total time (excluding maybes)

#### **Print/Export** (`/bands/x/setlists/x/print`)
- **Default**: Song titles only
- **Optional Fields**: Artist, vocalist, length, key
- **Format**: One song per line text export
- **Customizable**: Controls to select which fields to include

#### **CSV Export** (`/setlists/x/export-csv`)
- **Format**: Comma-separated values file download
- **Fields**: Set, Order, Title, Artist, Vocalist, Key, Time, BPM
- **Usage**: Direct download for spreadsheet applications
- **Data**: Complete song information for each setlist song

---

## ✅ **Implementation Status**

### **Completed Core Features**
- ✅ **Authentication System** - Login/Register with sessions
- ✅ **Dashboard** - Dual views for logged in/out users with all specified cards
- ✅ **Band Management** - Create bands, invite members, manage songs
- ✅ **Song Management** - Auto-fill artists/vocalists, time tracking, key support
- ✅ **Artist Management** - Auto-created from songs, linked to song lists
- ✅ **Medley Support** - Multi-song combinations with auto-naming
- ✅ **Real-time Setlist Collaboration** - Socket.io powered drag-and-drop
- ✅ **4-Set + Maybe Structure** - Exactly as specified
- ✅ **Setlist Finalization & Export** - Print views with customizable options and CSV export
- ✅ **Color-coded UI** - Visual distinction for title, vocalist, and key
- ✅ **Time Calculations** - Set length tracking and total timing

### **Advanced Features Added**
- ✅ **Email Invitations** - SendGrid-powered band member invitations
- ✅ **Bulk Song Import** - CSV and text format support
- ✅ **Date-based Editing Restrictions** - Setlists lock after performance date
- ✅ **Copy to Clipboard** - Export setlist titles with formatting
- ✅ **Responsive Design** - Mobile-friendly interface
- ✅ **Loading States** - Visual feedback for AJAX operations

---

## 🛠 **Technology Stack**

### **Backend**
- **Framework**: Node.js + Express.js
- **Database**: SQLite with Sequelize ORM  
- **Authentication**: Session-based with bcryptjs
- **Email**: SendGrid API for invitations
- **Validation**: express-validator

### **Frontend**
- **Templates**: EJS with express-ejs-layouts
- **Styling**: Bootstrap 5 + custom CSS
- **JavaScript**: Vanilla JS with SortableJS
- **Real-time**: Socket.io for collaboration

### **Database Schema**
```
users → authentication & profiles
bands → band information 
band_members → user-band relationships with roles
songs → master song database (title, artist, vocalist, key, time)
artists & vocalists → auto-created from song entries
band_songs → which songs each band plays
setlists → setlist metadata with finalization status
setlist_sets → 4 sets + maybe list structure  
setlist_songs → songs within sets with ordering
medleys & medley_songs → multi-song combinations
band_invitations → email invitation tokens
```

---

## 🚀 **Quick Start Guide**

### **Installation**
```bash
# Clone repository
git clone https://github.com/bagus1/setlister.git
cd setlister

# Install dependencies  
npm install

# Start server
npm start
# OR for development with auto-reload:
npm run dev
```

### **First Use Workflow**
1. **Visit** http://localhost:3000
2. **Register** new user account
3. **Create** first band 
4. **Add** songs to system (artists/vocalists auto-created)
5. **Manage** band's song selection at `/bands/1/songs`
6. **Create** new setlist for collaborative editing
7. **Drag songs** between sets in real-time
8. **Finalize** and export completed setlist

---

## 🎭 **Key Workflow Patterns**

### **Song Creation Flow**
1. User types in song form
2. Artist field auto-completes from existing artists
3. If new artist typed → creates new Artist record
4. Vocalist field auto-completes from existing vocalists  
5. Same title + different artist = new Song
6. Same title + different vocalist = prompts to edit existing

### **Setlist Collaboration Flow**
1. Band member creates setlist → auto-redirects to edit page
2. Share edit URL with other band members
3. All users see real-time updates via Socket.io
4. Drag-drop operations sync across all connected clients
5. Auto-save prevents data loss

### **Band Management Flow**
1. Create band → becomes admin/creator
2. Invite members via email (SendGrid)
3. Manage which songs band plays at `/bands/x/songs`
4. Only band songs available in setlist editor
5. Collaborative setlist creation and finalization

---

## 🔧 **File Structure**
```
setlister/
├── server.js              # Main Express server with Socket.io
├── package.json           # Dependencies & scripts
├── models/                # Sequelize models & associations  
├── routes/                # Express route handlers
├── views/                 # EJS templates with Bootstrap
├── public/js/             # Client-side JavaScript
├── utils/                 # Email service & utilities
└── database.sqlite        # SQLite database file
```

---

## 📊 **Project Metrics**
- **Files**: 5,606 files (10.26 MB)
- **Backend Routes**: ~15 route files covering all functionality
- **Database Tables**: 12 tables with full relationships
- **Frontend Views**: ~25 EJS templates
- **Real-time Features**: Socket.io collaboration on setlist editing
- **External APIs**: SendGrid for email invitations

---

## 🎯 **Unique Value Propositions**

1. **Requirements Compliance**: Built exactly to original specifications
2. **Real-time Collaboration**: Functional Socket.io implementation  
3. **Professional UI/UX**: Bootstrap + custom styling for music workflows
4. **Complete Feature Set**: All requirements implemented and tested
5. **Production Ready**: Authentication, validation, error handling
6. **Extensible**: Clean architecture supports future enhancements

---

**Status**: ✅ **Production Ready** - All core requirements implemented and functioning 