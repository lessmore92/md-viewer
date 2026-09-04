export interface ReadingPreferences {
  fontSize: number;
  lineHeight: number;
  width: number;
}

export const defaultPreferences: ReadingPreferences = { fontSize: 18, lineHeight: 1.9, width: 48 };
const key = 'md-viewer-reading-v1';

export function readPreferences(): ReadingPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value) return defaultPreferences;
    return {
      fontSize:
        typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
          ? Math.min(28, Math.max(14, Math.round(value.fontSize)))
          : defaultPreferences.fontSize,
      lineHeight: [1.6, 1.9, 2.2].includes(value.lineHeight)
        ? value.lineHeight
        : defaultPreferences.lineHeight,
      width: [38, 48, 60].includes(value.width) ? value.width : defaultPreferences.width,
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(value: ReadingPreferences) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory controls remain usable. */
  }
}
