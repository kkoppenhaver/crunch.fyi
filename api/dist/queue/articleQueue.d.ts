import { Queue } from 'bullmq';
import type { JobData } from '../types/index.js';
export declare const QUEUE_NAME = "article-generation";
export declare const articleQueue: Queue<JobData, any, string, JobData, any, string>;
export declare function getQueuePosition(jobId: string): Promise<number>;
export declare function getQueueLength(): Promise<number>;
//# sourceMappingURL=articleQueue.d.ts.map