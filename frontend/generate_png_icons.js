const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Function to generate a solid RGBA PNG buffer with simple shapes
function createPngBuffer(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // Bit depth: 8
  ihdr.writeUInt8(6, 9); // Color type: 6 (RGBA)
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw Image Data (Scanlines)
  const lineSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * lineSize);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    const offset = y * lineSize;
    rawData[offset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const idx = offset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded rect or circle background
      if (dist < radius) {
        // Orange Gradient background
        const factor = y / height;
        rawData[idx] = Math.round(234 * (1 - factor) + 245 * factor); // Red
        rawData[idx + 1] = Math.round(88 * (1 - factor) + 158 * factor); // Green
        rawData[idx + 2] = Math.round(12 * (1 - factor) + 11 * factor); // Blue
        rawData[idx + 3] = 255; // Alpha
      } else {
        // Transparent outer border
        rawData[idx] = 0;
        rawData[idx + 1] = 0;
        rawData[idx + 2] = 0;
        rawData[idx + 3] = 0;
      }
    }
  }

  // Draw white bicycle wheels in center
  const wheelRadius = width * 0.12;
  const wheelLeftX = width * 0.32;
  const wheelRightX = width * 0.68;
  const wheelY = height * 0.60;

  for (let y = 0; y < height; y++) {
    const offset = y * lineSize;
    for (let x = 0; x < width; x++) {
      const idx = offset + 1 + x * 4;
      const dLeft = Math.sqrt(Math.pow(x - wheelLeftX, 2) + Math.pow(y - wheelY, 2));
      const dRight = Math.sqrt(Math.pow(x - wheelRightX, 2) + Math.pow(y - wheelY, 2));

      if (Math.abs(dLeft - wheelRadius) < width * 0.02 || Math.abs(dRight - wheelRadius) < width * 0.02) {
        rawData[idx] = 255;
        rawData[idx + 1] = 255;
        rawData[idx + 2] = 255;
        rawData[idx + 3] = 255;
      }
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', idatData);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crcBuf = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcBuf);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.join(__dirname, 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPngBuffer(192, 192, 234, 88, 12));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPngBuffer(512, 512, 234, 88, 12));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPngBuffer(180, 180, 234, 88, 12));

console.log('Successfully generated PNG icons in public directory!');
