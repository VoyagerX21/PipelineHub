const User = require('../../models/User');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const handleLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "No such Engineer exists"
            });
        }

        if (!user.password) {
            return res.status(400).json({
                success: false,
                msg: "Set password first"
            });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                msg: "Incorrect username or password"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict"
        });

        return res.json({
            success: true,
            msg: "Login successful"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        });
    }
};

const getMe = async (req, res) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            authenticated: false
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                authenticated: false
            });
        }

        res.json({
            success: true,
            authenticated: true,
            user
        });

    } catch (err) {
        res.status(401).json({
            success: false,
            authenticated: false
        });
    }
};

module.exports = {
    handleLogin,
    getMe,
}