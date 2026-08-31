// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { isTrustedSender, parseExternalUrl } from '../../electron/security';

describe('isTrustedSender', () => {
  const packagedRendererUrl = 'file:///D:/md-viewer/dist/index.html';
  const developmentRendererUrl = 'http://localhost:5173/';

  it('accepts the exact packaged renderer entry and its fragments', () => {
    expect(isTrustedSender(packagedRendererUrl, packagedRendererUrl)).toBe(true);
    expect(isTrustedSender(`${packagedRendererUrl}#readme`, packagedRendererUrl)).toBe(true);
  });

  it.each([
    'file:///D:/documents/README.md',
    'file://localhost/D:/md-viewer/dist/index.html',
    'file://fileserver/share/dist/index.html',
    'file:///D:/md-viewer/dist/other.html',
  ])('rejects unrelated packaged file sender %s', (url) => {
    expect(isTrustedSender(url, packagedRendererUrl)).toBe(false);
  });

  it('accepts only the exact Vite application origin and path in development', () => {
    expect(isTrustedSender(developmentRendererUrl, developmentRendererUrl)).toBe(true);
    expect(isTrustedSender(`${developmentRendererUrl}#readme`, developmentRendererUrl)).toBe(true);
    expect(isTrustedSender('http://localhost:5173/index.html', developmentRendererUrl)).toBe(false);
  });

  it.each([
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost:5173.evil.test',
    'http://localhost:5173@evil.test',
    'not a URL',
  ])('rejects untrusted development sender %s', (url) => {
    expect(isTrustedSender(url, developmentRendererUrl)).toBe(false);
  });

  it('rejects a malformed trusted renderer URL', () => {
    expect(isTrustedSender(developmentRendererUrl, 'not a URL')).toBe(false);
  });
});

describe('parseExternalUrl', () => {
  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x'])(
    'rejects unsafe external URL %s',
    (value) => {
      expect(parseExternalUrl(value)).toBeNull();
    },
  );

  it.each(['https://example.com', 'http://localhost:3000', 'mailto:test@example.com'])(
    'accepts supported external URL %s',
    (value) => {
      expect(parseExternalUrl(value)?.href).toBeTruthy();
    },
  );

  it.each(['', 'example.com', 'https://'])('rejects malformed external URL %s', (value) => {
    expect(parseExternalUrl(value)).toBeNull();
  });
});
