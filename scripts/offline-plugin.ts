import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

async function collectPublicAssets(directory: string, prefix = '') {
  const assets = new Map<string, Uint8Array>();
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return assets;
    throw error;
  }
  for (const entry of entries) {
    const name = `${prefix}${entry.name}`;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [nestedName, contents] of Array.from(
        await collectPublicAssets(path, `${name}/`),
      )) {
        assets.set(nestedName, contents);
      }
    } else if (entry.isFile() && name !== 'sw.js') {
      assets.set(name, await readFile(path));
    }
  }
  return assets;
}

function serviceWorkerSource(paths: string[], version: string) {
  return `// Generated from the complete production app shell. Do not edit.
const SCOPE = self.registration.scope;
const CACHE_PREFIX = 'md-viewer:' + encodeURIComponent(SCOPE) + ':';
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const PRECACHE_URLS = ${JSON.stringify(paths)}.map(path => new URL(path, SCOPE).href);
const PRECACHE = new Set(PRECACHE_URLS);
const INDEX_URL = new URL('./index.html', SCOPE).href;

self.addEventListener('install', event => {
  // A failed download rejects installation, leaving the working worker intact.
  // Normal waiting protects documents open in an older version of the reader.
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cachedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  // These are immutable, allowlisted app files. Vary: Origin from a static
  // host must not make module requests miss the same-origin precache.
  return (await cache.match(request, { ignoreVary: true })) || fetch(request);
}

async function navigation(request) {
  // Keep HTML and assets on one release until the next worker activates.
  // Network fallback is only needed if the browser has evicted the app shell.
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(INDEX_URL, { ignoreVary: true })) || fetch(request);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (PRECACHE.has(url.href)) {
    event.respondWith(cachedAsset(request));
  } else if (request.mode === 'navigate' && url.href.startsWith(SCOPE)) {
    event.respondWith(navigation(request));
  }
  // Document images and every URL outside the known app shell use the network.
});
`;
}

export function offlinePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'offline-reader',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle: {
      // Include the final index.html and all assets emitted by earlier plugins.
      order: 'post',
      async handler(_options, bundle) {
        const assets =
          config.publicDir && config.build.copyPublicDir
            ? await collectPublicAssets(config.publicDir)
            : new Map<string, string | Uint8Array>();
        for (const [name, output] of Object.entries(bundle)) {
          if (name === 'sw.js') continue;
          const source = output.type === 'chunk' ? output.code : output.source;
          assets.set(name, typeof source === 'string' ? Buffer.from(source) : source);
        }
        const entries = Array.from(assets.entries()).sort(([left], [right]) =>
          left.localeCompare(right),
        );
        const hash = createHash('sha256');
        for (const [name, content] of entries) {
          hash.update(name).update('\0').update(createHash('sha256').update(content).digest());
        }
        const version = hash.digest('hex').slice(0, 20);
        // Percent-encode each path segment so filenames containing spaces or #
        // stay local and work under an arbitrary nested installation scope.
        const paths = entries.map(
          ([name]) => `./${name.split('/').map(encodeURIComponent).join('/')}`,
        );
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: serviceWorkerSource(paths, version),
        });
      },
    },
  };
}
