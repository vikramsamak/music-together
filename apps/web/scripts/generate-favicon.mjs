import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Exact SVG template matching BrandMark
function createSvg(size) {
  const iconSize = Math.round(size * 0.58);
  const offset = Math.round((size - iconSize) / 2);
  const radius = Math.round(size * 0.24);

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="50%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
  </defs>

  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#brandGrad)" />
  <rect width="${size}" height="${size}" rx="${radius}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${Math.max(1, Math.round(size * 0.02))}" />

  <g transform="translate(${offset}, ${offset}) scale(${iconSize / 24})">
    <path 
      d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" 
      fill="none" 
      stroke="#ffffff" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    />
    <rect x="3.2" y="14.4" width="2.4" height="4.8" rx="1.2" fill="#ffffff" />
    <rect x="18.4" y="14.4" width="2.4" height="4.8" rx="1.2" fill="#ffffff" />
    <rect x="9.2" y="12.5" width="1.6" height="5.5" rx="0.8" fill="#ffffff" />
    <rect x="12" y="9.5" width="1.6" height="8.5" rx="0.8" fill="#ffffff" />
    <rect x="14.8" y="11.5" width="1.6" height="6.5" rx="0.8" fill="#ffffff" />
  </g>
</svg>
`;
}

function createIco(pngBuffers, sizes) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = pngBuffers.length;
  let offset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(numImages, 4); // count

  const dirEntries = [];
  for (let i = 0; i < numImages; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

async function main() {
  const sizes = [16, 32, 48];
  const pngBuffers = [];

  for (const s of sizes) {
    // Generate high resolution SVG then render down for maximum antialiasing
    const svg = createSvg(512);
    const png = await sharp(Buffer.from(svg))
      .resize(s, s)
      .png()
      .toBuffer();
    pngBuffers.push(png);
  }

  const ico = createIco(pngBuffers, sizes);
  const targetPath = path.resolve('app', 'favicon.ico');
  fs.writeFileSync(targetPath, ico);
  console.log(`Updated ${targetPath} successfully (${ico.length} bytes, sizes: ${sizes.join(', ')})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
