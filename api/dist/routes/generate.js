import { Router } from 'express';
import { nanoid } from 'nanoid';
import { articleQueue, getQueueLength } from '../queue/articleQueue.js';
const router = Router();
router.post('/', async (req, res) => {
    const { repoUrl } = req.body;
    // Validate input
    if (!repoUrl || typeof repoUrl !== 'string') {
        res.status(400).json({ error: 'repoUrl is required' });
        return;
    }
    // Basic URL validation
    const urlPattern = /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/.+\/.+/i;
    if (!urlPattern.test(repoUrl)) {
        res.status(400).json({ error: 'Invalid repository URL. Must be a GitHub, GitLab, or Bitbucket URL.' });
        return;
    }
    try {
        // Generate unique job ID
        const jobId = nanoid(12);
        // Add job to queue
        await articleQueue.add('analyze', {
            repoUrl,
            jobId,
            createdAt: Date.now(),
        }, {
            jobId, // Use our ID as BullMQ job ID too
        });
        // Get queue position
        const position = await getQueueLength();
        console.log(`[API] Created job ${jobId} for ${repoUrl}, position: ${position}`);
        res.json({
            jobId,
            position,
        });
    }
    catch (error) {
        console.error('[API] Failed to create job:', error);
        res.status(500).json({ error: 'Failed to create job' });
    }
});
export default router;
//# sourceMappingURL=generate.js.map