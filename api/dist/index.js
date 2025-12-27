import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import generateRouter from './routes/generate.js';
import progressRouter from './routes/progress.js';
import articlesRouter from './routes/articles.js';
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
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// In production, serve static frontend files
if (!isDev) {
    const staticPath = join(__dirname, '../../dist');
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
async function shutdown(signal) {
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
//# sourceMappingURL=index.js.map