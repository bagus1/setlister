const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService");
const logger = require("../utils/logger");

const router = express.Router();

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  // TEMPORARY TEST BYPASS - Remove this in production
  if (req.headers["x-test-auth"] === "test123") {
    req.session.user = {
      id: 999,
      username: "testuser",
      email: "test@test.com",
    };
    req.session.currentBandId = 1;
    return next();
  }

  if (req.session.user) {
    next();
  } else {
    req.flash("error", "Please log in to access this page");
    // Capture the current URL to return to after login
    const returnTo = req.originalUrl;
    res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
};

// Middleware to redirect if already logged in
const redirectIfLoggedIn = (req, res, next) => {
  if (req.session.user) {
    res.redirect("/");
  } else {
    next();
  }
};

// GET /auth/register - Show registration form
router.get("/register", redirectIfLoggedIn, (req, res) => {
  res.render("auth/register", { title: "Register" });
});

// POST /auth/register - Handle registration
router.post(
  "/register",
  [
    body("username")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("auth/register", {
          title: "Register",
          errors: errors.array(),
          username: req.body.username,
          email: req.body.email,
        });
      }

      const { username, email, password } = req.body;
      const emailLower = email.toLowerCase();

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailLower }, { username }],
        },
      });

      if (existingUser) {
        return res.render("auth/register", {
          title: "Register",
          errors: [{ msg: "User with this email or username already exists" }],
          username,
          email,
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user with lowercase email
      const user = await prisma.user.create({
        data: {
          username,
          email: emailLower,
          password: hashedPassword,
          canMakePrivate: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Check for pending invitations for this email (case insensitive)
      const pendingInvitations = await prisma.bandInvitation.findMany({
        where: {
          email: { contains: emailLower, mode: "insensitive" }, // Case insensitive search
          used_at: null,
          expires_at: { gt: new Date() },
        },
        include: { band: true },
      });

      // Automatically add user to bands they have pending invitations for
      if (pendingInvitations.length > 0) {
        const bandMemberships = [];
        const usedInvitations = [];

        for (const invitation of pendingInvitations) {
          // Add user to band as a member
          bandMemberships.push({
            bandId: invitation.bandId,
            userId: user.id,
            role: "member",
          });

          // Mark invitation as used
          usedInvitations.push(invitation.id);
        }

        // Create band memberships
        if (bandMemberships.length > 0) {
          await prisma.bandMember.createMany({
            data: bandMemberships.map((membership) => ({
              ...membership,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          });
        }

        // Mark invitations as used
        if (usedInvitations.length > 0) {
          await prisma.bandInvitation.updateMany({
            data: { used_at: new Date() },
            where: { id: { in: usedInvitations } },
          });
        }
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      // Log successful registration
      logger.logAuthEvent("registration successful", user.id);

      if (pendingInvitations.length > 0) {
        req.flash(
          "success",
          `Registration successful! You've been automatically added to ${pendingInvitations.length} band(s) you were invited to.`
        );
      } else {
        req.flash(
          "success",
          "Registration successful! Welcome to Setlist Manager"
        );
      }
      res.redirect("/");
    } catch (error) {
      console.error("Registration error:", error);
      req.flash("error", "An error occurred during registration");
      res.redirect("/auth/register");
    }
  }
);

// GET /auth/login - Show login form
router.get("/login", redirectIfLoggedIn, (req, res) => {
  const returnTo = req.query.returnTo || "/";
  res.render("auth/login", {
    title: "Login",
    returnTo: returnTo,
  });
});

// POST /auth/login - Handle login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.render("auth/login", {
          title: "Login",
          errors: errors.array(),
          email: req.body.email,
          returnTo: req.body.returnTo || "/",
        });
      }

      const { email, password } = req.body;
      const emailLower = email.toLowerCase();

      // Find user (case insensitive)
      const user = await prisma.user.findFirst({
        where: { email: emailLower },
      });
      if (!user) {
        return res.render("auth/login", {
          title: "Login",
          errors: [{ msg: "Invalid email or password" }],
          email,
          returnTo: req.body.returnTo || "/",
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.render("auth/login", {
          title: "Login",
          errors: [{ msg: "Invalid email or password" }],
          email,
          returnTo: req.body.returnTo || "/",
        });
      }

      // Check for pending invitations for this email (case insensitive)
      let pendingInvitations = [];
      try {
        pendingInvitations = await prisma.bandInvitation.findMany({
          where: {
            email: { contains: emailLower, mode: "insensitive" }, // Case insensitive search
            used_at: null,
            expires_at: { gt: new Date() },
          },
        });

        if (pendingInvitations.length > 0) {
          console.log(
            `[${new Date().toISOString()}] LOGIN: Processing ${pendingInvitations.length} invitations`
          );
        }
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] LOGIN: Error checking invitations:`,
          error
        );
      }

      // Automatically add user to bands they have pending invitations for
      if (pendingInvitations.length > 0) {
        const bandMemberships = [];
        const usedInvitations = [];

        for (const invitation of pendingInvitations) {
          // Check if user is already a member of this band
          const existingMembership = await prisma.bandMember.findFirst({
            where: {
              bandId: invitation.bandId,
              userId: user.id,
            },
          });

          if (!existingMembership) {
            // Add user to band as a member
            bandMemberships.push({
              bandId: invitation.bandId,
              userId: user.id,
              role: "member",
            });
          }

          // Mark invitation as used
          usedInvitations.push(invitation.id);
        }

        // Create band memberships
        if (bandMemberships.length > 0) {
          await prisma.bandMember.createMany({
            data: bandMemberships.map((membership) => ({
              ...membership,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          });
        }

        // Mark invitations as used
        if (usedInvitations.length > 0) {
          await prisma.bandInvitation.updateMany({
            data: { used_at: new Date() },
            where: { id: { in: usedInvitations } },
          });
        }

        console.log(
          `[${new Date().toISOString()}] User ${user.email} automatically added to ${bandMemberships.length} bands during login`
        );
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
      };

      // Log successful login
      logger.logAuthEvent("login successful", user.id);

      if (pendingInvitations.length > 0) {
        req.flash(
          "success",
          `Login successful! You've been automatically added to ${pendingInvitations.length} band(s) you were invited to.`
        );
      } else {
        req.flash("success", "Login successful!");
      }

      // Redirect back to the original page or home if no returnTo specified
      const returnTo = req.body.returnTo || "/";
      res.redirect(returnTo);
    } catch (error) {
      console.error("Login error:", error);
      req.flash("error", "An error occurred during login");
      res.redirect("/auth/login");
    }
  }
);

// GET /auth/logout - Handle logout (for links)
router.get("/logout", (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.logError("Logout error", err);
      } else if (userId) {
        logger.logAuthEvent("logout", userId);
      }
      res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
});

