// Keeps the Cookie Policy honest: only src/lib/storage.ts may touch on-device storage, so its
// STORAGE_KEYS list (which the policy screen renders) is the complete list. Also fails if a
// known analytics or tracking package appears in package.json.
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = join('src', 'lib', 'storage.ts');
const STORAGE = /\b(AsyncStorage|localStorage|sessionStorage|indexedDB|document\.cookie|SecureStore)\b/;
const TRACKERS = /(analytics|segment|amplitude|mixpanel|sentry|bugsnag|firebase|facebook|fbsdk|gtag|hotjar|posthog|datadog|appsflyer|adjust|admob|react-native-iap|expo-in-app-purchases|revenuecat|purchases)/i;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) ? [join(dir, entry.name)] : []);

const problems = [];
for (const file of walk(join(root, 'src'))) {
  const path = relative(root, file);
  if (path === ALLOWED) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    if (STORAGE.test(code)) problems.push(`${path}:${i + 1}  touches device storage outside lib/storage.ts`);
  });
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  if (TRACKERS.test(name)) problems.push(`package.json: "${name}" looks like an analytics, ads or purchase package`);
}

if (problems.length) {
  console.error(`Storage check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
const keys = [...readFileSync(join(root, ALLOWED), 'utf8').matchAll(/key: '([^']+)', category: '(\w+)'/g)];
console.log(`Storage OK: ${keys.length} keys, all declared in lib/storage.ts (${keys.filter((k) => k[2] === 'optional').length} optional). No analytics, ads or purchase packages.`);
