const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Please log in to access this page');
        res.redirect('/auth/login');
    }
};

// Middleware to redirect if already logged in
const redirectIfLoggedIn = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
};

// GET /auth/register - Show registration form
router.get('/register', redirectIfLoggedIn, (req, res) => {
    res.render('auth/register', { title: 'Register' });
});

// POST /auth/register - Handle registration
router.post('/register', [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/register', {
                title: 'Register',
                errors: errors.array(),
                username: req.body.username,
                email: req.body.email
            });
        }

        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });

        if (existingUser) {
            return res.render('auth/register', {
                title: 'Register',
                errors: [{ msg: 'User with this email or username already exists' }],
                username,
                email
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            username,
            email,
            password: hashedPassword
        });

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        req.flash('success', 'Registration successful! Welcome to Setlist Manager');
        res.redirect('/');
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'An error occurred during registration');
        res.redirect('/auth/register');
    }
});

// GET /auth/login - Show login form
router.get('/login', redirectIfLoggedIn, (req, res) => {
    res.render('auth/login', { title: 'Login' });
});

// POST /auth/login - Handle login
router.post('/login', [
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/login', {
                title: 'Login',
                errors: errors.array(),
                email: req.body.email
            });
        }

        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.render('auth/login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('auth/login', {
                title: 'Login',
                errors: [{ msg: 'Invalid email or password' }],
                email
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        req.flash('success', 'Login successful!');
        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
        res.redirect('/auth/login');
    }
});

// GET /auth/logout - Handle logout (for links)
router.get('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

// POST /auth/logout - Handle logout (for forms)
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});

module.exports = { router, requireAuth }; 