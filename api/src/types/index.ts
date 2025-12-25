// Article data structure matching frontend expectations
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

// Job data stored in queue
export interface JobData {
  repoUrl: string;
  jobId: string;
  createdAt: number;
}

// SSE event types
export type SSEEventType =
  | 'queued'
  | 'started'
  | 'progress'
  | 'complete'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  message?: string;
  position?: number;
  article?: ArticleData;
  error?: string;
}

// Generate endpoint request/response
export interface GenerateRequest {
  repoUrl: string;
}

export interface GenerateResponse {
  jobId: string;
  position: number;
}
