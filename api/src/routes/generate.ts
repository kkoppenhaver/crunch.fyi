import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { articleQueue, getQueueLength } from '../queue/articleQueue.js';
import { urlToSlug } from '../utils/slug.js';
import { getArticle } from '../storage/articles.js';
import type { GenerateRequest, GenerateResponse } from '../types/index.js';

const router = Router();

router.post('/', async (req: Request<{}, {}, GenerateRequest>, res: Response<GenerateResponse | { error: string }>) => {
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

  // Convert URL to slug
  const slug = urlToSlug(repoUrl);
  if (!slug) {
    res.status(400).json({ error: 'Could not parse repository URL' });
    return;
  }

  try {
    // Check if article already exists in cache
    const cached = await getArticle(slug);
    if (cached) {
      console.log(`[API] Cache hit for ${slug}, returning cached article`);
      res.json({
        cached: true,
        slug,
        article: cached.article,
      });
      return;
    }

    // Generate unique job ID
    const jobId = nanoid(12);

    // Add job to queue
    await articleQueue.add(
      'analyze',
      {
        repoUrl,
        jobId,
        slug, // Include slug for storage after generation
        createdAt: Date.now(),
      },
      {
        jobId, // Use our ID as BullMQ job ID too
      }
    );

    // Get queue position
    const position = await getQueueLength();

    console.log(`[API] Created job ${jobId} for ${repoUrl} (slug: ${slug}), position: ${position}`);

    res.json({
      jobId,
      position,
      slug,
    });
  } catch (error) {
    console.error('[API] Failed to create job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

export default router;
