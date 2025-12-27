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
    slug: string;
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
export interface CachedResponse {
    cached: true;
    slug: string;
    article: ArticleData;
}
export interface NewJobResponse {
    cached?: false;
    jobId: string;
    position: number;
    slug: string;
}
export type GenerateResponse = CachedResponse | NewJobResponse;
//# sourceMappingURL=index.d.ts.map