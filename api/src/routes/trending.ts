import { Router, Request, Response } from 'express';
import { getRandomUnprocessedRepo } from '../services/trending.js';

const router = Router();

/**
 * GET /api/trending
 * Returns a random trending repo that doesn't have an article yet
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const repo = await getRandomUnprocessedRepo();

    if (!repo) {
      res.json({ suggestion: null });
      return;
    }

    res.json({
      suggestion: {
        owner: repo.owner,
        name: repo.name,
        url: repo.url,
        stars: repo.stars,
        description: repo.description,
        language: repo.language,
      },
    });
  } catch (error) {
    console.warn('[Trending] Route error:', error instanceof Error ? error.message : error);
    // Fail silently - just return no suggestion
    res.json({ suggestion: null });
  }
});

export default router;
