// One-off dev utility (not used at runtime) to generate simple placeholder
// PWA icons with zero external dependencies, using Node's built-in zlib to
// hand-build valid PNG files. Swap the generated files in assets/icons/ for
// real artwork whenever you like -- this just makes the manifest valid.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "..", "assets", "icons");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Draws a simple soil-bag-ish glyph: green square, brown rounded "pot", green
// "sprout" -- rendered pixel-by-pixel, good enough for a placeholder icon.
function renderPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = [46, 125, 50]; // green
  const pot = [93, 64, 55]; // brown
  const sprout = [129, 199, 132]; // light green

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let color = bg;

      const potTop = size * 0.5;
      const potInset = size * 0.18;
      if (y > potTop && x > potInset && x < size - potInset) {
        color = pot;
      }

      const cx = size / 2;
      const stemTop = size * 0.22;
      const stemBottom = size * 0.5;
      if (Math.abs(x - cx) < size * 0.03 && y > stemTop && y < stemBottom) {
        color = sprout;
      }
      const leafCy = size * 0.32;
      const dx = (x - cx) / (size * 0.16);
      const dy = (y - leafCy) / (size * 0.1);
      if (dx * dx + dy * dy < 1) {
        color = sprout;
      }

      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

function buildPng(size) {
  const pixels = renderPixels(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // no filter
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512, 180]) {
  const png = buildPng(size);
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`Wrote ${name} (${png.length} bytes)`);
}
