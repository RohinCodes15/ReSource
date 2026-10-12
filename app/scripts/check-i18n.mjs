// Fails when the locale files disagree, or when the code uses a translation key that does not exist.
//
//   node scripts/check-i18n.mjs          check everything (used in CI)
//   node scripts/check-i18n.mjs --list   also print every key the code uses
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localeDir = join(root, 'src', 'locales');
const BASE = 'en';

const flatten = (node, prefix = '') =>
  Object.entries(node).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, String(value)]]);
const placeholders = (text) => (text.match(/\{\{\w+\}\}/g) ?? []).sort().join(',');

const locales = Object.fromEntries(
  readdirSync(localeDir).filter((f) => f.endsWith('.json')).map((f) => [f.replace('.json', ''), new Map(flatten(JSON.parse(readFileSync(join(localeDir, f), 'utf8'))))]),
);
const base = locales[BASE];
const problems = [];

// 1. Every locale has exactly the keys English has, with the same {{placeholders}}, and no empty strings.
for (const [code, entries] of Object.entries(locales)) {
  for (const key of base.keys()) {
    if (!entries.has(key)) problems.push(`${code}: missing "${key}"`);
    else if (!entries.get(key).trim()) problems.push(`${code}: empty "${key}"`);
    else if (placeholders(entries.get(key)) !== placeholders(base.get(key))) problems.push(`${code}: placeholders differ in "${key}"`);
  }
  for (const key of entries.keys()) if (!base.has(key)) problems.push(`${code}: extra key "${key}" not in ${BASE}`);
}

// 2. Every key the code asks for exists in English.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);
const namespaces = new Set([...base.keys()].map((key) => key.split('.')[0]));
const used = new Set();
const prefixes = new Set();
for (const file of walk(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8');
  // t('a.b'), t(cond ? 'a.b' : 'c.d'), titleKey="a.b", { title: 'a.b' } in key tables
  for (const match of source.matchAll(/['"]([a-zA-Z]+\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)['"]/g)) {
    if (namespaces.has(match[1].split('.')[0])) used.add(match[1]);
  }
  // t(`titles.${key}`): the part before the first ${ must be a real prefix.
  for (const match of source.matchAll(/\bt\(\s*`([a-zA-Z]+\.[A-Za-z0-9_.]*)\$\{/g)) prefixes.add(match[1]);
  // tx('group', value): the group must exist.
  for (const match of source.matchAll(/\btx\(\s*'([a-zA-Z]+)'/g)) prefixes.add(`${match[1]}.`);
}
for (const key of used) if (!base.has(key)) problems.push(`code uses "${key}", which is not in ${BASE}.json`);
for (const prefix of prefixes) {
  if (![...base.keys()].some((key) => key.startsWith(prefix))) problems.push(`code builds keys starting with "${prefix}", but ${BASE}.json has none`);
}

if (process.argv.includes('--list')) console.log([...used].sort().join('\n'), '\n-- prefixes --\n', [...prefixes].sort().join('\n'));
if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n OK: ${Object.keys(locales).length} locales x ${base.size} keys; ${used.size} keys used in code.`);
