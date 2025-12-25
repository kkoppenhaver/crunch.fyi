import { Router, Request, Response } from 'express';
import { createSubscriber, getJobChannel } from '../queue/connection.js';
import { articleQueue, getQueuePosition } from '../queue/articleQueue.js';
import type { SSEEvent } from '../types/index.js';

const router = Router();

router.get('/:jobId', async (req: Request<{ jobId: string }>, res: Response) => {
  const { jobId } = req.params;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Helper to send SSE event
  const sendEvent = (event: SSEEvent) => {
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

  // Handle incoming events from worker
  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const event: SSEEvent = JSON.parse(message);
      sendEvent(event);

      // Close connection on terminal events
      if (event.type === 'complete' || event.type === 'error') {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        res.end();
      }
    } catch (e) {
      console.error('[SSE] Failed to parse event:', e);
    }
  });

  // Send periodic queue position updates while waiting
  const positionInterval = setInterval(async () => {
    try {
      const currentState = await job.getState();
      if (currentState === 'waiting') {
        const position = await getQueuePosition(jobId);
        sendEvent({
          type: 'queued',
          position,
          message: position > 0 ? `You are #${position} in queue...` : 'Starting soon...',
        });
      } else {
        clearInterval(positionInterval);
      }
    } catch (e) {
      // Job might be gone, stop updates
      clearInterval(positionInterval);
    }
  }, 3000); // Update every 3 seconds

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(positionInterval);
    subscriber.unsubscribe(channel);
    subscriber.quit();
    console.log(`[SSE] Client disconnected from job ${jobId}`);
  });
});

export default router;
