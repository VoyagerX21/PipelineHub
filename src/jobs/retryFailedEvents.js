const Event = require('../models/Event');
const pipelineService = require('../services/pipelineService');

async function retryFailedEvents() {
  try {
    // Getting all the failed events from the DB
    const failedEvents = await Event.find({ status: 'failed', retries: { $lt: 3 } });
    for (const event of failedEvents) {
      try {
        console.log("Running retry job");
        await pipelineService.triggerPipeline(event.eventType, {
          platform: {platform: event.platform},
          repository: { full_name: event.repository },
          pusher: { name: event.pusher },
          head_commit: { message: event.message }
        });
        await sendNotification(`🔁 Retried failed pipeline for event *${event._id}* successfully.`);

        // Success: update status
        event.status = 'triggered';
        await event.save();

        console.log(`✅ Retried event ${event._id} successfully`);
      } catch (err) {
        // Failure: increment retry count
        event.retries = (event.retries || 0) + 1;

        // Optional: if retries exceed 3, mark as permanently failed
        if (event.retries >= 3) {
          console.log(`❌ Event ${event._id} permanently failed after 3 attempts`);
        } else {
          console.log(`🔁 Retried event ${event._id} — attempt ${event.retries}`);
        }

        await event.save();
      }
    }
  } catch (err) {
    console.error('🔴 Error in retryFailedEvents:', err);
  }
}

module.exports = retryFailedEvents;