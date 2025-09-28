// @ts-check
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const SIZES = {
  'mipmap-mdpi': { size: 48, round: true },
  'mipmap-hdpi': { size: 72, round: true },
  'mipmap-xhdpi': { size: 96, round: true },
  'mipmap-xxhdpi': { size: 144, round: true },
  'mipmap-xxxhdpi': { size: 192, round: true },
  'playstore': { size: 512, round: false },
};

const INPUT_ICON = join(process.cwd(), 'public', 'logo.png');
const OUTPUT_DIR = join(process.cwd(), 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  if (!existsSync(INPUT_ICON)) {
    console.error(`\x1b[31mError: Input icon not found at ${INPUT_ICON}\x1b[0m`);
    console.log('Please make sure you have a `logo.png` file in your `public` directory.');
    process.exit(1);
  }
  
  console.log(`\x1b[32mFound input icon at:\x1b[0m ${INPUT_ICON}`);
  console.log(`\x1b[32mOutput directory set to:\x1b[0m ${OUTPUT_DIR}\n`);

  const imageBuffer = await sharp(INPUT_ICON).toBuffer();

  for (const [dir, { size, round }] of Object.entries(SIZES)) {
    const dirPath = join(OUTPUT_DIR, dir);

    console.log(`\x1b[33mProcessing ${dir}...\x1b[0m`);

    // Clean up old directory if it exists
    if (existsSync(dirPath)) {
        rmSync(dirPath, { recursive: true, force: true });
        console.log(`  \x1b[90m- Removed old directory\x1b[0m`);
    }
    mkdirSync(dirPath, { recursive: true });
    console.log(`  \x1b[90m- Created new directory\x1b[0m`);

    // Generate standard square icon
    const iconName = dir === 'playstore' ? 'playstore-icon.png' : 'ic_launcher.png';
    await sharp(imageBuffer)
      .resize(size, size)
      .toFile(join(dirPath, iconName));
    console.log(`  \x1b[36m- Generated ${iconName} (${size}x${size})\x1b[0m`);

    // Generate round icon if needed
    if (round) {
        await sharp(imageBuffer)
            .resize(size, size)
            .composite([
            {
                input: Buffer.from(
                `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`
                ),
                blend: 'dest-in',
            },
            ])
            .toFile(join(dirPath, 'ic_launcher_round.png'));
        console.log(`  \x1b[36m- Generated ic_launcher_round.png (${size}x${size})\x1b[0m`);
    }
  }

  console.log('\n\x1b[32m✅ All icons generated successfully!\x1b[0m');
  console.log('Run `npx cap sync` to copy them into your native project.');
}

generateIcons().catch((err) => {
  console.error('\x1b[31mAn error occurred during icon generation:\x1b[0m');
  console.error(err);
  process.exit(1);
});
