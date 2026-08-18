const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

// Create the pipeline queue
const pipelineQueue = new Queue('pipeline-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
});

module.exports = pipelineQueue;
