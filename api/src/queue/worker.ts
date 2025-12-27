import { Worker, Job } from 'bullmq';
import { connection, publisher, getJobChannel } from './connection.js';
import { QUEUE_NAME } from './articleQueue.js';
import { analyzeRepo } from '../agent/analyzeRepo.js';
import { saveArticle } from '../storage/articles.js';
import type { JobData, SSEEvent } from '../types/index.js';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10);

// Publish SSE event for a job
async function publishEvent(jobId: string, event: SSEEvent): Promise<void> {
  await publisher.publish(getJobChannel(jobId), JSON.stringify(event));
}

// Process a single job
async function processJob(job: Job<JobData>): Promise<void> {
  const { repoUrl, jobId, slug } = job.data;

  console.log(`[Worker] Starting job ${jobId} for repo: ${repoUrl} (slug: ${slug})`);

  // Notify that job has started
  await publishEvent(jobId, {
    type: 'started',
    message: 'Starting analysis...',
  });

  try {
    // Run the Claude Agent and stream progress
    for await (const event of analyzeRepo(repoUrl, jobId)) {
      // If complete, save to storage before publishing
      if (event.type === 'complete' && event.article && slug) {
        await saveArticle(slug, repoUrl, event.article);
        console.log(`[Worker] Saved article to storage: ${slug}`);
      }

      await publishEvent(jobId, event);

      // If complete, we're done
      if (event.type === 'complete') {
        console.log(`[Worker] Job ${jobId} completed successfully`);
        return;
      }
    }
  } catch (error) {
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
export function startWorker(): Worker<JobData> {
  const worker = new Worker<JobData>(QUEUE_NAME, processJob, {
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
