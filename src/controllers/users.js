const User = require("../models/User");
const Webhook = require('../models/Webhook');

const updateUserConfig = async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        const { slackChannel, slackToken } = req.body;

        if (!user) {
            return res.status(401).json({
                msg: "User not found"
            });
        }

        user.SlackChannelName = slackChannel;
        user.SlackURL = slackToken;
        await user.save();
        const webhook = await Webhook.findOne({ userId: userId });
        if (!webhook) {
            await Webhook.create({
                userId: userId,
                name: slackChannel,
                targetUrl: slackToken,
            });
        }
        else {
            if (slackToken) {
                await Webhook.findOneAndUpdate({ userId: userId }, {
                    $set: {
                        name: slackChannel,
                        targetUrl: slackToken
                    }
                });
            }
            else{
                await Webhook.deleteOne({ userId: userId });
            }
        }
        return res.status(200).json({ success: true, message: "Configuration saved successfully" });
    } catch (err) {
        return res.status(500).json({
            msg: "Internal server error"
        })
    }
}

module.exports = {
    updateUserConfig
}