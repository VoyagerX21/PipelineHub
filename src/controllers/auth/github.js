const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const WebhookKey = require("../../models/WebhookKey");
const User = require("../../models/User");
const OAuthAccount = require("../../models/OAuthAccount");

const githubLogin = (req, res) => {
    const redirectUrl =
        "https://github.com/login/oauth/authorize" +
        `?client_id=${process.env.GITHUB_CLIENT_ID}` +
        "&scope=user:email" +
        "&prompt=select_account";

    res.redirect(redirectUrl);
};

const githubCallback = async (req, res) => {
    const code = req.query.code;

    try {
        // Step 1: Exchange code for access token
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code
            },
            {
                headers: { Accept: "application/json" }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Step 2: Get GitHub user
        const userResponse = await axios.get("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const githubUser = userResponse.data;

        // Step 3: Check if OAuthAccount exists
        let account = await OAuthAccount.findOne({
            provider: "github",
            providerUserId: githubUser.id.toString()
        });

        let user;

        if (account) {
            // Existing OAuth account
            user = await User.findById(account.userId);
        } else {
            // Create or find user by email
            user = await User.findOne({ email: githubUser.email });

            if (!user) {
                user = await User.create({
                    name: githubUser.name || githubUser.login,
                    email: githubUser.email,
                    avatarUrl: githubUser.avatar_url
                });
            }

            // Create OAuth account link
            await OAuthAccount.create({
                userId: user._id,
                provider: "github",
                providerUserId: githubUser.id.toString(),
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                profileUrl: githubUser.html_url,
                accessToken
            });

            let webhook = await WebhookKey.findOne({
                userId: user._id,
                provider: "github"
            });

            if (!webhook) {
                const key = crypto.randomBytes(24).toString("hex");

                await WebhookKey.create({
                    userId: user._id,
                    provider: "github",
                    key
                });
            }
        }

        // Step 4: Generate JWT using internal userId
        const token = jwt.sign(
            {
                userId: user._id
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // true in production
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.redirect(`${process.env.FRONTEND_URL}/`);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            msg: "OAuth Failed"
        });
    }
};

module.exports = {
    githubLogin,
    githubCallback
};