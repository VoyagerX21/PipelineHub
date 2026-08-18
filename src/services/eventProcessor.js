const { triggerPipeline } = require("./pipelineEngine");
const { dispatchWebhooks } = require("./webhookDispatcher");

const processEvent = async (eventDoc, payload, user, repo) => {
  console.log(`[PROCESSOR] Processing event: ${eventDoc.type}`);

  // Only trigger pipeline for relevant event types
  if (["push", "merge", "pull_request"].includes(eventDoc.type)) {
    await triggerPipeline(eventDoc, payload);
  }

  // Always dispatch webhooks (even if no pipeline)
  await dispatchWebhooks(eventDoc, user, repo);
};

module.exports = { processEvent };