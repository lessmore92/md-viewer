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

  // RTL words get a higher weight so that Persian sentences containing
  // inline English/code tokens (e.g. "mixed text با کد npm install")
  // are still detected as RTL. Without this, the Latin characters in code
  // tokens would outvote the Persian text and wrongly flip the line to LTR.
  const RTL_WEIGHT = 5;
  return rtlCount * RTL_WEIGHT >= ltrCount ? 'rtl' : 'ltr';
}
