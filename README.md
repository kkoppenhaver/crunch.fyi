# crunch.fyi

Turn your spaghetti code into unicorn hype.

Paste a GitHub repo URL and our AI agent will analyze the code, investigate the maintainer, and generate a satirical TechCrunch-style article about how it's "changing the world."

![Generated Article Preview](screenshots/article-preview.png)

## Features

- **AI-Powered Article Generation** - Uses Claude Agent SDK to clone and analyze GitHub repos
- **Shareable Article URLs** - Each generated article gets a permanent, shareable URL (`/article/owner-repo`)
- **Article Caching** - Previously generated articles are cached and served instantly
- **TechCrunch-Style Design** - Pixel-perfect recreation of TechCrunch's article layout
- **Real-Time Progress** - Watch the AI agent work with live status updates via SSE
- **Job Queue** - Handles concurrent requests gracefully with queue position updates
- **Observability** - Langfuse integration for monitoring AI agent turns and costs
- **Fake but Believable** - Complete with fabricated funding rounds, anonymous VC quotes, and buzzword-laden headlines

## Tech Stack

**Frontend**
- React + Vite
- React Router (client-side routing)
- Tailwind CSS
- Framer Motion
- Server-Sent Events (SSE)

**Backend**
- Node.js + Express + TypeScript
- Claude Agent SDK (Anthropic)
- BullMQ + Redis (job queue)
- File system storage for article caching
- Langfuse (observability)

## Getting Started

### Prerequisites

- Node.js 18+
- Redis server running locally (or remote Redis URL)
- Anthropic API key
- GitHub token (for repo analysis)
- Langfuse API keys (optional, for observability)

### Setup

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd api && npm install
```

### Environment Variables

Create `api/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
REDIS_URL=redis://localhost:6379
PORT=3001
MAX_CONCURRENT_JOBS=2

# Optional: Langfuse observability
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Development

```bash
# Terminal 1: Start Redis (if not already running)
redis-server

# Terminal 2: Start backend
cd api && npm run dev

# Terminal 3: Start frontend
npm run dev
```

Visit http://localhost:5173

### Production Build

```bash
# Build frontend
npm run build

# Build backend
cd api && npm run build

# Start production server (serves both API and static frontend)
cd api && NODE_ENV=production npm start
```

## How It Works

1. Paste any GitHub repository URL
2. If the article already exists, you're redirected instantly to the cached version
3. Otherwise, the job enters a queue (you'll see your position if others are ahead)
4. Claude Agent clones the repo, reads the code, and analyzes the project
5. A satirical TechCrunch-style article is generated in real-time
6. The article is saved and you're redirected to a shareable URL

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   React     │────▶│   Express   │────▶│    Redis     │
│   Frontend  │ SSE │   Server    │     │   + BullMQ   │
└─────────────┘     └──────┬──────┘     └──────────────┘
                          │                    │
                          ▼                    ▼
                   ┌─────────────────────────────────┐
                   │   Worker Process                │
                   │   - Claude Agent SDK            │
                   │   - Git clone & file analysis   │
                   │   - Article generation          │
                   │   - Langfuse tracing            │
                   └─────────────┬───────────────────┘
                                 │
                                 ▼
                   ┌─────────────────────────────────┐
                   │   File Storage                  │
                   │   data/articles/{slug}.json     │
                   └─────────────────────────────────┘
```

## API Endpoints

- `POST /api/generate` - Submit a repo URL for analysis (returns cached article or creates job)
- `GET /api/progress/:jobId` - SSE stream for job progress
- `GET /api/article/:slug` - Retrieve a cached article by slug
- `GET /api/article` - List all cached articles
- `GET /api/health` - Health check

## URL Structure

Articles are accessible at `/article/{owner}-{repo}`, for example:
- `/article/anthropics-claude-code`
- `/article/facebook-react`

The same input URL always maps to the same article URL, enabling sharing and caching.

## Disclaimer

This is a parody project. All generated articles are fictional and meant for entertainment purposes only. Any resemblance to actual TechCrunch articles or real funding announcements is purely coincidental (and probably says something about the state of tech journalism).

## License

MIT
