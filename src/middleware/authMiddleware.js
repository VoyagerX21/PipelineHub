const jwt = require("jsonwebtoken");

const requireAuth = (req, res, next) => {
    let userId = req.user?.userId;
    if (!userId) {
        const token = req.cookies?.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { userId: decoded.userId, id: decoded.userId };
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            });
        }
    }
    next();
};

module.exports = { requireAuth };
