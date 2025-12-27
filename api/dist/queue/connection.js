import Redis from 'ioredis';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// Error handler to prevent crashes on connection issues
function handleRedisError(name) {
    return (err) => {
        console.error(`[Redis] ${name} error:`, err.message);
    };
}
// Main Redis connection for BullMQ
export const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
});
connection.on('error', handleRedisError('connection'));
// Separate connection for pub/sub (SSE events)
export function createSubscriber() {
    const subscriber = new Redis(redisUrl);
    subscriber.on('error', handleRedisError('subscriber'));
    return subscriber;
}
// Publisher for sending events to SSE subscribers
export const publisher = new Redis(redisUrl);
publisher.on('error', handleRedisError('publisher'));
// Channel name for job events
export function getJobChannel(jobId) {
    return `job:${jobId}:events`;
}
// Graceful shutdown
export async function closeConnections() {
    await connection.quit();
    await publisher.quit();
}
//# sourceMappingURL=connection.js.map