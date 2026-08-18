const axios = require('axios');

exports.sendNotification = async (message) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        // post the message onto the Channel
        await axios.post(webhookUrl, {
            text: message
        });
    } catch (err) {
        console.error("❌ Failed to send Slack notification:", err.message);
    }
};