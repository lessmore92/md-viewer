// @vitest-environment node

import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('loads the built preload in the sandbox and exposes working intent-only operations', async () => {
  execSync('npm run build:electron', { stdio: 'pipe' });
  const source = await readFile('dist-electron/preload.js', 'utf8');
  let exposedName: string | undefined;
  let api:
    | {
        selectDocument(): Promise<null>;
        openExternal(url: string): Promise<boolean>;
        assetUrl(documentId: string, relativePath: string): string;
      }
    | undefined;
  const invocations: unknown[][] = [];

  // Electron sandbox preloads can require electron, but not local CommonJS modules.
  runInNewContext(source, {
    exports: {},
    require(moduleName: string) {
      if (moduleName !== 'electron') throw new Error(`Sandbox cannot require ${moduleName}`);
      return {
        contextBridge: {
          exposeInMainWorld(name: string, exposed: typeof api) {
            exposedName = name;
            api = exposed;
          },
        },
        ipcRenderer: {
          invoke: async (...args: unknown[]) => {
            invocations.push(args);
            return args[0] === 'document:select' ? null : true;
          },
        },
      };
    },
  });

  expect(exposedName).toBe('electronAPI');
  expect(Object.keys(api ?? {}).sort()).toEqual([
    'assetUrl',
    'onDocumentOpened',
    'openExternal',
    'selectDocument',
  ]);
  await expect(api?.selectDocument()).resolves.toBeNull();
  await expect(api?.openExternal('https://example.com/')).resolves.toBe(true);
  expect(invocations).toEqual([
    ['document:select'],
    ['navigation:open-external', 'https://example.com/'],
  ]);
  expect(api?.assetUrl('document id', 'images/a b.png')).toBe(
    'md-asset://document/document%20id/images/a%20b.png',
  );
}, 30_000);
