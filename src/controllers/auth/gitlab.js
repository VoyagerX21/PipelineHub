const axios = require("axios");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../../models/User");
const OAuthAccount = require("../../models/OAuthAccount");
const WebhookKey = require("../../models/WebhookKey");
const { verifyContributorsForOAuthUser } = require("../../services/contributorService");

const gitlabLogin = async (req, res) => {
    const redirectUrl =
        "https://gitlab.com/oauth/authorize" +
        `?client_id=${process.env.GITLAB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.GITLAB_REDIRECT_URI)}` +
        "&response_type=code" +
        "&scope=read_user";

    res.redirect(redirectUrl);
};

const gitlabCallback = async (req, res) => {
    const code = req.query.code;

    try {

        // Exchange code for access token
        const tokenResponse = await axios.post(
            "https://gitlab.com/oauth/token",
            {
                client_id: process.env.GITLAB_CLIENT_ID,
                client_secret: process.env.GITLAB_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: process.env.GITLAB_REDIRECT_URI
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Fetch GitLab user
        const userResponse = await axios.get(
            "https://gitlab.com/api/v4/user",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const gitlabUser = userResponse.data;

        // Check OAuth account
        let account = await OAuthAccount.findOne({
            provider: "gitlab",
            providerUserId: gitlabUser.id.toString()
        });

        let user;

        if (account) {
            user = await User.findById(account.userId);
        } else {

            // Try linking by email
            user = await User.findOne({ email: gitlabUser.email });

            if (!user) {
                user = await User.create({
                    name: gitlabUser.name || gitlabUser.username,
                    email: gitlabUser.email,
                    avatarUrl: gitlabUser.avatar_url
                });
            }

            await OAuthAccount.create({
                userId: user._id,
                provider: "gitlab",
                providerUserId: gitlabUser.id.toString(),
                username: gitlabUser.username,
                avatarUrl: gitlabUser.avatar_url,
                profileUrl: gitlabUser.web_url,
                accessToken
            });

            // Create webhook key if not exists
            let webhook = await WebhookKey.findOne({
                userId: user._id,
                provider: "gitlab"
            });

            if (!webhook) {
                const key = crypto.randomBytes(24).toString("hex");

                await WebhookKey.create({
                    userId: user._id,
                    provider: "gitlab",
                    key
                });
            }
        }

        await verifyContributorsForOAuthUser({
            userId: user._id,
            platform: "gitlab",
            providerUserId: gitlabUser.id.toString(),
            username: gitlabUser.username,
            email: gitlabUser.email,
            avatarUrl: gitlabUser.avatar_url,
            name: gitlabUser.name || gitlabUser.username
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.redirect(process.env.FRONTEND_URL);

    } catch (error) {
        console.error("GitLab OAuth Error:", error);

        res.status(500).json({
            msg: "GitLab OAuth Failed"
        });
    }
}

module.exports = {
    gitlabLogin,
    gitlabCallback
}