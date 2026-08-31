const developmentOrigin = 'http://localhost:5173';
const externalProtocols = new Set(['http:', 'https:', 'mailto:']);

function withoutFragment(url: URL): string {
  const comparableUrl = new URL(url.href);
  comparableUrl.hash = '';
  return comparableUrl.href;
}

function hasNonEmptyFileAuthority(value: string): boolean {
  const authority = /^file:\/\/([^/?#]*)/i.exec(value)?.[1];
  return authority !== undefined && authority !== '';
}

export function isTrustedSender(value: string, trustedRendererUrl: string): boolean {
  try {
    const senderUrl = new URL(value);
    const trustedUrl = new URL(trustedRendererUrl);

    if (trustedUrl.protocol === 'file:') {
      if (
        trustedUrl.host !== '' ||
        senderUrl.protocol !== 'file:' ||
        senderUrl.host !== '' ||
        hasNonEmptyFileAuthority(value) ||
        hasNonEmptyFileAuthority(trustedRendererUrl)
      ) {
        return false;
      }

      return withoutFragment(senderUrl) === withoutFragment(trustedUrl);
    }

    if (trustedUrl.origin !== developmentOrigin || senderUrl.origin !== developmentOrigin) {
      return false;
    }

    return withoutFragment(senderUrl) === withoutFragment(trustedUrl);
  } catch {
    return false;
  }
}

export function parseExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return externalProtocols.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}
