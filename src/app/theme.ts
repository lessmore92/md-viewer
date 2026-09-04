export type StandardTheme = 'light' | 'dark';
export type Theme = StandardTheme | 'ebook-reader';

export function readStandardTheme(): StandardTheme {
  try {
    return localStorage.getItem('md-viewer-dark') === 'true' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem('md-viewer-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'ebook-reader') return saved;
  } catch {
    /* A theme still works without storage. */
  }
  return readStandardTheme();
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem('md-viewer-theme', theme);
    // Keep the previous light/dark choice when temporarily using ebook mode.
    if (theme !== 'ebook-reader') localStorage.setItem('md-viewer-dark', String(theme === 'dark'));
  } catch {
    /* Storage is optional. */
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const browserChrome = document.querySelector('meta[name="theme-color"]');
  browserChrome?.setAttribute(
    'content',
    theme === 'ebook-reader' ? '#e3e2db' : theme === 'dark' ? '#171e27' : '#0969da',
  );
}
