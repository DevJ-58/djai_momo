import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const logoPath = path.join(publicDir, 'logo.png');

await mkdir(publicDir, { recursive: true });

async function renderIcon(size, fitRatio = 0.8) {
  const innerSize = Math.round(size * fitRatio);
  const logo = await sharp(logoPath)
    .resize(innerSize, innerSize, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  const { width, height } = await sharp(logo).metadata();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: '#FFFFFF',
    },
  })
    .composite([{
      input: logo,
      left: Math.floor((size - width) / 2),
      top: Math.floor((size - height) / 2),
    }])
    .flatten({ background: '#FFFFFF' })
    .png()
    .toBuffer();
}

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(faviconSizes.map((size) => renderIcon(size)));
const favicon32 = faviconPngs[1];
const icoHeaderSize = 6 + faviconSizes.length * 16;
const icoHeader = Buffer.alloc(icoHeaderSize);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(faviconSizes.length, 4);

let imageOffset = icoHeaderSize;
faviconSizes.forEach((size, index) => {
  const entryOffset = 6 + index * 16;
  icoHeader.writeUInt8(size === 256 ? 0 : size, entryOffset);
  icoHeader.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
  icoHeader.writeUInt8(0, entryOffset + 2);
  icoHeader.writeUInt8(0, entryOffset + 3);
  icoHeader.writeUInt16LE(1, entryOffset + 4);
  icoHeader.writeUInt16LE(32, entryOffset + 6);
  icoHeader.writeUInt32LE(faviconPngs[index].length, entryOffset + 8);
  icoHeader.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += faviconPngs[index].length;
});

await Promise.all([
  writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([icoHeader, ...faviconPngs])),
  writeFile(path.join(publicDir, 'favicon-32.png'), favicon32),
  writeFile(
    path.join(publicDir, 'favicon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><image href="/favicon-32.png" width="32" height="32"/></svg>\n',
  ),
  writeFile(path.join(publicDir, 'apple-touch-icon.png'), await renderIcon(180)),
  writeFile(path.join(publicDir, 'pwa-192.png'), await renderIcon(192)),
  writeFile(path.join(publicDir, 'pwa-512.png'), await renderIcon(512)),
  writeFile(path.join(publicDir, 'pwa-maskable-512.png'), await renderIcon(512, 0.64)),
]);

console.log('Generated favicon and PWA icons from public/logo.png.');
