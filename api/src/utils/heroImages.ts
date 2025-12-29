import { readdirSync } from 'fs';
import { join } from 'path';

// Hero image pool for random article assignment
// Drop any image files into public/hero-images/ and they'll be picked up automatically

const HERO_IMAGES_DIR = join(process.cwd(), '..', 'public', 'hero-images');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Fallback image (the current Unsplash one) until hero images are added
const FALLBACK_IMAGE = {
  url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=2560&auto=format&fit=crop',
  credit: 'Unsplash',
};

export interface HeroImage {
  url: string;
  credit: string;
}

// Cache the list of available images (scanned once at startup)
let cachedImages: string[] | null = null;

/**
 * Scan the hero-images directory for available images.
 * Results are cached after first scan.
 */
function getAvailableImages(): string[] {
  if (cachedImages !== null) {
    return cachedImages;
  }

  try {
    const files = readdirSync(HERO_IMAGES_DIR);
    cachedImages = files.filter(file => {
      const ext = file.toLowerCase().slice(file.lastIndexOf('.'));
      return IMAGE_EXTENSIONS.includes(ext);
    });

    if (cachedImages.length > 0) {
      console.log(`[HeroImages] Found ${cachedImages.length} hero images`);
    }

    return cachedImages;
  } catch (error) {
    // Directory doesn't exist or can't be read
    cachedImages = [];
    return cachedImages;
  }
}

/**
 * Get a random hero image from the pool.
 * Falls back to Unsplash image if no hero images are available.
 */
export function getRandomHeroImage(): HeroImage {
  const images = getAvailableImages();

  if (images.length === 0) {
    return {
      url: FALLBACK_IMAGE.url,
      credit: FALLBACK_IMAGE.credit,
    };
  }

  const randomIndex = Math.floor(Math.random() * images.length);
  const selected = images[randomIndex];

  return {
    url: `/hero-images/${selected}`,
    credit: 'Crunch / AI Generated',
  };
}
