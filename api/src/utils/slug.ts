/**
 * Convert a GitHub URL to an article slug
 *
 * Format: owner-repo (lowercase, alphanumeric + hyphens)
 *
 * Examples:
 *   https://github.com/anthropics/claude-code → anthropics-claude-code
 *   https://github.com/facebook/react.git → facebook-react
 *   github.com/user/repo/ → user-repo
 */
export function urlToSlug(url: string): string | null {
  // Parse the URL to extract owner and repo
  const parsed = parseGitHubUrl(url);
  if (!parsed) return null;

  const { owner, repo } = parsed;

  // Create slug: owner-repo, lowercase, alphanumeric + hyphens only
  const slug = `${owner}-${repo}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens

  return slug;
}

/**
 * Parse a GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Normalize: add protocol if missing
  let normalized = url.trim();
  if (!normalized.includes('://')) {
    normalized = `https://${normalized}`;
  }

  try {
    const urlObj = new URL(normalized);

    // Must be github.com
    if (!urlObj.hostname.endsWith('github.com')) {
      return null;
    }

    // Extract path parts: /owner/repo/...
    const pathParts = urlObj.pathname
      .replace(/\.git$/, '') // Remove .git suffix
      .split('/')
      .filter(Boolean); // Remove empty strings

    if (pathParts.length < 2) {
      return null;
    }

    const [owner, repo] = pathParts;

    return { owner, repo };
  } catch {
    return null;
  }
}

/**
 * Convert a slug back to a canonical GitHub URL
 */
export function slugToGitHubUrl(slug: string): string | null {
  // Slug format is owner-repo, but repo names can contain hyphens
  // We can't reliably reverse this without storing the original URL
  // This function assumes the first hyphen separates owner from repo
  const firstHyphen = slug.indexOf('-');
  if (firstHyphen === -1) return null;

  const owner = slug.slice(0, firstHyphen);
  const repo = slug.slice(firstHyphen + 1);

  if (!owner || !repo) return null;

  return `https://github.com/${owner}/${repo}`;
}