// POST /auth/logout - Handle logout (for forms)
router.post("/logout", (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;

  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.logError("Logout error", err);
      } else if (userId) {
        logger.logAuthEvent("logout", userId);
      }
      res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
});

// GET /auth/forgot-password - Show forgot password form
router.get("/forgot-password", (req, res) => {
  res.render("auth/forgot-password", {
    title: "Forgot Password",
    errors: [],
    success: req.flash("success"),
  });
});

// POST /auth/forgot-password - Process password reset request
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Please enter a valid email address")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("auth/forgot-password", {
        title: "Forgot Password",
        errors: errors.array(),
        email: req.body.email,
      });
    }

    try {
      const { email } = req.body;
      const emailLower = email.toLowerCase();

      // Check if user exists (case insensitive)
      const user = await prisma.user.findFirst({
        where: { email: emailLower },
      });
      if (!user) {
        // Don't reveal if email exists or not for security
        req.flash(
          "success",
          "Reset email sent and is valid for 1 hour. Check your spam!"
        );
        return res.redirect("/");
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save reset token with lowercase email
      await prisma.passwordReset.create({
        data: {
          email: emailLower,
          token,
          expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Send email
      const baseUrl =
        process.env.NODE_ENV === "production"
          ? "https://setlists.bagus.org"
          : process.env.BASE_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/auth/reset-password/${token}`;
      const emailContent = `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Setlist Manager account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetUrl}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
        `;

      try {
        await sendEmail(emailLower, "Password Reset Request", emailContent);
      } catch (emailError) {
        console.error(
          `[${new Date().toISOString()}] Failed to send password reset email:`,
          emailError
        );
        // Still show success message for security
      }

      req.flash(
        "success",
        "Reset email sent and is valid for 1 hour. Check your spam!"
      );
      res.redirect("/");
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Password reset request error:`,
        error
      );
      req.flash("error", "An error occurred. Please try again.");
      res.redirect("/");
    }
  }
);

// GET /auth/reset-password/:token - Show reset password form
router.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Find valid reset token
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!resetRecord) {
      req.flash("error", "Invalid or expired password reset link.");
      return res.redirect("/auth/forgot-password");
    }

    res.render("auth/reset-password", {
      title: "Reset Password",
      token,
      errors: [],
      email: resetRecord.email,
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Reset password page error:`,
      error
    );
    req.flash("error", "An error occurred. Please try again.");
    res.redirect("/auth/forgot-password");
  }
});

// POST /auth/reset-password/:token - Process password reset
router.post(
  "/reset-password/:token",
  [
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password confirmation does not match password");
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("auth/reset-password", {
        title: "Reset Password",
        token: req.params.token,
        errors: errors.array(),
        email: req.body.email,
      });
    }

    try {
      const { token } = req.params;
      const { password, email } = req.body;
      const emailLower = email.toLowerCase();

      // Find valid reset token (case insensitive)
      const resetRecord = await prisma.passwordReset.findFirst({
        where: {
          token,
          email: emailLower,
          expiresAt: { gt: new Date() },
          usedAt: null,
        },
      });

      if (!resetRecord) {
        req.flash("error", "Invalid or expired password reset link.");
        return res.redirect("/auth/forgot-password");
      }

      // Find user (case insensitive)
      const user = await prisma.user.findFirst({
        where: { email: emailLower },
      });
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/auth/forgot-password");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      // Mark reset token as used
      await prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });

      // Delete any other unused reset tokens for this email (case insensitive)
      await prisma.passwordReset.deleteMany({
        where: {
          email: emailLower,
          usedAt: null,
        },
      });

      req.flash(
        "success",
        "Your password has been reset successfully. You can now log in with your new password."
      );
      res.redirect("/auth/login");
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Password reset error:`,
        error
      );
      req.flash("error", "An error occurred. Please try again.");
      res.redirect("/auth/forgot-password");
    }
  }
);

module.exports = { router, requireAuth };
