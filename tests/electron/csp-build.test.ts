// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { build, createServer } from 'vite';
import { describe, expect, it } from 'vitest';

function policyFor(document: Document) {
  const content = document
    .querySelector('meta[http-equiv="Content-Security-Policy"]')
    ?.getAttribute('content');
  expect(content, 'built HTML must include a CSP').toBeTruthy();
  return new Map(
    (content ?? '').split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe('renderer HTML security', () => {
  it('builds local production assets without allowing inline scripts, frames or forms', async () => {
    const result = await build({ build: { write: false }, logLevel: 'silent' });
    const output = (Array.isArray(result) ? result[0] : result) as {
      output: Array<{ fileName: string; source?: string }>;
    };
    const html = output.output.find((asset) => asset.fileName === 'index.html')?.source;
    const document = new JSDOM(html).window.document;
    const policy = policyFor(document);

    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
    for (const directive of ['object-src', 'frame-src', 'base-uri', 'form-action']) {
      expect(policy.get(directive)).toEqual(["'none'"]);
    }
    expect(policy.get('img-src')).toEqual(["'self'", 'data:', 'https:', 'http:', 'md-asset:']);
    expect(document.querySelector('script:not([src])')).toBeNull();
    expect(document.querySelector('script[src]')?.getAttribute('src')).toMatch(/^\.\/assets\//);
    expect(document.querySelector('link[rel="stylesheet"]')?.getAttribute('href')).toMatch(
      /^\.\/assets\//,
    );
  }, 30_000);

  it('authorizes only nonced development preambles while retaining restrictive script policy', async () => {
    const server = await createServer({ server: { middlewareMode: true }, logLevel: 'silent' });
    try {
      const html = await server.transformIndexHtml('/', await readFile('index.html', 'utf8'));
      const document = new JSDOM(html).window.document;
      const policy = policyFor(document);
      const inlineScripts = [...document.querySelectorAll('script:not([src])')];
      expect(inlineScripts.length).toBeGreaterThan(0);
      expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
      expect(policy.get('script-src')).not.toContain("'unsafe-eval'");
      for (const script of inlineScripts) {
        const nonce = script.getAttribute('nonce');
        expect(nonce).toBeTruthy();
        expect(policy.get('script-src')).toContain(`'nonce-${nonce}'`);
      }
    } finally {
      await server.close();
    }
  });
});
