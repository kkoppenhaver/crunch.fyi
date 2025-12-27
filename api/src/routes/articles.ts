import { Router, Request, Response } from 'express';
import { getArticle, articleExists, listArticles, deleteArticle } from '../storage/articles.js';

const router = Router();

/**
 * GET /api/article
 * List recent articles
 */
router.get('/', async (_req: Request, res: Response) => {
  const articles = await listArticles(10);

  res.json({
    articles: articles.map((stored) => ({
      slug: stored.slug,
      headline: stored.article.headline,
      category: stored.article.category,
      author: stored.article.author.name,
      createdAt: stored.createdAt,
    })),
  });
});

/**
 * GET /api/article/:slug
 * Fetch a cached article by slug
 */
router.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string') {
    res.status(400).json({ error: 'Invalid slug' });
    return;
  }

  // Sanitize slug
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (safeSlug !== slug) {
    res.status(400).json({ error: 'Invalid slug format' });
    return;
  }

  const stored = await getArticle(safeSlug);

  if (!stored) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }

  res.json({
    slug: stored.slug,
    sourceUrl: stored.sourceUrl,
    article: stored.article,
    createdAt: stored.createdAt,
  });
});

/**
 * HEAD /api/article/:slug
 * Check if an article exists (for cache checks)
 */
router.head('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const exists = await articleExists(safeSlug);

  if (exists) {
    res.status(200).end();
  } else {
    res.status(404).end();
  }
});

/**
 * DELETE /api/article/:slug
 * Delete an article to allow regeneration
 */
router.delete('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string') {
    res.status(400).json({ error: 'Invalid slug' });
    return;
  }

  // Sanitize slug
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (safeSlug !== slug) {
    res.status(400).json({ error: 'Invalid slug format' });
    return;
  }

  const deleted = await deleteArticle(safeSlug);

  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Article not found' });
  }
});

export default router;
