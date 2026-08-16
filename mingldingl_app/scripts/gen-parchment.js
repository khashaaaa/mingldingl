// scripts/gen-parchment.js — one-off: writes a 256x256 grayscale grain PNG
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const W = 256, H = 256;
const crcTable = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// scanlines: filter byte 0 + grayscale pixels (base 200, soft noise ±18)
const raw = Buffer.alloc(H * (W + 1));
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let y = 0; y < H; y++) {
  raw[y * (W + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const grain = (rand() - 0.5) * 36 + Math.sin(x / 9) * 4 + Math.sin(y / 13) * 4;
    raw[y * (W + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(200 + grain)));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = path.join(__dirname, '..', 'assets', 'textures', 'parchment.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
