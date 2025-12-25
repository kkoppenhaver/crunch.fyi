import Redis from 'ioredis';
export declare const connection: Redis;
export declare function createSubscriber(): Redis;
export declare const publisher: Redis;
export declare function getJobChannel(jobId: string): string;
export declare function closeConnections(): Promise<void>;
//# sourceMappingURL=connection.d.ts.map