import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const EXPECTED_ICONS = {
  'favicon-48x48.png': { width: 48, height: 48 },
  'apple-touch-icon.png': { width: 180, height: 180 },
  'icon-192x192.png': { width: 192, height: 192 },
  'icon-512x512.png': { width: 512, height: 512 },
  'icon-maskable-512x512.png': { width: 512, height: 512 },
};

async function verifyAssets() {
  console.log('--- STARTING ASSET INTEGRITY & BINARY VERIFICATION ---');

  const questionImagesDir = path.join(rootDir, 'public', 'question-images');
  const iconsDir = path.join(rootDir, 'public', 'icons');

  if (!fs.existsSync(questionImagesDir)) {
    console.error(`ERROR: Question images directory missing: ${questionImagesDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(iconsDir)) {
    console.error(`ERROR: Icons directory missing: ${iconsDir}`);
    process.exit(1);
  }

  const questionFiles = fs.readdirSync(questionImagesDir).filter((f) => f.endsWith('.png'));
  const iconFiles = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.png'));

  if (questionFiles.length !== 43) {
    console.error(`ERROR: Expected exactly 43 question images, but found ${questionFiles.length}`);
    process.exit(1);
  }

  const expectedIconNames = Object.keys(EXPECTED_ICONS);
  if (iconFiles.length !== expectedIconNames.length) {
    console.error(`ERROR: Expected exactly 5 icon images, but found ${iconFiles.length}`);
    process.exit(1);
  }

  let validQuestionCount = 0;
  let validIconCount = 0;
  let invalidCount = 0;
  let fullyDecodedCount = 0;

  // 1. Verify Question Images
  console.log(`Checking ${questionFiles.length} question images...`);
  for (const file of questionFiles) {
    const fullPath = path.join(questionImagesDir, file);
    const buf = fs.readFileSync(fullPath);

    // Byte check header
    const header = buf.subarray(0, 8);
    if (!header.equals(PNG_HEADER)) {
      console.error(`FAIL: ${file} does not have valid PNG signature. Got: ${header.toString('hex')}`);
      invalidCount++;
      process.exit(1);
    }

    // Sharp deep decoding check
    try {
      const meta = await sharp(fullPath).metadata();
      const raw = await sharp(fullPath).raw().toBuffer();
      if (!meta.width || !meta.height || !raw.length) {
        throw new Error('Empty metadata or raw buffer');
      }
      validQuestionCount++;
      fullyDecodedCount++;
    } catch (err) {
      console.error(`FAIL: Sharp failed to decode question image ${file}:`, err.message);
      invalidCount++;
      process.exit(1);
    }
  }

  // 2. Verify Icons
  console.log(`Checking ${iconFiles.length} PWA icons...`);
  for (const file of iconFiles) {
    if (!EXPECTED_ICONS[file]) {
      console.error(`FAIL: Unexpected icon found in icons directory: ${file}`);
      invalidCount++;
      process.exit(1);
    }

    const fullPath = path.join(iconsDir, file);
    const buf = fs.readFileSync(fullPath);

    // Byte check header
    const header = buf.subarray(0, 8);
    if (!header.equals(PNG_HEADER)) {
      console.error(`FAIL: ${file} does not have valid PNG signature. Got: ${header.toString('hex')}`);
      invalidCount++;
      process.exit(1);
    }

    // Sharp deep decoding and dimension check
    try {
      const meta = await sharp(fullPath).metadata();
      const raw = await sharp(fullPath).raw().toBuffer();
      const expected = EXPECTED_ICONS[file];

      if (meta.width !== expected.width || meta.height !== expected.height) {
        console.error(`FAIL: Icon ${file} dimensions mismatch. Expected ${expected.width}x${expected.height}, got ${meta.width}x${meta.height}`);
        invalidCount++;
        process.exit(1);
      }

      if (!raw.length) {
        throw new Error('Empty decoded pixel buffer');
      }

      validIconCount++;
      fullyDecodedCount++;
    } catch (err) {
      console.error(`FAIL: Sharp failed to decode icon ${file}:`, err.message);
      invalidCount++;
      process.exit(1);
    }
  }

  console.log('\n--- ASSET VERIFICATION REPORT ---');
  console.log(`question images: ${validQuestionCount} valid / 43`);
  console.log(`PWA icons: ${validIconCount} valid / 5`);
  console.log(`invalid images: ${invalidCount}`);
  console.log(`fully decoded images: ${fullyDecodedCount} / 48`);
  console.log('All image assets verified successfully!\n');
}

verifyAssets().catch((err) => {
  console.error('Fatal error during asset verification:', err);
  process.exit(1);
});
