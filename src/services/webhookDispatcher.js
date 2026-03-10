const axios = require("axios");
const Webhook = require("../models/Webhook");
const WebhookDelivery = require("../models/WebhookDelivery");

const dispatchWebhooks = async (eventDoc, user, repo) => {
  console.log(`[DISPATCHER] Dispatching webhooks for ${eventDoc.type}`);

  console.log("Event Type:", eventDoc.type);

  const hook = await Webhook.findOne({userId: user._id});

  if (!hook){
    console.log("[DISPATCHER] No webhook configured. Skipping.")
    return;
  }

  const startTime = Date.now();

  try {
    const branch = eventDoc.branch || "N/A";
    const message = `
      🚀 *PipelineHub Notification*

      📌 *Event:* ${eventDoc.type.toUpperCase()}
      👤 *Triggered by:* ${user.username || "Unknown"}
      📂 *Repository:* ${repo.name || "Unknown"}
      🌿 *Branch:* ${branch}
      🔗 *Platform:* ${eventDoc.provider.toUpperCase()}

      ⚙️ Processed via *PipelineHub CI Orchestration Engine*
    `;
    // await sendSlackMessage(message);
    const response = await axios.post(hook.targetUrl, {
      text: message
    });

    await WebhookDelivery.create({
      webhookId: hook._id,
      eventId: eventDoc._id,
      status: "success",
      responseCode: response.status,
      responseTimeMs: Date.now() - startTime
    });

    console.log(`[DISPATCHER] Webhook success → ${hook.name}`);

  } catch (err) {
    await WebhookDelivery.create({
      webhookId: hook._id,
      eventId: eventDoc._id,
      status: "failed",
      responseCode: err.response?.status || 500,
      responseTimeMs: Date.now() - startTime
    });

    console.error(`[DISPATCHER] Webhook failed → ${hook.name}`);
  }
};

module.exports = { dispatchWebhooks };