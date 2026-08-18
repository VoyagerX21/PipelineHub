const Webhook = require("../models/Webhook");
const outgoingWebhookQueue = require("../queues/outgoingWebhookQueue");

const dispatchWebhooks = async (eventDoc, user, repo) => {
  console.log(`[DISPATCHER] Enqueueing webhooks for ${eventDoc.type}`);

  const hook = await Webhook.findOne({userId: user._id});

  if (!hook){
    console.log("[DISPATCHER] No webhook configured. Skipping.")
    return;
  }

  const branch = eventDoc.branch || "N/A";
  const message = `
    🚀 *PipelineHub Notification*

    📌 *Event:* ${eventDoc.type.toUpperCase()}
    👤 *Triggered by:* ${user.name || "Unknown"}
    📂 *Repository:* ${repo.name || "Unknown"}
    🌿 *Branch:* ${branch}
    🔗 *Platform:* ${eventDoc.provider.toUpperCase()}

    ⚙️ Processed via *PipelineHub CI Orchestration Engine*
  `;

  await outgoingWebhookQueue.add('deliver-webhook', {
    webhookId: hook._id,
    eventId: eventDoc._id,
    targetUrl: hook.targetUrl,
    message: message
  }, {
    jobId: `webhook-${eventDoc._id}-${hook._id}`
  });

  console.log(`[DISPATCHER] Webhook delivery enqueued → ${hook.name}`);
};

module.exports = { dispatchWebhooks };