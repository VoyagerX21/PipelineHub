const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const axios = require("axios");
const WebhookDelivery = require("../models/WebhookDelivery");

const outgoingWebhookWorker = new Worker('outgoing-webhook-queue', async job => {
  const { webhookId, eventId, targetUrl, message } = job.data;
  console.log(`[OutgoingWebhook Worker] Processing delivery for event ${eventId}`);
  
  const startTime = Date.now();

  try {
    const response = await axios.post(targetUrl, {
      text: message
    });

    await WebhookDelivery.create({
      webhookId: webhookId,
      eventId: eventId,
      status: "success",
      responseCode: response.status,
      responseTimeMs: Date.now() - startTime
    });

    console.log(`[OutgoingWebhook Worker] Webhook success for event ${eventId}`);
    return { status: 'success' };
  } catch (err) {
    await WebhookDelivery.create({
      webhookId: webhookId,
      eventId: eventId,
      status: "failed",
      responseCode: err.response?.status || 500,
      responseTimeMs: Date.now() - startTime
    });

    console.error(`[OutgoingWebhook Worker] Webhook failed for event ${eventId}`);
    throw err; // Let BullMQ retry
  }
}, { 
  connection: redisConnection,
  concurrency: 5 
});

outgoingWebhookWorker.on('completed', job => {
  console.log(`[OutgoingWebhook Worker] Job ${job.id} has completed!`);
});

outgoingWebhookWorker.on('failed', (job, err) => {
  console.error(`[OutgoingWebhook Worker] Job ${job.id} has failed with ${err.message}`);
});

module.exports = outgoingWebhookWorker;
