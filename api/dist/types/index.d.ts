export interface ArticleData {
    headline: string;
    author: {
        name: string;
        title: string;
        avatar: string;
        bio: string;
        twitter: string;
    };
    timestamp: string;
    category: string;
    image: string;
    imageCredit: string;
    tags: string[];
    content: string[];
}
export interface JobData {
    repoUrl: string;
    jobId: string;
    createdAt: number;
}
export type SSEEventType = 'queued' | 'started' | 'progress' | 'complete' | 'error';
export interface SSEEvent {
    type: SSEEventType;
    message?: string;
    position?: number;
    article?: ArticleData;
    error?: string;
}
export interface GenerateRequest {
    repoUrl: string;
}
export interface GenerateResponse {
    jobId: string;
    position: number;
}
//# sourceMappingURL=index.d.ts.map