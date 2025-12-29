import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

import generateRouter from './routes/generate.js';
import progressRouter from './routes/progress.js';
import articlesRouter from './routes/articles.js';
import trendingRouter from './routes/trending.js';
import { startWorker } from './queue/worker.js';
import { closeConnections } from './queue/connection.js';
import { getArticle } from './storage/articles.js';

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
  const indexHtmlPath = join(staticPath, 'index.html');
  console.log(`[Server] Serving static files from: ${staticPath}`);
  app.use(express.static(staticPath));

  // Article pages - inject meta tags for social sharing
  app.get('/article/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const stored = await getArticle(slug);

      // Read the index.html template
      let html = await readFile(indexHtmlPath, 'utf-8');

      if (stored?.article) {
        const article = stored.article;
        const description = (article.content?.[0] || '').slice(0, 200);
        const url = `https://crunch.fyi/article/${slug}`;

        // Escape HTML entities in content
        const escapeHtml = (str: string) =>
          str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const safeTitle = escapeHtml(article.headline);
        const safeDescription = escapeHtml(description);

        // Replace meta tags in the HTML
        html = html
          .replace(/<title>.*?<\/title>/, `<title>${safeTitle} | Crunch.fyi</title>`)
          .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${safeDescription}"`)
          .replace(/<meta property="og:type" content="[^"]*"/, `<meta property="og:type" content="article"`)
          .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${safeTitle}"`)
          .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${safeDescription}"`)
          .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`)
          .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${safeTitle}"`)
          .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${safeDescription}"`);
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      // On error, just serve the default index.html
      res.sendFile(indexHtmlPath);
    }
  });

  // SPA fallback - serve index.html for all other non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(indexHtmlPath);
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
