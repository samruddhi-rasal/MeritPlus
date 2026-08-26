const jwt = require("jsonwebtoken");
const sessionsRepo = require("../sheets/sessionsRepo");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    const session = await sessionsRepo.findActive(decoded.userId, decoded.sessionId);
    if (!session) {
      return res.status(401).json({ message: "Session is no longer valid" });
    }

    // Never trust a userId from the frontend — this is the only source of truth.
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      sessionId: decoded.sessionId
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authenticate;
