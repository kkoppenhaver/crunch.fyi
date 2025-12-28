import { articleExists } from '../storage/articles.js';
import { urlToSlug } from '../utils/slug.js';

export interface TrendingRepo {
  owner: string;
  name: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
}

// In-memory cache
let cachedRepos: TrendingRepo[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const TRENDING_API_URL = 'https://raw.githubusercontent.com/isboyjc/github-trending-api/main/data/weekly/all.json';

/**
 * Fetch trending repos from weekly trending JSON with caching
 */
export async function fetchTrendingRepos(): Promise<TrendingRepo[]> {
  const now = Date.now();

  // Return cached data if still fresh
  if (cachedRepos.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRepos;
  }

  try {
    const response = await fetch(TRENDING_API_URL, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'dar-article-generator',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.warn(`[Trending] API returned ${response.status}`);
      return cachedRepos; // Return stale cache on error
    }

    const data = await response.json() as {
      items: Array<{
        title: string; // "owner/repo" format
        url: string;
        description: string | null;
        stars: number;
        language: string | null;
      }>;
    };

    // Map API response to our interface
    cachedRepos = data.items.map((repo) => {
      const [owner, name] = repo.title.split('/');
      return {
        owner,
        name,
        url: repo.url,
        description: repo.description,
        stars: repo.stars,
        language: repo.language,
      };
    });

    cacheTimestamp = now;
    console.log(`[Trending] Fetched ${cachedRepos.length} trending repos`);

    return cachedRepos;
  } catch (error) {
    console.warn('[Trending] Failed to fetch:', error instanceof Error ? error.message : error);
    return cachedRepos; // Return stale cache on error
  }
}

/**
 * Get a random trending repo that doesn't have an article yet
 */
export async function getRandomUnprocessedRepo(): Promise<TrendingRepo | null> {
  const repos = await fetchTrendingRepos();
  if (repos.length === 0) return null;

  // Shuffle the array
  const shuffled = [...repos].sort(() => Math.random() - 0.5);

  // Find first repo without existing article
  for (const repo of shuffled) {
    const slug = urlToSlug(repo.url);
    if (slug && !(await articleExists(slug))) {
      return repo;
    }
  }

  // All trending repos have articles - return null to hide suggestion
  return null;
}
