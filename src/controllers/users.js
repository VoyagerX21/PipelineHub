const User = require("../models/User");
const Webhook = require('../models/Webhook');
const axios = require('axios');

const verifySlackWebhook = async (url) => {
    try {
        const res = await axios.post(url, {
            text: "✅ PipelineHub webhook connected successfully"
        });
        return res.status === 200;
    } catch (err) {
        return false;
    }
};

const updateUserConfig = async (req, res) => {
    try {
        const userId = req.params.userId;
        const { slackChannel, slackToken } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found"
            });
        }

        // 🔹 If user provided a webhook URL → verify it
        if (slackToken) {
            const isValid = await verifySlackWebhook(slackToken);

            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    msg: "Invalid Slack webhook URL"
                });
            }
        }

        // 🔹 Save user config
        user.SlackChannelName = slackChannel;
        user.SlackURL = slackToken;
        await user.save();

        const webhook = await Webhook.findOne({ userId });

        if (slackToken) {
            if (!webhook) {
                await Webhook.create({
                    userId,
                    name: slackChannel,
                    targetUrl: slackToken
                });
            } else {
                await Webhook.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            name: slackChannel,
                            targetUrl: slackToken
                        }
                    }
                );
            }
        } else {
            // 🔹 If token removed → delete webhook
            if (webhook) {
                await Webhook.deleteOne({ userId });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Configuration saved successfully"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        });
    }
};

module.exports = {
    updateUserConfig
}