// Fails when copy contains a claim we cannot support, or leftover placeholder text.
// Scans what people read: the locale files, legal text, screens, README, docs and submission.
// docs/CLAIMS_AUDIT.md explains each rule. To allow a phrase in one place, reword it; there is
// deliberately no inline "ignore" comment.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES = ['app/src/locales', 'app/src/legal', 'app/src/app', 'app/src/components', 'shared/data', 'README.md', 'submission'];
// The audit documents themselves quote the banned phrases in order to explain them.
const EXEMPT = [/CLAIMS_AUDIT\.md$/, /RULES_CHECKLIST\.md$/];

const RULES = [
  [/\breal[- ]?time\b/i, 'says "real-time": data is updated by hand from public documents'],
  [/\blive (data|updates?|status|map|feed)\b/i, 'says data is "live"'],
  [/\bup[- ]to[- ]the[- ]minute\b/i, 'claims up-to-the-minute data'],
  [/(?<!not an |not the |not a |n't an |n't |no )\bofficial (app|service|source|data|city app|partner)\b/i, 'implies the app is official'],
  [/\b(endorsed|approved|sponsored) by (the )?city\b/i, 'implies City endorsement'],
  [/\btrusted by\b/i, 'says "trusted by"'],
  [/\bverified resident/i, 'claims residents are verified (they are anonymous)'],
  [/\b\d[\d,]*\+? (residents|users|people|families) (helped|served|reached|use|trust)\b/i, 'states a user count'],
  [/\bresidents helped\b/i, 'states "residents helped"'],
  [/\bAI[- ]powered accuracy\b|\b100% accurate\b|\balways accurate\b|\bnever wrong\b/i, 'overstates accuracy'],
  [/\b(world[- ]class|best[- ]in[- ]class|cutting[- ]edge|revolutionary|state[- ]of[- ]the[- ]art|award[- ]winning|#1)\b/i, 'uses an unsupportable superlative'],
  [/\bguarantee[ds]?\b/i, 'makes a guarantee'],
  [/\blorem ipsum\b/i, 'contains lorem ipsum'],
  [/\bcoming soon\b/i, 'says "coming soon": every control must work'],
  [/\b(TODO|FIXME|TBD)\b/, 'contains a leftover TODO/FIXME/TBD'],
  [/\[Placeholder\b/i, 'contains a leftover [Placeholder: ...] paragraph'],
  [/\b(limited time|act now|hurry|only \d+ left|don'?t miss out)\b/i, 'uses fake urgency'],
  [/\bno thanks, i (don'?t|do not)\b/i, 'uses confirm-shaming copy'],
];

const walk = (path) => {
  if (!existsSync(path)) return [];
  if (!/\.[a-z]+$/i.test(path)) return readdirSync(path, { withFileTypes: true }).flatMap((e) => walk(join(path, e.name)));
  return /\.(json|ts|tsx|md)$/.test(path) ? [path] : [];
};

const problems = [];
let files = 0;
for (const source of SOURCES) {
  for (const file of walk(join(repo, source))) {
    if (EXEMPT.some((pattern) => pattern.test(file))) continue;
    files += 1;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const [pattern, why] of RULES) {
        const match = pattern.exec(line);
        if (match) problems.push(`${relative(repo, file)}:${i + 1}  ${why}: "${match[0]}"`);
      }
    });
  }
}
if (problems.length) {
  console.error(`Claims check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Claims OK: ${files} files scanned against ${RULES.length} rules.`);
