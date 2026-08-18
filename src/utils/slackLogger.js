const axios = require("axios");

async function sendSlackMessage(message) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackUrl) return;

  try {
    await axios.post(slackUrl, { text: message });
  } catch (err) {
    console.error("Slack logging failed:", err.message);
  }
}

module.exports = { sendSlackMessage };