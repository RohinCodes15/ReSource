// WCAG 2.1 AA contrast test over the theme tokens.
// Reads CONTRAST_PAIRS from src/theme.ts: normal text needs 4.5:1, large text and UI parts 3:1.
import { CONTRAST_PAIRS } from '../src/theme.ts';

const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = 0;
for (const pair of CONTRAST_PAIRS) {
  const need = pair.kind ? 3 : 4.5;
  const ratio = contrast(pair.fg, pair.bg);
  const ok = ratio >= need;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2).padStart(5)}:1 (needs ${need})  ${pair.name}  ${pair.fg} on ${pair.bg}`);
}
if (failed) {
  console.error(`\n${failed} color pair(s) do not meet WCAG AA.`);
  process.exit(1);
}
console.log(`\nContrast OK: ${CONTRAST_PAIRS.length} pairs meet WCAG 2.1 AA.`);
