import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const width = 1200;
const height = 630;
const data = Buffer.alloc(width * height * 4);

const font = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const t = (x / width) * 0.58 + (y / height) * 0.42;
    const r = lerp(13, 24, t);
    const g = lerp(18, 35, t);
    const b = lerp(30, 52, t);
    put(x, y, r, g, b, 255);
  }
}

for (let x = 0; x < width; x += 54) {
  rect(x, 0, 1, height, [255, 255, 255, 13]);
}
for (let y = 0; y < height; y += 54) {
  rect(0, y, width, 1, [255, 255, 255, 13]);
}

rect(72, 68, 1056, 494, [255, 255, 255, 9]);
strokeRect(72, 68, 1056, 494, [255, 255, 255, 30], 2);
circle(1010, 122, 210, [138, 180, 248, 18]);
circle(116, 548, 180, [110, 231, 183, 16]);

rect(116, 118, 92, 92, [138, 180, 248, 30]);
strokeRect(116, 118, 92, 92, [138, 180, 248, 130], 3);
text("W", 142, 145, 7, [220, 232, 255, 255]);

text("WHYISEE.XYZ", 238, 124, 9, [244, 247, 251, 255]);
text("SEE IDEAS LAUNCH INSPIRATION", 242, 202, 4, [154, 167, 184, 255]);
text("INDIE BUILDING AI TOOLS", 118, 324, 6, [244, 247, 251, 255]);
text("PRODUCTIVITY WORKFLOWS", 118, 390, 6, [244, 247, 251, 255]);

rect(118, 466, 250, 52, [138, 180, 248, 235]);
rect(118, 466, 125, 52, [110, 231, 183, 150]);
text("WHYISEE", 142, 484, 3, [9, 17, 28, 255]);
text("REAL NOTES HONEST BUILDS USEFUL RESOURCES", 392, 486, 3, [183, 193, 208, 255]);

writeFileSync(join(import.meta.dirname, "../public/og-image.png"), png(data, width, height));

function text(value, x, y, scale, color) {
  let cursor = x;
  for (const char of value.toUpperCase()) {
    const glyph = font[char] || font[" "];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === "1") {
          rect(cursor + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cursor += 6 * scale;
  }
}

function rect(x, y, w, h, color) {
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(width, Math.ceil(x + w));
  const endY = Math.min(height, Math.ceil(y + h));
  for (let yy = startY; yy < endY; yy += 1) {
    for (let xx = startX; xx < endX; xx += 1) {
      blend(xx, yy, color);
    }
  }
}

function strokeRect(x, y, w, h, color, size) {
  rect(x, y, w, size, color);
  rect(x, y + h - size, w, size, color);
  rect(x, y, size, h, color);
  rect(x + w - size, y, size, h, color);
}

function circle(cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        blend(x, y, color);
      }
    }
  }
}

function put(x, y, r, g, b, a) {
  const i = (y * width + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function blend(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  const i = (y * width + x) * 4;
  const alpha = a / 255;
  data[i] = Math.round(r * alpha + data[i] * (1 - alpha));
  data[i + 1] = Math.round(g * alpha + data[i + 1] * (1 - alpha));
  data[i + 2] = Math.round(b * alpha + data[i + 2] * (1 - alpha));
  data[i + 3] = 255;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function png(raw, w, h) {
  const scanlines = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    scanlines[y * (w * 4 + 1)] = 0;
    raw.copy(scanlines, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr(w, h)),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ihdr(w, h) {
  const buffer = Buffer.alloc(13);
  buffer.writeUInt32BE(w, 0);
  buffer.writeUInt32BE(h, 4);
  buffer[8] = 8;
  buffer[9] = 6;
  buffer[10] = 0;
  buffer[11] = 0;
  buffer[12] = 0;
  return buffer;
}

function chunk(type, payload) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, payload])), 0);
  return Buffer.concat([length, typeBuffer, payload, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
