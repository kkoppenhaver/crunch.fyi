# crunch.fyi

Turn your spaghetti code into unicorn hype.

Paste a GitHub repo URL and our AI agent will analyze the code, investigate the maintainer, and generate a satirical TechCrunch-style article about how it's "changing the world."

![Homepage](screenshots/homepage.png)

![Generated Article Preview](screenshots/article-preview.png)

## Features

- **AI-Powered Article Generation** - Uses Claude Agent SDK to analyze GitHub repos via API
- **Shareable Article URLs** - Each generated article gets a permanent, shareable URL (`/article/owner-repo`)
- **Article Caching** - Previously generated articles are cached and served instantly
- **TechCrunch-Style Design** - Pixel-perfect recreation of TechCrunch's article layout
- **Retro Hero Images** - 1970s/80s-inspired abstract hero images randomly assigned to articles
- **Dynamic OG Images** - Auto-generated Open Graph images with article headline for rich social previews
- **All Articles Browser** - Infinite-scrolling page to browse all generated articles with search
- **User Feedback** - Thumbs up/down ratings with optional comments, tracked via Langfuse scores
- **Rate Limiting** - Global daily limit + per-IP limits to prevent abuse and manage costs
- **Security Hardening** - Prompt injection defenses with content sanitization and defensive framing
- **Frontend Validation** - Real-time GitHub URL validation before submission
- **SEO & Social Sharing** - Server-side meta tag injection for rich link previews
- **Real-Time Progress** - Watch the AI agent work with live status updates via SSE
- **Job Queue** - Handles concurrent requests gracefully with queue position updates
- **Observability** - Langfuse integration for monitoring AI agent turns, costs, and user feedback
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

# Optional: Rate limiting (defaults shown)
DAILY_ARTICLE_LIMIT=1000
IP_DAILY_LIMIT=20

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
4. Claude Agent explores the repo via GitHub API and analyzes the project
5. A satirical TechCrunch-style article is generated in real-time
6. A retro-futuristic hero image is randomly assigned
7. The article is saved and you're redirected to a shareable URL

## Subagent Architecture

The article generation uses a **two-agent architecture** with different Claude models optimized for their specific tasks:

```
┌────────────────────────────────────────────────────────────┐
│                    Main Writer Agent                       │
│                    (Claude Sonnet)                         │
│                                                            │
│  Responsibilities:                                         │
│  - Orchestrates the overall process                        │
│  - Writes the satirical TechCrunch-style article           │
│  - Crafts clickbait headlines and fake VC quotes           │
│  - Produces the final JSON output                          │
│                                                            │
│                          │                                 │
│                          ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Repo Scout Subagent                     │  │
│  │              (Claude Haiku)                          │  │
│  │                                                      │  │
│  │  Responsibilities:                                   │  │
│  │  - Explores repository via GitHub API                │  │
│  │  - Gathers metadata (stars, language, topics)        │  │
│  │  - Reads README and documentation                    │  │
│  │  - Analyzes file structure and key source files      │  │
│  │  - Compiles research report for main agent           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

### Why Two Agents?

| Aspect | Haiku (Scout) | Sonnet (Writer) |
|--------|---------------|-----------------|
| **Speed** | Fast | Moderate |
| **Cost** | Low | Higher |
| **Task** | Data gathering | Creative writing |
| **Context** | Isolated exploration | Clean summary input |

**Benefits:**
- **Cost optimization** - Haiku handles the exploration phase cheaply
- **Speed** - Parallel-friendly architecture for faster response
- **Context isolation** - The writer gets a clean summary without exploration noise
- **Separation of concerns** - Each agent is specialized for its task

## System Architecture

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
                   │   - Subagent orchestration      │
                   │   - GitHub API integration      │
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
- `GET /api/article` - List all cached articles (paginated)
- `GET /api/article/search?q=query` - Search articles by headline, category, or author
- `POST /api/article/:slug/feedback` - Submit user feedback (rating + optional comment)
- `DELETE /api/article/:slug` - Delete an article to allow regeneration
- `GET /og/:slug.png` - Dynamic Open Graph image for an article
- `GET /api/health` - Health check

## URL Structure

Articles are accessible at `/article/{owner}-{repo}`, for example:
- `/article/anthropics-claude-code`
- `/article/facebook-react`

The same input URL always maps to the same article URL, enabling sharing and caching.

## Hero Images

Articles are assigned random hero images from a pool of retro-futuristic abstract designs inspired by 1970s/80s aesthetics (think Loki TVA vibes).

- Images are stored in `public/hero-images/`
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`
- The system automatically scans the directory on startup
- See `docs/hero-image-prompts.md` for 30 Nano Banana prompts to generate more

**Migration script** to update existing articles with new hero images:
```bash
cd api && npx tsx scripts/migrate-hero-images.ts
```

## Disclaimer

This is a parody project. All generated articles are fictional and meant for entertainment purposes only. Any resemblance to actual TechCrunch articles or real funding announcements is purely coincidental (and probably says something about the state of tech journalism).

## License

MIT
