// Fails the build when an <Image> or <img> has no text alternative.
// An image passes with accessibilityLabel / alt / aria-label, or when it is explicitly marked
// decorative (aria-hidden, accessible={false}, accessibilityElementsHidden, alt="").
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : /\.tsx$/.test(entry.name) ? [join(dir, entry.name)] : []);

const OK = /\b(accessibilityLabel|alt|aria-label|aria-hidden|accessibilityElementsHidden)\b|accessible=\{false\}/;
const problems = [];
let images = 0;
for (const file of walk(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<(Image|img|ImageBackground)\b[^>]*>/gs)) {
    images += 1;
    if (!OK.test(match[0])) {
      const line = source.slice(0, match.index).split('\n').length;
      problems.push(`${relative(root, file)}:${line}  <${match[1]}> has no accessibilityLabel/alt and is not marked decorative`);
    }
  }
}
if (problems.length) {
  console.error(`Alt-text check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Alt text OK: ${images} image element(s), all labeled or marked decorative.`);
