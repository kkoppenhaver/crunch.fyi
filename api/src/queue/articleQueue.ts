import { Queue } from 'bullmq';
import { connection } from './connection.js';
import type { JobData } from '../types/index.js';

export const QUEUE_NAME = 'article-generation';

export const articleQueue = new Queue<JobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1, // Don't retry failed jobs (expensive API calls)
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours for debugging
    },
  },
});

// Get current queue position for a job
export async function getQueuePosition(jobId: string): Promise<number> {
  const jobs = await articleQueue.getWaiting();
  const index = jobs.findIndex(job => job.id === jobId);
  return index === -1 ? 0 : index + 1;
}

// Get total queue length
export async function getQueueLength(): Promise<number> {
  const waiting = await articleQueue.getWaitingCount();
  const active = await articleQueue.getActiveCount();
  return waiting + active;
}
