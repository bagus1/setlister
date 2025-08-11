const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Import models and routes
const db = require('./models');
const { router: authRoutes } = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const bandRoutes = require('./routes/bands');
const songRoutes = require('./routes/songs');
const artistRoutes = require('./routes/artists');
const medleyRoutes = require('./routes/medleys');
const setlistRoutes = require('./routes/setlists');
const invitationRoutes = require('./routes/invitations');
const bulkAddSongsRoutes = require('./routes/bulk-add-songs');
const linkRoutes = require('./routes/links');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store io instance in app for use in routes
app.set('io', io);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'setlist-manager-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.use(flash());

// Global middleware for flash messages and user
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Routes
app.use('/auth', authRoutes);
app.use('/', dashboardRoutes);
app.use('/bands', bandRoutes);
app.use('/songs', songRoutes);
app.use('/artists', artistRoutes);
app.use('/medleys', medleyRoutes);
app.use('/setlists', setlistRoutes);
app.use('/invite', invitationRoutes);
app.use('/bulk-add-songs', bulkAddSongsRoutes);
app.use('/songs', linkRoutes);
app.use('/songs', require('./routes/gig-documents'));

// Test DELETE route
app.delete('/test-delete', (req, res) => {
    console.log(`[${new Date().toISOString()}] Test DELETE route hit!`);
    res.json({ success: true, message: 'Test DELETE route works!' });
});

// TEMPORARY TEST ROUTE - Mock authentication for testing
app.get('/test-auth', (req, res) => {
    // Create a mock user session for testing
    req.session.user = {
        id: 7,
        username: 'John',
        email: 'john.g.haig@gmail.com'
    };
    req.session.currentBandId = 1; // Set a default band
    res.json({
        success: true,
        message: 'Mock authentication created',
        user: req.session.user,
        currentBandId: req.session.currentBandId
    });
});

// Simple DELETE route following web example pattern
app.delete('/items/:id', (req, res) => {
    console.log(`[${new Date().toISOString()}] DELETE items route hit:`, req.params);
    const itemId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] Attempting to delete item:`, itemId);
    res.status(204).send(); // Send a 204 No Content status for successful deletion
});

// Socket.io for real-time collaboration
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-setlist', (setlistId) => {
        socket.join(`setlist-${setlistId}`);
        socket.broadcast.to(`setlist-${setlistId}`).emit('user-joined', socket.id);
    });

    socket.on('leave-setlist', (setlistId) => {
        socket.leave(`setlist-${setlistId}`);
        socket.broadcast.to(`setlist-${setlistId}`).emit('user-left', socket.id);
    });

    socket.on('setlist-update', (data) => {
        socket.broadcast.to(`setlist-${data.setlistId}`).emit('setlist-updated', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found' });
});

const PORT = process.env.PORT || 3000;

// Sync database and start server
db.sequelize.sync({ alter: true }).then(() => {
    console.log(`[${new Date().toISOString()}] Database synced successfully`);
    server.listen(PORT, () => {
        console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error(`[${new Date().toISOString()}] Unable to connect to database:`, err);
}); 