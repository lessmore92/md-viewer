export function writeClipboardText(value: unknown, writeText: (text: string) => void): boolean {
  if (typeof value !== 'string') return false;
  writeText(value);
  return true;
}
