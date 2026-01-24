#!/usr/bin/env node

/**
 * Generate PWA icons from the logo
 * Usage: npx sharp-cli resize ... or use this script with sharp installed
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendPublic = join(__dirname, '..', 'frontend', 'public', 'images');
const logoPath = join(frontendPublic, 'logo.png');

if (!existsSync(logoPath)) {
  console.error('Logo not found at:', logoPath);
  process.exit(1);
}

const sizes = [192, 512];

console.log('Generating PWA icons from logo...');

try {
  // Use sharp-cli via npx to resize the logo
  for (const size of sizes) {
    const outputPath = join(frontendPublic, `icon-${size}.png`);
    console.log(`Creating ${size}x${size} icon...`);

    execSync(
      `npx sharp-cli resize ${size} ${size} --fit contain --background "#ffffff" -i "${logoPath}" -o "${outputPath}"`,
      { stdio: 'inherit' }
    );
  }

  console.log('PWA icons generated successfully!');
} catch (error) {
  console.error('Error generating icons:', error.message);
  console.log('\nAlternative: You can manually resize logo.png to 192x192 and 512x512');
  process.exit(1);
}
