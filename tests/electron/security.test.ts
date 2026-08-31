// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { isTrustedSender, parseExternalUrl } from '../../electron/security';

describe('isTrustedSender', () => {
  it('accepts only file URLs in packaged mode', () => {
    expect(isTrustedSender('file:///C:/Program%20Files/MD%20Viewer/index.html', true)).toBe(true);
    expect(isTrustedSender('https://example.com', true)).toBe(false);
  });

  it('accepts the configured Vite origin in development', () => {
    expect(isTrustedSender('http://localhost:5173', false)).toBe(true);
    expect(isTrustedSender('http://localhost:5173/index.html', false)).toBe(true);
  });

  it.each([
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost:5173.evil.test',
    'http://localhost:5173@evil.test',
    'not a URL',
  ])('rejects untrusted development sender %s', (url) => {
    expect(isTrustedSender(url, false)).toBe(false);
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
