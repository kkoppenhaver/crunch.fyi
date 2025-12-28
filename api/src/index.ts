import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import generateRouter from './routes/generate.js';
import progressRouter from './routes/progress.js';
import articlesRouter from './routes/articles.js';
import trendingRouter from './routes/trending.js';
import { startWorker } from './queue/worker.js';
import { closeConnections } from './queue/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3001', 10);
const isDev = process.env.NODE_ENV !== 'production';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/generate', generateRouter);
app.use('/api/progress', progressRouter);
app.use('/api/article', articlesRouter);
app.use('/api/trending', trendingRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve static frontend files
if (!isDev) {
  // Go up one level from api/ to find the frontend dist folder
  const staticPath = join(process.cwd(), '..', 'dist');
  console.log(`[Server] Serving static files from: ${staticPath}`);
  app.use(express.static(staticPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(join(staticPath, 'index.html'));
  });
}

// Start server and worker
const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${isDev ? 'development' : 'production'}`);
});

// Start the BullMQ worker
const worker = startWorker();

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}, shutting down...`);

  // Stop accepting new connections
  server.close();

  // Close worker
  await worker.close();

  // Close Redis connections
  await closeConnections();

  console.log('[Server] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors to prevent crashes from Redis connection issues
process.on('uncaughtException', (err) => {
  // Ignore Redis connection closed errors - these happen during normal cleanup
  if (err.message === 'Connection is closed.') {
    console.warn('[Server] Ignored Redis connection closed error during cleanup');
    return;
  }
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
});
