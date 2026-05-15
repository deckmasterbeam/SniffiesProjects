// TODO: this sucks, make it like the sniffies logo with a little (1) notification badge at the top
// Generates simple placeholder PNG icons at the sizes Chrome expects.
// Produces a solid-color square with a small inset border. No external deps.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, "..", "icons");
mkdirSync(iconsDir, { recursive: true });

// Sniffies-ish magenta/pink fill, white border.
const FILL = [0xe6, 0x1f, 0x7a, 0xff];
const BORDER = [0xff, 0xff, 0xff, 0xff];
const SIZES = [16, 32, 48, 128];

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = crc32Table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
};

const makePng = (size) => {
  // Build raw RGBA pixel rows with a 1px (small icons) or 2px (large) border.
  const borderPx = size >= 48 ? 2 : 1;
  const rowLen = size * 4 + 1; // +1 for filter byte
  const raw = Buffer.alloc(rowLen * size);

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < size; x += 1) {
      const isBorder =
        x < borderPx ||
        y < borderPx ||
        x >= size - borderPx ||
        y >= size - borderPx;
      const px = isBorder ? BORDER : FILL;
      const i = rowStart + 1 + x * 4;
      raw[i] = px[0];
      raw[i + 1] = px[1];
      raw[i + 2] = px[2];
      raw[i + 3] = px[3];
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

for (const size of SIZES) {
  const out = join(iconsDir, `icon${size}.png`);
  writeFileSync(out, makePng(size));
  console.log(`[icons] wrote ${out}`);
}
