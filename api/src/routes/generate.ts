import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { articleQueue, getQueueLength } from '../queue/articleQueue.js';
import { urlToSlug } from '../utils/slug.js';
import { getArticle } from '../storage/articles.js';
import { checkAndIncrementAll, getResetTime } from '../services/rateLimiter.js';
import type { GenerateRequest, GenerateResponse } from '../types/index.js';

const router = Router();

/**
 * Extract client IP from request, handling proxies
 */
function getClientIp(req: Request): string {
  // Check X-Forwarded-For header (set by proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Can be comma-separated list, take the first (original client)
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header (set by some proxies)
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to direct connection IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

router.post('/', async (req: Request<{}, {}, GenerateRequest>, res: Response<GenerateResponse | { error: string }>) => {
  // Never cache POST responses
  res.setHeader('Cache-Control', 'no-store');

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

    // Check rate limits (global + per-IP) before generating new article
    const clientIp = getClientIp(req);
    const rateLimit = await checkAndIncrementAll(clientIp);

    if (!rateLimit.allowed) {
      const resetMinutes = await getResetTime();
      const resetText = resetMinutes
        ? `Try again in ${resetMinutes} minute${resetMinutes === 1 ? '' : 's'}.`
        : 'Try again later.';

      if (rateLimit.reason === 'ip_limit') {
        console.log(`[API] IP rate limit reached for ${clientIp} (${rateLimit.ip.current}/${rateLimit.ip.limit})`);
        res.status(429).json({
          error: `You've reached your daily limit of ${rateLimit.ip.limit} articles. ${resetText}`,
        });
      } else {
        console.log(`[API] Global rate limit reached (${rateLimit.global.current}/${rateLimit.global.limit})`);
        res.status(429).json({
          error: `We've hit our daily article limit to manage costs. ${resetText}`,
        });
      }
      return;
    }

    console.log(`[API] Rate limits OK - Global: ${rateLimit.global.current}/${rateLimit.global.limit}, IP ${clientIp}: ${rateLimit.ip.current}/${rateLimit.ip.limit}`);

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
