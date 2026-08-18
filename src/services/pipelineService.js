const { sendNotification } = require('../services/notificationService');
// Triggers a mock CI/CD pipeline based on GitHub event and payload
const triggerPipeline = async (event, payload, platform) => {
    // throw new Error('Simulated pipeline failure!!'); //debug line for the testing of auto-retrying feature 
    // Log event type and pipeline trigger
    console.log(`[${event.type.toUpperCase()}] CI/CD pipeline triggered! through [${platform.toUpperCase()}]`);
    await sendNotification(`🚀 Pipeline triggered for event: *${event}* by *${payload.pusher?.name}* in *${payload.repository?.full_name}*`);

    // Log relevant payload details for debugging
    console.log({
        repo: payload.repository?.full_name,
        pusher: payload.pusher?.name,
        message: payload.head_commit?.message
    });
};

// Export the triggerPipeline function
module.exports = { triggerPipeline };