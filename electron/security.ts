const developmentOrigin = 'http://localhost:5173';
const externalProtocols = new Set(['http:', 'https:', 'mailto:']);

export function isTrustedSender(value: string, packaged: boolean): boolean {
  try {
    const url = new URL(value);

    if (packaged) {
      return url.protocol === 'file:';
    }

    return url.origin === developmentOrigin;
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
