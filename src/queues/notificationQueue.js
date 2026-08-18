const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create the notification queue
const notificationQueue = new Queue('notification-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = notificationQueue;
