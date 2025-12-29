/**
 * Migration script to update all existing articles with random hero images
 *
 * Usage: npx tsx scripts/migrate-hero-images.ts
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getRandomHeroImage } from '../src/utils/heroImages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../data');
const ARTICLES_DIR = join(DATA_DIR, 'articles');

async function migrateHeroImages() {
  console.log('🖼️  Hero Image Migration');
  console.log('========================\n');
  console.log(`Articles directory: ${ARTICLES_DIR}\n`);

  try {
    const files = await readdir(ARTICLES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`Found ${jsonFiles.length} articles to migrate\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of jsonFiles) {
      const filePath = join(ARTICLES_DIR, file);

      try {
        const data = await readFile(filePath, 'utf-8');
        const article = JSON.parse(data);

        // Get a random hero image
        const heroImage = getRandomHeroImage();

        // Check if it's still using the fallback (no hero images available)
        if (heroImage.url.includes('unsplash.com')) {
          console.log(`⚠️  ${file}: No hero images available, skipping`);
          skipped++;
          continue;
        }

        // Update the article
        const oldImage = article.article.image;
        article.article.image = heroImage.url;
        article.article.imageCredit = heroImage.credit;
        article.updatedAt = new Date().toISOString();

        // Save the updated article
        await writeFile(filePath, JSON.stringify(article, null, 2), 'utf-8');

        console.log(`✅ ${file}: ${oldImage.substring(0, 50)}... → ${heroImage.url}`);
        updated++;
      } catch (err) {
        console.error(`❌ ${file}: ${err}`);
        errors++;
      }
    }

    console.log('\n========================');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('========================\n');

  } catch (err) {
    console.error('Failed to read articles directory:', err);
    process.exit(1);
  }
}

migrateHeroImages();
