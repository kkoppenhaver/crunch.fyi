# crunch.fyi

Turn your spaghetti code into unicorn hype.

Paste a GitHub repo URL and our AI agent will analyze the code, investigate the maintainer, and generate a satirical TechCrunch-style article about how it's "changing the world."

![Generated Article Preview](screenshots/article-preview.png)

## Features

- **AI-Powered Article Generation** - Uses Claude Agent SDK to actually clone and analyze GitHub repos
- **TechCrunch-Style Design** - Pixel-perfect recreation of TechCrunch's article layout
- **Real-Time Progress** - Watch the AI agent work with live status updates
- **Job Queue** - Handles concurrent requests gracefully with queue position updates
- **Fake but Believable** - Complete with fabricated funding rounds, anonymous VC quotes, and buzzword-laden headlines

## Tech Stack

**Frontend**
- React + Vite
- Tailwind CSS
- Framer Motion
- Server-Sent Events (SSE)

**Backend**
- Node.js + Express + TypeScript
- Claude Agent SDK (Anthropic)
- BullMQ + Redis (job queue)

## Getting Started

### Prerequisites

- Node.js 18+
- Redis server running locally (or remote Redis URL)
- Anthropic API key

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
REDIS_URL=redis://localhost:6379
PORT=3001
MAX_CONCURRENT_JOBS=2
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
2. The job enters a queue (you'll see your position if others are ahead)
3. Claude Agent clones the repo, reads the code, and analyzes the project
4. A satirical TechCrunch-style article is generated in real-time
5. Get a fully-formatted article ready to share

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
                   └─────────────────────────────────┘
```

## API Endpoints

- `POST /api/generate` - Submit a repo URL for analysis
- `GET /api/progress/:jobId` - SSE stream for job progress
- `GET /api/health` - Health check

## Disclaimer

This is a parody project. All generated articles are fictional and meant for entertainment purposes only. Any resemblance to actual TechCrunch articles or real funding announcements is purely coincidental (and probably says something about the state of tech journalism).

## License

MIT
