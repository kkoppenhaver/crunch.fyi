import { Router, Request, Response } from 'express';
import { getArticle } from '../storage/articles.js';
import { getOgImage, saveOgImage } from '../storage/ogImages.js';
import { generateOgImage } from '../services/ogImageGenerator.js';

const router = Router();

/**
 * GET /og/:slug.png
 * Generate or serve cached OG image for an article
 */
router.get('/:slug.png', async (req: Request<{ slug: string }>, res: Response) => {
  const { slug } = req.params;

  if (!slug || typeof slug !== 'string') {
    res.status(400).send('Invalid slug');
    return;
  }

  // Sanitize slug
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (safeSlug !== slug) {
    res.status(400).send('Invalid slug format');
    return;
  }

  try {
    // Check cache first
    const cached = await getOgImage(safeSlug);
    if (cached) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.send(cached);
      return;
    }

    // Get the article to generate the image
    const article = await getArticle(safeSlug);
    if (!article) {
      res.status(404).send('Article not found');
      return;
    }

    // Generate the OG image
    console.log(`[OG] Generating image for: ${safeSlug}`);
    const imageBuffer = await generateOgImage(article);

    // Cache it
    await saveOgImage(safeSlug, imageBuffer);

    // Send the image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.send(imageBuffer);
  } catch (error) {
    console.error('[OG] Error generating image:', error);
    res.status(500).send('Failed to generate image');
  }
});

export default router;
