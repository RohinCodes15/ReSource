// Link checker: requests every external URL that the app or its documents show to people.
//
//   node scripts/check-links.mjs
//
// Needs the network, so it is a separate step from the offline checks. A site that refuses
// automated requests (403/429) is reported as "blocked" rather than "broken": open those by hand.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES = ['shared/data', 'app/src/legal', 'app/src/app', 'app/src/components', 'README.md', 'docs', 'submission', 'deployment'];
// Honest identification; fremont.gov's firewall rejects "name/1.0"-style agents.
const USER_AGENT = 'ReSource civic research project (link check)';
const SKIP = [/localhost/, /127\.0\.0\.1/, /example\.(com|org|test)/, /your-/, /\{/, /tile\.openstreetmap\.org\/\{/, /YOUR_/, /<[^>]+>/, /api\.example/];

const walk = (path) => {
  if (!existsSync(path)) return [];
  if (!/\.[a-z]+$/i.test(path)) return readdirSync(path, { withFileTypes: true }).flatMap((e) => walk(join(path, e.name)));
  return /\.(json|ts|tsx|md)$/.test(path) ? [path] : [];
};

const found = new Map(); // url -> first file that mentions it
for (const source of SOURCES) {
  for (const file of walk(join(repo, source))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/https?:\/\/[^\s"'`<>)\]\\]+/g)) {
      const url = match[0].replace(/[.,;:]+$/, '');
      if (!SKIP.some((pattern) => pattern.test(url)) && !found.has(url)) found.set(url, relative(repo, file));
    }
  }
}

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: AbortSignal.timeout(20000) });
      if (response.ok) return { status: response.status, kind: 'ok' };
      if ([401, 403, 405, 429].includes(response.status) && method === 'HEAD') continue; // some servers refuse HEAD
      return { status: response.status, kind: [401, 403, 429].includes(response.status) ? 'blocked' : 'broken' };
    } catch (error) {
      if (method === 'GET') return { status: String(error.cause?.code ?? error.name), kind: 'broken' };
    }
  }
  return { status: 'no response', kind: 'broken' };
}

const results = [];
const urls = [...found.keys()];
for (let i = 0; i < urls.length; i += 6) {
  results.push(...await Promise.all(urls.slice(i, i + 6).map(async (url) => ({ url, file: found.get(url), ...(await check(url)) }))));
}
for (const kind of ['broken', 'blocked']) {
  for (const r of results.filter((x) => x.kind === kind)) console.log(`${kind.toUpperCase().padEnd(8)} ${String(r.status).padEnd(12)} ${r.url}   (${r.file})`);
}
const broken = results.filter((r) => r.kind === 'broken').length;
const blocked = results.filter((r) => r.kind === 'blocked').length;
console.log(`\n${results.length} links checked: ${results.length - broken - blocked} ok, ${blocked} blocked automated requests (check by hand), ${broken} broken.`);
process.exit(broken ? 1 : 0);
