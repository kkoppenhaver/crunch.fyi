import { Router } from 'express';
import { createSubscriber, getJobChannel } from '../queue/connection.js';
import { articleQueue, getQueuePosition } from '../queue/articleQueue.js';
const router = Router();
router.get('/:jobId', async (req, res) => {
    const { jobId } = req.params;
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();
    // Track if response has been closed to prevent writes after end
    let responseClosed = false;
    // Helper to send SSE event (guards against writes after close)
    const sendEvent = (event) => {
        if (responseClosed)
            return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    // Check if job exists
    const job = await articleQueue.getJob(jobId);
    if (!job) {
        sendEvent({ type: 'error', error: 'Job not found' });
        res.end();
        return;
    }
    // Check job state
    const state = await job.getState();
    if (state === 'completed') {
        // Job already done - this shouldn't happen often but handle it
        sendEvent({ type: 'error', error: 'Job already completed. Please try again.' });
        res.end();
        return;
    }
    if (state === 'failed') {
        const failedReason = job.failedReason || 'Unknown error';
        sendEvent({ type: 'error', error: failedReason });
        res.end();
        return;
    }
    // Send initial queue position
    if (state === 'waiting' || state === 'delayed') {
        const position = await getQueuePosition(jobId);
        sendEvent({
            type: 'queued',
            position,
            message: position > 0 ? `You are #${position} in queue...` : 'Starting soon...',
        });
    }
    // Subscribe to job events
    const subscriber = createSubscriber();
    const channel = getJobChannel(jobId);
    await subscriber.subscribe(channel);
    // Send periodic queue position updates while waiting
    const positionInterval = setInterval(async () => {
        if (responseClosed)
            return;
        try {
            const currentState = await job.getState();
            if (currentState === 'waiting') {
                const position = await getQueuePosition(jobId);
                sendEvent({
                    type: 'queued',
                    position,
                    message: position > 0 ? `You are #${position} in queue...` : 'Starting soon...',
                });
            }
            else {
                clearInterval(positionInterval);
            }
        }
        catch (e) {
            // Job might be gone, stop updates
            clearInterval(positionInterval);
        }
    }, 3000); // Update every 3 seconds
    // Helper to cleanly close the connection
    const closeConnection = () => {
        if (responseClosed)
            return;
        responseClosed = true;
        clearInterval(positionInterval);
        // Use disconnect() instead of quit() to avoid flushQueue errors
        // disconnect() is immediate and doesn't wait for pending commands
        subscriber.disconnect();
        res.end();
    };
    // Handle Redis subscriber errors
    subscriber.on('error', (err) => {
        console.error('[SSE] Redis subscriber error:', err);
        closeConnection();
    });
    // Handle incoming events from worker
    subscriber.on('message', (_channel, message) => {
        if (responseClosed)
            return;
        try {
            const event = JSON.parse(message);
            sendEvent(event);
            // Close connection on terminal events
            if (event.type === 'complete' || event.type === 'error') {
                closeConnection();
            }
        }
        catch (e) {
            console.error('[SSE] Failed to parse event:', e);
        }
    });
    // Clean up on client disconnect
    req.on('close', () => {
        closeConnection();
        console.log(`[SSE] Client disconnected from job ${jobId}`);
    });
});
export default router;
//# sourceMappingURL=progress.js.map