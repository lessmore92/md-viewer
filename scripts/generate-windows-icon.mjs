import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath = 'build/icon.png', outputPath = 'build/icon.ico'] = process.argv.slice(2);
const png = readFileSync(inputPath);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

if (
  !png.subarray(0, 8).equals(pngSignature) ||
  png.readUInt32BE(16) !== 256 ||
  png.readUInt32BE(20) !== 256
) {
  throw new Error('Windows icon source must be a 256x256 PNG.');
}

const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // ICO image type
header.writeUInt16LE(1, 4); // one image

const directoryEntry = Buffer.alloc(16);
// Width and height bytes remain zero, the ICO encoding for 256 pixels.
directoryEntry.writeUInt16LE(1, 4); // color planes
directoryEntry.writeUInt16LE(32, 6); // bits per pixel
directoryEntry.writeUInt32LE(png.length, 8);
directoryEntry.writeUInt32LE(header.length + directoryEntry.length, 12);

writeFileSync(outputPath, Buffer.concat([header, directoryEntry, png]));
