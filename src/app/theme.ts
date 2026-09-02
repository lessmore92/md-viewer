export function readDarkPreference(): boolean {
  try {
    return localStorage.getItem('md-viewer-dark') === 'true';
  } catch {
    return false;
  }
}

export function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', dark);
}
