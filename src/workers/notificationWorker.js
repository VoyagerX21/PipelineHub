const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const axios = require('axios');
const Repository = require('../models/Repository');

const notificationWorker = new Worker('notification-queue', async job => {
  const { pipeline_id, repository_id, commit_sha, branch, status, duration_ms, failure_reason } = job.data;
  console.log(`[Notification Worker] Processing job ${job.id} for pipeline ${pipeline_id}`);
  
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[Notification Worker] SLACK_WEBHOOK_URL not configured. Skipping notification.`);
    return { status: 'skipped' };
  }

  let repoName = 'unknown/repository';
  try {
    const repo = await Repository.findById(repository_id);
    if (repo) {
      repoName = repo.fullName;
    }
  } catch (e) {
    console.warn(`[Notification Worker] Could not find repo for id: ${repository_id}`);
  }

  const durationStr = duration_ms ? `${(duration_ms / 1000).toFixed(1)}s` : 'unknown';
  const icon = status === 'success' ? '✅' : '❌';
  
  let message = `${icon} *Pipeline completed*

*Repository:* ${repoName}
*Branch:* ${branch || 'unknown'}
*Commit:* ${commit_sha || 'unknown'}
*Status:* ${status.toUpperCase()}
*Duration:* ${durationStr}
`;

  if (status !== 'success' && failure_reason) {
    message += `*Reason:* ${failure_reason}\n`;
  }

  try {
    await axios.post(webhookUrl, { text: message });
    console.log(`[Notification Worker] Notification sent for pipeline ${pipeline_id}`);
  } catch (err) {
    console.error(`[Notification Worker] Failed to send Slack notification:`, err.message);
    throw err; // BullMQ will retry this based on attempts configuration
  }
  
  return { status: 'sent' };
}, { 
  connection: redisConnection,
  concurrency: 5 // Notifications can have higher concurrency
});

notificationWorker.on('completed', job => {
  console.log(`[Notification Worker] Job ${job.id} has completed!`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[Notification Worker] Job ${job.id} has failed with ${err.message}`);
});

module.exports = notificationWorker;
