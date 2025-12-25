import { Worker } from 'bullmq';
import { connection, publisher, getJobChannel } from './connection.js';
import { QUEUE_NAME } from './articleQueue.js';
import { analyzeRepo } from '../agent/analyzeRepo.js';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);
// Publish SSE event for a job
async function publishEvent(jobId, event) {
    await publisher.publish(getJobChannel(jobId), JSON.stringify(event));
}
// Process a single job
async function processJob(job) {
    const { repoUrl, jobId } = job.data;
    console.log(`[Worker] Starting job ${jobId} for repo: ${repoUrl}`);
    // Notify that job has started
    await publishEvent(jobId, {
        type: 'started',
        message: 'Starting analysis...',
    });
    try {
        // Run the Claude Agent and stream progress
        for await (const event of analyzeRepo(repoUrl, jobId)) {
            await publishEvent(jobId, event);
            // If complete, we're done
            if (event.type === 'complete') {
                console.log(`[Worker] Job ${jobId} completed successfully`);
                return;
            }
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Worker] Job ${jobId} failed:`, errorMessage);
        await publishEvent(jobId, {
            type: 'error',
            error: errorMessage,
        });
        throw error; // Re-throw so BullMQ marks job as failed
    }
}
// Create and start the worker
export function startWorker() {
    const worker = new Worker(QUEUE_NAME, processJob, {
        connection,
        concurrency: MAX_CONCURRENT,
    });
    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });
    worker.on('error', (err) => {
        console.error('[Worker] Worker error:', err);
    });
    console.log(`[Worker] Started with concurrency: ${MAX_CONCURRENT}`);
    return worker;
}
//# sourceMappingURL=worker.js.map