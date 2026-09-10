// @vitest-environment node

import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type BuiltAsset = { fileName: string; source?: string | Uint8Array; code?: string };
type StoredCaches = Map<string, Map<string, Response>>;
type WorkerEvent = {
  request?: Request;
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
};

let fixture: string;
let builtAssets: BuiltAsset[];
const configFile = resolve('vite.config.mts');
const publicAssets = new Map([
  ['fonts/reading font.woff2', 'font-version-one'],
  ['icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
  ['icon-192.png', 'icon-bytes'],
]);

async function buildFixture() {
  const result = await build({
    configFile,
    root: fixture,
    publicDir: join(fixture, 'public'),
    logLevel: 'silent',
    build: { write: false, emptyOutDir: false },
  });
  return ((Array.isArray(result) ? result[0] : result) as { output: BuiltAsset[] }).output;
}

function workerSource(assets = builtAssets) {
  const serviceWorker = assets.find((asset) => asset.fileName === 'sw.js');
  expect(serviceWorker, 'production builds must emit an offline worker').toBeDefined();
  return String(serviceWorker?.source);
}

// Only the browser boundary is replaced: run the emitted worker unchanged.
// Cache.addAll stages responses atomically and rejects failed network responses.
function workerRuntime(
  assets = builtAssets,
  scope = 'https://reader.example/reader/',
  storage: StoredCaches = new Map(),
) {
  const handlers = new Map<string, (event: WorkerEvent) => void>();
  const network = new Map<string, string | Uint8Array>();
  let offline = false;
  let claimed = false;
  let skippedWaiting = false;
  for (const asset of assets) {
    network.set(new URL(asset.fileName, scope).href, asset.code ?? asset.source ?? '');
  }
  for (const [path, content] of publicAssets) {
    network.set(new URL(path, scope).href, content);
  }
  const urlFor = (request: string | Request) =>
    new URL(typeof request === 'string' ? request : request.url, scope).href;
  const fetchResource = async (request: string | Request) => {
    if (offline) throw new TypeError('Network is offline');
    const resource = network.get(urlFor(request));
    return new Response(resource === undefined ? 'Not found' : (resource as BodyInit), {
      status: resource === undefined ? 404 : 200,
    });
  };
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async (name: string) => storage.delete(name),
    open: async (name: string) => {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name)!;
      return {
        async addAll(requests: (string | Request)[]) {
          const responses = await Promise.all(
            requests.map(async (request) => {
              const response = await fetchResource(request);
              if (!response.ok) throw new TypeError('A precache response was not successful');
              return [urlFor(request), response] as const;
            }),
          );
          for (const [url, response] of responses) entries.set(url, response);
        },
        async match(request: string | Request) {
          return entries.get(urlFor(request))?.clone();
        },
      };
    },
  };
  runInNewContext(workerSource(assets), {
    URL,
    Request,
    Response,
    caches,
    fetch: fetchResource,
    self: {
      registration: { scope },
      location: new URL('sw.js', scope),
      addEventListener: (type: string, handler: (event: WorkerEvent) => void) => {
        handlers.set(type, handler);
      },
      skipWaiting: async () => {
        skippedWaiting = true;
      },
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
  });
  return {
    storage,
    network,
    get claimed() {
      return claimed;
    },
    get skippedWaiting() {
      return skippedWaiting;
    },
    goOffline() {
      offline = true;
    },
    async dispatch(type: string) {
      const pending: Promise<unknown>[] = [];
      handlers.get(type)?.({
        waitUntil: (promise) => pending.push(promise),
        respondWith: () => {
          throw new Error('Only fetch events may respond');
        },
      });
      await Promise.all(pending);
    },
    intercept(path: string, mode = 'cors', method = 'GET') {
      const request = new Request(new URL(path, scope), { method });
      Object.defineProperty(request, 'mode', { value: mode });
      let response: Promise<Response> | undefined;
      handlers.get('fetch')?.({
        request,
        respondWith: (promise) => {
          response = Promise.resolve(promise);
        },
        waitUntil: () => undefined,
      });
      return response;
    },
  };
}

