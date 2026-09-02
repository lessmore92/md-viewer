// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

it('wraps the complete 256px source PNG in a valid Windows ICO frame', async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'md-viewer-icon-'));
  const output = path.join(temporaryDirectory, 'icon.ico');
  execFileSync(process.execPath, ['scripts/generate-windows-icon.mjs', 'build/icon.png', output]);
  const [png, ico] = await Promise.all([readFile('build/icon.png'), readFile(output)]);

  expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
  expect(ico.readUInt8(6)).toBe(0); // A zero width/height encodes 256px in ICO.
  expect(ico.readUInt8(7)).toBe(0);
  expect(ico.readUInt16LE(10)).toBe(1);
  expect(ico.readUInt16LE(12)).toBe(32);
  expect(ico.readUInt32LE(14)).toBe(png.length);
  expect(ico.readUInt32LE(18)).toBe(22);
  expect(ico.subarray(22)).toEqual(png);
});
