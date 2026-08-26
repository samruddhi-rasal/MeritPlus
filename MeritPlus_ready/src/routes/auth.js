const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const usersRepo = require("../sheets/usersRepo");
const sessionsRepo = require("../sheets/sessionsRepo");
const passwordResetsRepo = require("../sheets/passwordResetsRepo");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

async function issueSessionAndToken(user, req) {
  const sessionId = crypto.randomUUID();

  const token = jwt.sign(
    { userId: user.id, email: user.email, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
  );

  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  await sessionsRepo.create({
    id: crypto.randomUUID(),
    userId: user.id,
    sessionId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || "",
    expiresAt
  });

  return token;
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "firstName, lastName, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await usersRepo.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));
    const user = await usersRepo.create({ firstName, lastName, email: normalizedEmail, passwordHash });

    const token = await issueSessionAndToken(user, req);

    res.status(201).json({
      token,
      user: { id: user.id, firstName, lastName, email: normalizedEmail }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const user = await usersRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    const token = await issueSessionAndToken(user, req);

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res, next) => {
  try {
    await sessionsRepo.logout(req.user.id, req.user.sessionId);
    res.json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await usersRepo.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/forgot-password
// No email service — returns the reset link directly in the response
// (see README for the trade-off this implies).
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await usersRepo.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No account found with that email" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30) * 60000);

    await passwordResetsRepo.create({ userId: user.id, tokenHash, expiresAt });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${rawToken}`;

    res.json({ message: "Reset link generated.", resetUrl });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "token and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await passwordResetsRepo.findValidByTokenHash(tokenHash);

    if (!record) {
      return res.status(400).json({ message: "This reset link is invalid or has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 12));
    await usersRepo.updatePasswordHash(record.user_id, passwordHash);
    await passwordResetsRepo.markUsed(record);

    // Reset password invalidates all existing sessions for this user.
    await sessionsRepo.invalidateAllForUser(record.user_id);

    res.json({ message: "Password has been reset. Please log in again." });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await usersRepo.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) return res.status(401).json({ message: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS || 12));
    await usersRepo.updatePasswordHash(req.user.id, passwordHash);

    res.json({ message: "Password changed. Please log in again." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