beforeAll(async () => {
  fixture = await realpath(await mkdtemp(join(tmpdir(), 'md-viewer-offline-')));
  await mkdir(join(fixture, 'public/fonts'), { recursive: true });
  await writeFile(
    join(fixture, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><main>Offline reader</main><script type="module" src="./main.js"></script></body></html>',
  );
  await writeFile(join(fixture, 'style.css'), 'body { color: #0969da; }');
  await writeFile(join(fixture, 'main.js'), 'document.title = "Offline reader";');
  for (const [path, content] of publicAssets) {
    await writeFile(join(fixture, 'public', path), content);
  }
  builtAssets = await buildFixture();
}, 30_000);

afterAll(async () => {
  if (fixture) await rm(fixture, { recursive: true, force: true });
});

describe('production offline build', () => {
  it.each(['https://reader.example/', 'https://reader.example/reader/'])(
    'serves all generated assets and local fonts/icons offline at %s',
    async (scope) => {
      const runtime = workerRuntime(builtAssets, scope);
      await runtime.dispatch('install');
      runtime.goOffline();
      for (const asset of builtAssets.filter((asset) => asset.fileName !== 'sw.js')) {
        const response = await runtime.intercept(asset.fileName);
        expect(await response?.text()).toBe(String(asset.code ?? asset.source));
      }
      for (const [path, content] of publicAssets) {
        const response = await runtime.intercept(path);
        expect(await response?.text()).toBe(content);
      }
      const home = await runtime.intercept(scope, 'navigate');
      expect(await home?.text()).toContain('Offline reader');
      const nested = await runtime.intercept('notes/chapter?mode=focus', 'navigate');
      expect(await nested?.text()).toContain('Offline reader');
    },
  );

  it('rejects installation when any required public resource fails to download', async () => {
    const runtime = workerRuntime();
    runtime.network.delete('https://reader.example/reader/fonts/reading%20font.woff2');
    await expect(runtime.dispatch('install')).rejects.toThrow('precache response');
    expect(runtime.claimed).toBe(false);
    expect(runtime.skippedWaiting).toBe(false);
  });

  it('keeps navigation and app assets on the active version until a new worker activates', async () => {
    const runtime = workerRuntime();
    await runtime.dispatch('install');
    runtime.network.set('https://reader.example/reader/icon.svg', 'changed on the server');
    runtime.network.set('https://reader.example/reader/notes/chapter', 'online chapter');
    const icon = await runtime.intercept('icon.svg');
    expect(await icon?.text()).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const chapter = await runtime.intercept('notes/chapter', 'navigate');
    expect(await chapter?.text()).toContain('Offline reader');
    for (const cache of runtime.storage.values()) {
      cache.delete('https://reader.example/reader/index.html');
    }
    const uncachedChapter = await runtime.intercept('notes/chapter', 'navigate');
    expect(await uncachedChapter?.text()).toBe('online chapter');
  });

  it('leaves remote images, uncached files, non-GET requests and other scopes to the network', async () => {
    const runtime = workerRuntime();
    await runtime.dispatch('install');
    runtime.goOffline();
    expect(runtime.intercept('https://images.example/photo.png')).toBeUndefined();
    expect(runtime.intercept('private/photo.png')).toBeUndefined();
    expect(runtime.intercept('icon.svg', 'cors', 'POST')).toBeUndefined();
    expect(runtime.intercept('https://reader.example/elsewhere/', 'navigate')).toBeUndefined();
    expect(runtime.intercept('https://reader.example/reader-other/', 'navigate')).toBeUndefined();
  });

  it('preserves a page until normal activation and cleans up only this scope after content changes', async () => {
    const old = workerRuntime();
    const otherScope = workerRuntime(builtAssets, 'https://reader.example/other/', old.storage);
    await old.dispatch('install');
    await otherScope.dispatch('install');
    old.storage.set('another-app-cache', new Map());
    const oldNames = [...old.storage.keys()];
    expect(oldNames).toHaveLength(3);
    const repeat = workerRuntime(await buildFixture());
    await repeat.dispatch('install');
    expect([...repeat.storage.keys()]).toEqual([oldNames[0]]);

    await writeFile(join(fixture, 'public/fonts/reading font.woff2'), 'font-version-two');
    const changed = await buildFixture();
    const updated = workerRuntime(changed, 'https://reader.example/reader/', old.storage);
    updated.network.set(
      'https://reader.example/reader/fonts/reading%20font.woff2',
      'font-version-two',
    );
    await updated.dispatch('install');
    expect([...updated.storage.keys()]).toHaveLength(4);
    expect(updated.skippedWaiting).toBe(false);
    expect(updated.claimed).toBe(false);
    expect(updated.storage.has(oldNames[0])).toBe(true);
    const oldFont = await old.intercept('fonts/reading font.woff2');
    expect(await oldFont?.text()).toBe('font-version-one');
    const newFont = await updated.intercept('fonts/reading font.woff2');
    expect(await newFont?.text()).toBe('font-version-two');
    await updated.dispatch('activate');
    expect(updated.claimed).toBe(true);
    expect(updated.storage.has(oldNames[0])).toBe(false);
    expect(updated.storage.has(oldNames[1])).toBe(true);
    expect(updated.storage.has('another-app-cache')).toBe(true);

    await writeFile(join(fixture, 'main.js'), 'document.title = "A changed reader";');
    const updatedCode = workerRuntime(await buildFixture());
    await updatedCode.dispatch('install');
    expect([...updatedCode.storage.keys()][0]).not.toBe([...updated.storage.keys()].at(-1));
  });

  it('does not expose a worker from the development server', async () => {
    const server = await createServer({
      configFile,
      root: fixture,
      server: { middlewareMode: true },
      logLevel: 'silent',
    });
    try {
      expect(await server.pluginContainer.resolveId('/sw.js')).toBeNull();
    } finally {
      await server.close();
    }
  });

  it('ships an install manifest whose entry point and icons resolve under a nested deployment', async () => {
    const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));
    const base = 'https://reader.example/reader/manifest.webmanifest';
    expect(new URL(manifest.start_url, base).href).toBe('https://reader.example/reader/');
    expect(new URL(manifest.scope, base).href).toBe('https://reader.example/reader/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(
      true,
    );
    for (const icon of manifest.icons) {
      expect(new URL(icon.src, base).pathname).toMatch(/^\/reader\//);
      const png = await readFile(join('public', icon.src));
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
  });
});
