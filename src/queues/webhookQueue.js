const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create the webhook events queue
const webhookQueue = new Queue('webhook-events', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false
    }
});

/**
 * Enqueues a webhook event to be processed in the background.
 * @param {Object} data 
 */
const enqueueWebhookEvent = async (data) => {
    return await webhookQueue.add('process-webhook', data);
};

module.exports = {
    webhookQueue,
    enqueueWebhookEvent
};
