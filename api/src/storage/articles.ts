import { mkdir, readFile, writeFile, access, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { ArticleData } from '../types/index.js';

// Storage directory for articles
const DATA_DIR = process.env.DATA_DIR || join(dirname(new URL(import.meta.url).pathname), '../../data');
const ARTICLES_DIR = join(DATA_DIR, 'articles');

/**
 * Stored article includes metadata beyond just the article content
 */
export interface StoredArticle {
  slug: string;
  sourceUrl: string;
  article: ArticleData;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ensure the articles directory exists
 */
async function ensureDir(): Promise<void> {
  await mkdir(ARTICLES_DIR, { recursive: true });
}

/**
 * Get the file path for an article slug
 */
function getArticlePath(slug: string): string {
  // Sanitize slug to prevent directory traversal
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  return join(ARTICLES_DIR, `${safeSlug}.json`);
}

/**
 * Check if an article exists for the given slug
 */
export async function articleExists(slug: string): Promise<boolean> {
  try {
    await access(getArticlePath(slug));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an article by slug
 */
export async function getArticle(slug: string): Promise<StoredArticle | null> {
  try {
    const path = getArticlePath(slug);
    const data = await readFile(path, 'utf-8');
    return JSON.parse(data) as StoredArticle;
  } catch {
    return null;
  }
}

/**
 * Save an article
 */
export async function saveArticle(
  slug: string,
  sourceUrl: string,
  article: ArticleData
): Promise<StoredArticle> {
  await ensureDir();

  const now = new Date().toISOString();
  const existing = await getArticle(slug);

  const stored: StoredArticle = {
    slug,
    sourceUrl,
    article,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const path = getArticlePath(slug);
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf-8');

  console.log(`[Storage] Saved article: ${slug}`);
  return stored;
}

/**
 * Delete an article by slug
 */
export async function deleteArticle(slug: string): Promise<boolean> {
  try {
    const { unlink } = await import('fs/promises');
    await unlink(getArticlePath(slug));
    console.log(`[Storage] Deleted article: ${slug}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all articles, sorted by most recent first
 */
export async function listArticles(limit = 10): Promise<StoredArticle[]> {
  try {
    await ensureDir();
    const files = await readdir(ARTICLES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const articles: StoredArticle[] = [];
    for (const file of jsonFiles) {
      try {
        const path = join(ARTICLES_DIR, file);
        const data = await readFile(path, 'utf-8');
        articles.push(JSON.parse(data) as StoredArticle);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by createdAt descending (most recent first)
    articles.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return articles.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Search articles by query string
 * Searches headline, category, and author name
 */
export async function searchArticles(query: string, limit = 20): Promise<StoredArticle[]> {
  try {
    await ensureDir();
    const files = await readdir(ARTICLES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
      return [];
    }

    const articles: StoredArticle[] = [];
    for (const file of jsonFiles) {
      try {
        const path = join(ARTICLES_DIR, file);
        const data = await readFile(path, 'utf-8');
        const article = JSON.parse(data) as StoredArticle;

        // Check if query matches headline, category, or author name
        const headline = article.article.headline?.toLowerCase() || '';
        const category = article.article.category?.toLowerCase() || '';
        const author = article.article.author?.name?.toLowerCase() || '';

        if (
          headline.includes(queryLower) ||
          category.includes(queryLower) ||
          author.includes(queryLower)
        ) {
          articles.push(article);
        }
      } catch {
        // Skip invalid files
      }
    }

    // Sort by createdAt descending (most recent first)
    articles.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return articles.slice(0, limit);
  } catch {
    return [];
  }
}
