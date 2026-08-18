const Redis = require('ioredis');

let redisConnection;

if (process.env.REDIS_URL) {
    redisConnection = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null
    });
} else {
    redisConnection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null
    });
}

module.exports = redisConnection;
