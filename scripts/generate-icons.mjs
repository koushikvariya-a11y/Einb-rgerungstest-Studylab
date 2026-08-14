import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const iconSvgPath = path.join(rootDir, 'public', 'icons', 'icon.svg');
const maskableSvgPath = path.join(rootDir, 'public', 'icons', 'icon-maskable.svg');
const iconsDir = path.join(rootDir, 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const iconConfigs = [
  { input: iconSvgPath, output: path.join(iconsDir, 'favicon-48x48.png'), width: 48, height: 48 },
  { input: iconSvgPath, output: path.join(iconsDir, 'apple-touch-icon.png'), width: 180, height: 180 },
  { input: iconSvgPath, output: path.join(iconsDir, 'icon-192x192.png'), width: 192, height: 192 },
  { input: iconSvgPath, output: path.join(iconsDir, 'icon-512x512.png'), width: 512, height: 512 },
  { input: maskableSvgPath, output: path.join(iconsDir, 'icon-maskable-512x512.png'), width: 512, height: 512 },
];

async function generateIcons() {
  console.log('Generating PWA icons with Sharp from SVG sources...');

  for (const config of iconConfigs) {
    const pngBuffer = await sharp(config.input)
      .resize(config.width, config.height)
      .png({ compressionLevel: 9 })
      .toBuffer();

    fs.writeFileSync(config.output, pngBuffer);
    console.log(`Generated: ${path.relative(rootDir, config.output)} (${config.width}x${config.height}) [${pngBuffer.length} bytes]`);
  }

  // Ensure redundant legacy root apple-touch-icon is deleted if present
  const rootAppleIcon = path.join(rootDir, 'public', 'apple-touch-icon.png');
  if (fs.existsSync(rootAppleIcon)) {
    fs.unlinkSync(rootAppleIcon);
    console.log('Removed redundant public/apple-touch-icon.png');
  }

  console.log('PWA icon generation complete.');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
