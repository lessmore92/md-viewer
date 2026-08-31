export function detectDirection(text: string): 'rtl' | 'ltr' {
  let rtlCount = 0;
  let ltrCount = 0;

  const sample = text.replace(/\s+/g, '').slice(0, 200);
  for (const ch of sample) {
    const code = ch.codePointAt(0);
    if (!code) continue;
    if (code >= 0x0600 && code <= 0x06ff) rtlCount++;
    else if ((code >= 0x0041 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x024f)) ltrCount++;
  }

  if (rtlCount === 0 && ltrCount === 0) return 'ltr';
  return rtlCount >= ltrCount ? 'rtl' : 'ltr';
}
