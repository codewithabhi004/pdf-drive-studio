import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size, drawPixel) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + size * 4;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel(x, y, size);
      const idx = rowStart + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawStudioIcon(x, y, size) {
  const u = x / size;
  const v = y / size;

  // Rounded square mask
  const r = 0.21;
  let alpha = 255;
  const cx = Math.max(r - u, 0, u - (1 - r));
  const cy = Math.max(r - v, 0, v - (1 - r));
  const dist = Math.hypot(cx, cy);
  if (dist > r) return [0, 0, 0, 0];

  // Indigo-to-sky gradient background
  const t = (u + v) * 0.5;
  const bgR = Math.round(79 * (1 - t) + 14 * t);
  const bgG = Math.round(70 * (1 - t) + 165 * t);
  const bgB = Math.round(229 * (1 - t) + 233 * t);

  // White document shape in center
  const inDocX = u >= 0.24 && u <= 0.76;
  const inDocY = v >= 0.18 && v <= 0.82;
  const inFoldCut = u > 0.60 && v < 0.34 && (u - 0.60) + (0.34 - v) > 0.16;

  if (inDocX && inDocY && !inFoldCut) {
    // Fold triangle highlight
    if (u >= 0.60 && v <= 0.34 && u - 0.60 <= 0.16 && 0.34 - v <= 0.16) {
      return [203, 213, 225, alpha];
    }
    // Stylized lines inside document
    if (u >= 0.32 && u <= 0.66 && v >= 0.42 && v <= 0.47) {
      return [79, 70, 229, alpha];
    }
    if (u >= 0.32 && u <= 0.58 && v >= 0.52 && v <= 0.56) {
      return [148, 163, 184, alpha];
    }
    if (u >= 0.32 && u <= 0.62 && v >= 0.60 && v <= 0.64) {
      return [148, 163, 184, alpha];
    }
    if (u >= 0.32 && u <= 0.50 && v >= 0.69 && v <= 0.75) {
      return [14, 165, 233, alpha];
    }
    return [255, 255, 255, alpha];
  }

  return [bgR, bgG, bgB, alpha];
}

for (const [name, size] of [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  const png = createPng(size, drawStudioIcon);
  fs.writeFileSync(path.join(publicDir, name), png);
  console.log(`Generated ${name} (${png.length} bytes)`);
}
