import Redis from 'ioredis';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// Main Redis connection for BullMQ
export const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Required for BullMQ
});
// Separate connection for pub/sub (SSE events)
export function createSubscriber() {
    return new Redis(redisUrl);
}
// Publisher for sending events to SSE subscribers
export const publisher = new Redis(redisUrl);
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