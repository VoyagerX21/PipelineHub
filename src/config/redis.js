const Redis = require('ioredis');

const connectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null,
};

const redisConnection = new Redis(connectionOptions);

module.exports = redisConnection;
