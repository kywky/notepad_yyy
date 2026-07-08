import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(width, height, rgba) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  const raw = Buffer.alloc((width * 4 + 1) * height);

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function hex(color) {
  const value = color.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255
  ];
}

function createIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  function set(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    const offset = (y * size + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = color[3];
  }

  function rect(x, y, width, height, color) {
    for (let py = Math.round(y); py < Math.round(y + height); py += 1) {
      for (let px = Math.round(x); px < Math.round(x + width); px += 1) {
        set(px, py, color);
      }
    }
  }

  function roundRect(x, y, width, height, radius, color) {
    const right = x + width - 1;
    const bottom = y + height - 1;
    for (let py = Math.round(y); py <= Math.round(bottom); py += 1) {
      for (let px = Math.round(x); px <= Math.round(right); px += 1) {
        const cx = px < x + radius ? x + radius : px > right - radius ? right - radius : px;
        const cy = py < y + radius ? y + radius : py > bottom - radius ? bottom - radius : py;
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= radius * radius) {
          set(px, py, color);
        }
      }
    }
  }

  const bg = hex("#18212f");
  const paper = hex("#f7f9fc");
  const green = hex("#4aa66a");
  const ink = hex("#273449");
  const stroke = hex("#0f1722");

  rect(0, 0, size, size, bg);

  const scale = size / 512;
  roundRect(86 * scale, 86 * scale, 316 * scale, 340 * scale, 56 * scale, paper);
  rect(86 * scale, 142 * scale, 316 * scale, 60 * scale, green);
  rect(132 * scale, 236 * scale, 248 * scale, 22 * scale, ink);
  rect(132 * scale, 286 * scale, 248 * scale, 22 * scale, ink);
  rect(132 * scale, 336 * scale, 164 * scale, 22 * scale, ink);
  roundRect(86 * scale, 86 * scale, 316 * scale, 340 * scale, 18 * scale, stroke);
  roundRect(106 * scale, 106 * scale, 276 * scale, 300 * scale, 38 * scale, paper);
  rect(106 * scale, 142 * scale, 276 * scale, 60 * scale, green);
  rect(152 * scale, 238 * scale, 208 * scale, 20 * scale, ink);
  rect(152 * scale, 288 * scale, 208 * scale, 20 * scale, ink);
  rect(152 * scale, 338 * scale, 142 * scale, 20 * scale, ink);

  return png(size, size, pixels);
}

writeFileSync("public/icons/icon-192.png", createIcon(192));
writeFileSync("public/icons/icon-512.png", createIcon(512));
