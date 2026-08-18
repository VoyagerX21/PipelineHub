const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const { trackContribution } = require('../services/contributorService');
const { processEvent } = require('../services/eventProcessor');
const webhookStorageService = require('../services/webhookStorageService');

const webhookWorker = new Worker('webhook-events', async (job) => {
    const { platform, key, rawEvent, normalizedType, payload } = job.data;
    
    console.log(`[Worker] Processing ${normalizedType} event for ${platform}`);

    try {
        const user = await webhookStorageService.getUserFromWebhookKey(platform, key);
        if (!user) {
            throw new Error(`Invalid webhook key for platform ${platform}`);
        }
        
        const repository = await webhookStorageService.upsertRepository(
            platform,
            payload,
            user._id
        );

        if (normalizedType === "push" || normalizedType === "pull_request") {
            await trackContribution(payload, repository._id, platform, normalizedType);
        }

        const event = await webhookStorageService.createEvent(
            platform,
            normalizedType,
            payload,
            repository._id,
            user._id,
            rawEvent
        );

        if (normalizedType === "push") {
            await webhookStorageService.createCommitsIfAny(
                platform,
                payload,
                repository._id,
                event._id
            );
        }

        await processEvent(event, payload, user, repository);

        console.log(`[Worker] Successfully processed ${normalizedType} event for ${platform}`);

    } catch (error) {
        console.error(`[Worker] Failed to process webhook event:`, error);
        throw error; // Let BullMQ handle retries
    }
}, {
    connection: redisConnection
});

webhookWorker.on('completed', job => {
    console.log(`[Worker] Job with id ${job.id} has been completed`);
});

webhookWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job with id ${job.id} has failed with ${err.message}`);
});

module.exports = webhookWorker;
