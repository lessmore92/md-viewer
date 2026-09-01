export type LinkKind = 'fragment' | 'external' | 'relative' | 'unsafe';

const explicitScheme = /^([a-z][a-z\d+.-]*):/i;
const externalSchemes = new Set(['http', 'https', 'mailto']);

export function classifyLink(href: string): LinkKind {
  const value = href.trim();

  if (value.startsWith('#')) return 'fragment';

  const scheme = explicitScheme.exec(value)?.[1]?.toLowerCase();
  if (!scheme) return 'relative';

  return externalSchemes.has(scheme) ? 'external' : 'unsafe';
}

export function isDataImage(source: string): boolean {
  return /^data:image\//i.test(source);
}
