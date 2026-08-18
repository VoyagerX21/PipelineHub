const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create the outgoing webhook queue
const outgoingWebhookQueue = new Queue('outgoing-webhook-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = outgoingWebhookQueue;
