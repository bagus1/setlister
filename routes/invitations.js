const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { User, Band, BandMember, BandInvitation } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// GET /invite/:token - Show invitation acceptance page
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find invitation
        const invitation = await BandInvitation.findOne({
            where: {
                token,
                usedAt: null,
                expiresAt: { [Op.gt]: new Date() }
            },
            include: [Band]
        });

        if (!invitation) {
            req.flash('error', 'This invitation is invalid or has expired');
            return res.redirect('/auth/login');
        }

        // Check if user already exists (case insensitive)
        const existingUser = await User.findOne({
            where: { email: invitation.email.toLowerCase() }
        });

        res.render('invitations/accept', {
            title: `Join ${invitation.Band.name}`,
            invitation,
            existingUser: !!existingUser
        });
    } catch (error) {
        console.error('Show invitation error:', error);
        req.flash('error', 'An error occurred loading the invitation');
        res.redirect('/auth/login');
    }
});

// POST /invite/:token/accept - Accept invitation
router.post('/:token/accept', [
    body('action').isIn(['login', 'register']).withMessage('Invalid action'),
    // Registration fields (conditional)
    body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').optional().custom((value, { req }) => {
        if (req.body.action === 'register' && value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    }),
    // Login fields (conditional)
    body('loginPassword').optional().notEmpty().withMessage('Password is required for login')
], async (req, res) => {
    try {
        const { token } = req.params;
        const { action, username, password, loginPassword } = req.body;

        // Find invitation
        const invitation = await BandInvitation.findOne({
            where: {
                token,
                usedAt: null,
                expiresAt: { [Op.gt]: new Date() }
            },
            include: [Band]
        });

        if (!invitation) {
            req.flash('error', 'This invitation is invalid or has expired');
            return res.redirect('/auth/login');
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const existingUser = await User.findOne({
                where: { email: invitation.email.toLowerCase() }
            });
            return res.render('invitations/accept', {
                title: `Join ${invitation.Band.name}`,
                invitation,
                existingUser: !!existingUser,
                errors: errors.array(),
                action,
                username
            });
        }

        let user;

        if (action === 'register') {
            // Check if user already exists (case insensitive)
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [
                        { email: invitation.email.toLowerCase() },
                        { username }
                    ]
                }
            });

            if (existingUser) {
                const existingUserCheck = await User.findOne({
                    where: { email: invitation.email.toLowerCase() }
                });
                return res.render('invitations/accept', {
                    title: `Join ${invitation.Band.name}`,
                    invitation,
                    existingUser: !!existingUserCheck,
                    errors: [{ msg: 'User with this email or username already exists' }],
                    action,
                    username
                });
            }

            // Create new user with lowercase email
            const hashedPassword = await bcrypt.hash(password, 12);
            user = await User.create({
                username,
                email: invitation.email.toLowerCase(),
                password: hashedPassword
            });

        } else if (action === 'login') {
            // Find existing user and verify password (case insensitive)
            user = await User.findOne({
                where: { email: invitation.email.toLowerCase() }
            });

            if (!user) {
                const existingUserCheck = await User.findOne({
                    where: { email: invitation.email.toLowerCase() }
                });
                return res.render('invitations/accept', {
                    title: `Join ${invitation.Band.name}`,
                    invitation,
                    existingUser: !!existingUserCheck,
                    errors: [{ msg: 'Invalid email or password' }],
                    action
                });
            }

            const isPasswordValid = await bcrypt.compare(loginPassword, user.password);
            if (!isPasswordValid) {
                const existingUserCheck = await User.findOne({
                    where: { email: invitation.email.toLowerCase() }
                });
                return res.render('invitations/accept', {
                    title: `Join ${invitation.Band.name}`,
                    invitation,
                    existingUser: !!existingUserCheck,
                    errors: [{ msg: 'Invalid email or password' }],
                    action
                });
            }
        }

        // Check if already a member
        const existingMembership = await BandMember.findOne({
            where: {
                bandId: invitation.bandId,
                userId: user.id
            }
        });

        if (!existingMembership) {
            // Add user to band
            await BandMember.create({
                bandId: invitation.bandId,
                userId: user.id,
                role: invitation.role
            });
        }

        // Mark invitation as used
        await invitation.update({ usedAt: new Date() });

        // Log user in
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email
        };

        req.flash('success', `Welcome to ${invitation.Band.name}! You've successfully joined the band.`);
        res.redirect(`/bands/${invitation.bandId}`);

    } catch (error) {
        console.error('Accept invitation error:', error);
        req.flash('error', 'An error occurred accepting the invitation');
        res.redirect(`/invite/${req.params.token}`);
    }
});

module.exports = router; 