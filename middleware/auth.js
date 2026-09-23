// middleware/auth.js
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const JWKS_URL = new URL("/api/auth/jwks", FRONTEND_URL);

// JWKS cache — প্রথমবার fetch করে পরে reuse করবে
const JWKS = createRemoteJWKSet(JWKS_URL);

async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res
                .status(401)
                .send({ message: "Authentication required" });
        }

        const token = authHeader.split(" ")[1];
        const { payload } = await jwtVerify(token, JWKS);

        req.user = payload;
        next();
    } catch (err) {
        console.error("verifyToken error:", err.message);
        return res
            .status(401)
            .send({ message: "Invalid or expired token" });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).send({ message: "Admin access required" });
    }
    next();
}

module.exports = { verifyToken, requireAdmin };