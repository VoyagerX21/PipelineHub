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
        "&allow_signup=true";

    res.redirect(redirectUrl);
};

const githubCallback = async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).json({
            msg: "Missing GitHub OAuth code"
        });
    }

    try {
        // STEP 1: Exchange code for access token
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

        if (!accessToken) {
            return res.status(400).json({
                msg: "Failed to obtain GitHub access token"
            });
        }

        // STEP 2: Fetch GitHub user profile
        const userResponse = await axios.get(
            "https://api.github.com/user",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const githubUser = userResponse.data;

        // STEP 3: Fetch GitHub emails (since /user may return null)
        const emailsResponse = await axios.get(
            "https://api.github.com/user/emails",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const primaryEmail = emailsResponse.data.find(
            e => e.primary && e.verified
        )?.email;

        // fallback email if none returned
        const email =
            primaryEmail ||
            githubUser.email ||
            `${githubUser.login}@github.local`;

        // STEP 4: Check if OAuth account already exists
        let account = await OAuthAccount.findOne({
            provider: "github",
            providerUserId: githubUser.id.toString()
        });

        let user;

        if (account) {
            // Existing OAuth account
            user = await User.findById(account.userId);
        } else {
            // Find user by email
            user = await User.findOne({ email });

            // Create new user if none exists
            if (!user) {
                user = await User.create({
                    name: githubUser.name || githubUser.login,
                    email: email,
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

            // Create webhook key if not present
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

        // STEP 5: Generate JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // set true in production
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.redirect(`${process.env.FRONTEND_URL}/`);

    } catch (error) {
        console.error("GitHub OAuth Error:", error?.response?.data || error);

        return res.status(500).json({
            msg: "OAuth Failed"
        });
    }
};

module.exports = {
    githubLogin,
    githubCallback
};