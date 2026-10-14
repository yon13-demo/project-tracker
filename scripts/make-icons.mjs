// Generates the app icons from the Weave logo. Run: node scripts/make-icons.mjs
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const src = 'public/logo/weaver-icon.svg';
await mkdir('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp(src, { density: 384 }).resize(size, size, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toFile(`public/icons/icon-${size}.png`);
}
// Maskable: logo inside the 80% safe zone on a solid background.
const inner = await sharp(src, { density: 384 }).resize(410, 410, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#ffffff' } })
  .composite([{ input: inner, top: 51, left: 51 }]).png().toFile('public/icons/icon-maskable-512.png');
console.log('icons written');
