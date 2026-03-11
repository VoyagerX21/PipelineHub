const User = require('../../models/User');
const OAuthAccount = require('../../models/OAuthAccount');
const WebhookKey = require('../../models/WebhookKey');
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
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000
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

const getProviders = async (req, res) => {
    try {
        const userId = req.params.userId;
        // console.log(userId);
        const user = await User.findById(userId);
        // console.log(user);
        const accounts = await OAuthAccount.find({ userId });
        // console.log(accounts);
        const providers = {
            github: false,
            gitlab: false,
            bitbucket: false,
            githubkey: "",
            gitlabkey: "",
            bitbucketkey: "",
            slackChannel: user.SlackChannelName,
            slackURL: user.SlackURL,
        };

        for (const acc of accounts) {
            providers[acc.provider] = true;

            const key = await WebhookKey.findOne({
                userId: userId,
                provider: acc.provider
            });

            if (key) {
                providers[acc.provider + "key"] = key.key;
            }
        }

        res.json({
            success: true,
            providers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            msg: "Failed to fetch providers"
        });
    }
};

module.exports = {
    handleLogin,
    getMe,
    getProviders
}