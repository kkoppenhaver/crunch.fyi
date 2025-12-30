import { mkdir, readFile, writeFile, access, unlink } from 'fs/promises';
import { join, dirname } from 'path';

// Storage directory for OG images
const DATA_DIR = process.env.DATA_DIR || join(dirname(new URL(import.meta.url).pathname), '../../data');
const OG_IMAGES_DIR = join(DATA_DIR, 'og-images');

/**
 * Ensure the OG images directory exists
 */
async function ensureDir(): Promise<void> {
  await mkdir(OG_IMAGES_DIR, { recursive: true });
}

/**
 * Get the file path for an OG image slug
 */
function getImagePath(slug: string): string {
  // Sanitize slug to prevent directory traversal
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  return join(OG_IMAGES_DIR, `${safeSlug}.png`);
}

/**
 * Check if an OG image exists for the given slug
 */
export async function ogImageExists(slug: string): Promise<boolean> {
  try {
    await access(getImagePath(slug));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an OG image by slug
 * Returns the PNG buffer or null if not found
 */
export async function getOgImage(slug: string): Promise<Buffer | null> {
  try {
    const path = getImagePath(slug);
    return await readFile(path);
  } catch {
    return null;
  }
}

/**
 * Save an OG image
 */
export async function saveOgImage(slug: string, imageBuffer: Buffer): Promise<void> {
  await ensureDir();
  const path = getImagePath(slug);
  await writeFile(path, imageBuffer);
  console.log(`[OG Images] Saved OG image: ${slug}`);
}

/**
 * Delete an OG image by slug
 */
export async function deleteOgImage(slug: string): Promise<boolean> {
  try {
    await unlink(getImagePath(slug));
    console.log(`[OG Images] Deleted OG image: ${slug}`);
    return true;
  } catch {
    return false;
  }
}
