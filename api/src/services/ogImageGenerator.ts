import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import type { StoredArticle } from '../storage/articles.js';

const FONTS_DIR = join(dirname(new URL(import.meta.url).pathname), '../../fonts');

// Cache fonts in memory
let fontsLoaded: any[] | null = null;

async function loadFonts() {
  if (fontsLoaded) return fontsLoaded;

  const [interBold, interRegular] = await Promise.all([
    readFile(join(FONTS_DIR, 'Inter-Bold.ttf')),
    readFile(join(FONTS_DIR, 'Inter-Regular.ttf')),
  ]);

  fontsLoaded = [
    { name: 'Inter', data: interBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Inter', data: interRegular, weight: 400 as const, style: 'normal' as const },
  ];

  return fontsLoaded;
}

/**
 * Convert relative image URL to absolute
 */
function getAbsoluteImageUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  // Convert relative URLs to absolute
  return `https://crunch.fyi${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

/**
 * Generate OG image for an article
 * Returns PNG buffer
 */
export async function generateOgImage(article: StoredArticle): Promise<Buffer> {
  const fonts = await loadFonts();
  const heroImage = getAbsoluteImageUrl(article.article.image);

  // Truncate headline if too long
  const headline = article.article.headline.length > 200
    ? article.article.headline.slice(0, 197) + '...'
    : article.article.headline;

  const HEADER_HEIGHT = 70;

  // Using plain object format for Satori (cast to any for TypeScript)
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: '#0a8935',
        },
        children: [
          // Header bar with logo
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: `${HEADER_HEIGHT}px`,
                padding: '0 32px',
                backgroundColor: '#0a8935',
              },
              children: {
                type: 'span',
                props: {
                  style: {
                    color: 'white',
                    fontSize: '32px',
                    fontWeight: 700,
                  },
                  children: 'crunch.fyi',
                },
              },
            },
          },
          // Main content area
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                width: '100%',
                height: `${630 - HEADER_HEIGHT}px`,
              },
              children: [
                // Left side - Hero image (50%)
                heroImage ? {
                  type: 'div',
                  props: {
                    style: {
                      width: '50%',
                      height: '100%',
                      display: 'flex',
                    },
                    children: {
                      type: 'img',
                      props: {
                        src: heroImage,
                        style: {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        },
                      },
                    },
                  },
                } : null,
                // Right side - Headline (50% or 100% if no image)
                {
                  type: 'div',
                  props: {
                    style: {
                      width: heroImage ? '50%' : '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '40px',
                      backgroundColor: '#0a8935',
                    },
                    children: {
                      type: 'div',
                      props: {
                        style: {
                          color: 'white',
                          fontSize: '38px',
                          fontWeight: 700,
                          lineHeight: 1.2,
                        },
                        children: headline,
                      },
                    },
                  },
                },
              ].filter(Boolean),
            },
          },
        ],
      },
    } as any,
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );

  // Convert SVG to PNG
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1200,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
