const User = require('../../models/User');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

const handleLogin = async (req, res) => {
    console.log(req.body);
    const user = await User.findOne({ username: req.body.username });
    console.log(user);
    if (!user) {
        return res.json({
            success: false,
            msg: "No such Engineer exists"
        });
    }
    if (!user.password) {
        return res.json({
            success: false,
            msg: "Set password first"
        });
    }
    if (bcrypt.compareSync(req.body.password, user.password)) {
        return res.json({
            success: true,
        });
    }
    return res.json({
        success: false,
        msg: "Incorrect username or password"
    });
}

const getMe = async (req, res) => {
    const token = req.cookies?.token;
    // console.log(token);
    
    if (!token) {
        return res.status(401).json({ success: false, authenticated: false });
    }
    try {
        const uuser = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ username: uuser.username });
        res.json({
            success: true,
            authenticated: true,
            user
        });
    } catch {
        res.status(401).json({ success: false, authenticated: false });
    }
}

module.exports = { handleLogin, getMe }