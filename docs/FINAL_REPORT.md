# Final report

State of ReSource on October 13, 2026, on branch `fix-round`. Written for Rohin. It says what was done, what was checked and how, what was not checked, and what to do next, in order.

## The three things to know first

1. **The app works and its checks pass**, on the web, in local mode. Nothing has been deployed, and nothing has been run on a physical phone.
2. **The AI rule needs your attention before you submit.** Most of this code was written by AI coding agents. The contest rules found (2025 wording, via search results) allow AI with full disclosure but say it must not be the entirety of the technical work, and expect you to explain your own contribution. Read `submission/RULES_CHECKLIST.md`, write your section of `submission/AI_DISCLOSURE.md` truthfully, and if in doubt ask your Member's office.
3. **The deadline sources disagree**: October 26 (national page) or October 30 (the CA-17 page). Aim for October 26 before 9:00 AM Pacific. Which district you are in was not confirmed.

## What was completed

| Step | Result | Commit |
| --- | --- | --- |
| Bug list B1 to B34 | App-side items fixed. Backend items were fixed by me before the folder split or by Codex after it. | `3168b87` to `5b8a987` |
| 1. Core pitch | "What changed for me?" is the first action on Home: area and interests in, a sourced summary out, with plain statements where the documents show no change or the City has not published a figure. Printable one-page card with no personal data. Community and Impact are under More. | `1167fb3` |
| 2. Accessibility | axe on every route and on screens that appear after an action; keyboard, focus, 200% text and contrast tested; Lighthouse Accessibility, Best Practices and SEO at 100. Performance on the phone profile is 66 to 70, below the 85 target. | `be4a644` |
| 3. Documentation | Ten documents under `docs/` and `deployment/ENV.md`, with source, license and control tables generated from the repository. | `c697072` |
| 4. Deploy-ready | Docker, Compose, Railway, Vercel and EAS files; navy and gold icon and splash; deploy guide; numbered human to-do list. | `731ca45` |
| 5. Submission | Rules checklist with links, form answers inside their limits, problem statement, demo script, technical overview, judge Q&A, impact plan, media guide, AI disclosure draft, CONTRIBUTING, CODE_OF_CONDUCT. | `310d473` |
| 6. Verification | Everything below; screenshots regenerated. | `44f4735` and this commit |

## What was verified, and the command that verified it

All run on October 13, 2026 on macOS.

| What | Command | Result |
| --- | --- | --- |
| Types, lint, translations, contrast, alt text, storage, claims, unit tests | `cd app && npm run check` | Exit 0. 5 languages × 620 keys; 22 contrast pairs; 62 files against 18 claim rules; 17 unit tests |
| Production web build | `npm run build:web` | Exported |
| End-to-end tests against that build and the real API in local mode | `npm run e2e` | 44 passed (two screenshot tests are skipped in this run by design) |
| Accessibility scan of all 22 routes, dialogs, right-to-left, and post-action screens | part of `npm run e2e` | 0 serious or critical violations |
| Backend tests | `cd backend && .venv/bin/python -m pytest -q` | 138 passed |
| Lighthouse 12, phone and desktop profiles, Home, What Changed for Me, Budget | `npx lighthouse http://localhost:4173/...` | Accessibility, Best Practices, SEO 100; Performance 66 to 70 phone, 95 to 97 desktop |
| Security headers in `app/vercel.json` | built site served locally with the same headers, then eight e2e tests | Passed with no console errors |
| The README in a fresh clone | `git clone --branch fix-round`, then the README's API steps, `npm install`, `npm run check`, `npm run build:web`, `python -m pytest` | API answered `/health`, `/services` (11) and a chat question in basic mode; check exit 0; build exported; 138 backend tests passed |
| Screenshots | `npm run screenshots` | 46 images regenerated from the app online against an empty API |
| Placeholders, leftover markers and secrets | `git grep` for bracketed placeholders, TODO-style markers, key patterns | None found. The one "[Your name]" left is the letter template a resident fills in when writing to their council member. |
| Sample data is labeled | read `shared/data/posts.json` and the Community screen | The three starter posts carry `is_sample: true` and are labeled on screen. Nothing else is sample data. |

## What was not verified

- **Any deployment.** No Supabase project, Railway service, Vercel site or EAS build exists. No account was created.
- **Docker.** `Dockerfile`, `deployment/web.Dockerfile` and `docker-compose.yml` have never been run; Docker is not installed on this machine.
- **Supabase mode**, including row-level security and the photo bucket.
- **Phones.** No iOS or Android build, no device test, no screen-reader pass. The Android map without a Google key was reasoned about, not run.
- **Sign-in.** Needs a Supabase project.
- **`npx expo start`** itself. The fresh-clone test ran the build and the checks, not the interactive dev server.
- **The translations.** Written by an AI model; no native speaker has read Dari, Chinese, Vietnamese or Spanish.
- **The 2026 contest rulebook PDF.** It could not be read. The AI rule is from search results quoting the 2025 rules; the video and form requirements are from the CA-17 page.
- **Codex's backend security fixes**, beyond the passing test suite and their commit messages.
- **That every source page still says what the data says.** They were read on October 12 and not re-opened.
- **The licenses of Inter's modified copies and of the icon set** (see `docs/LICENSES.md`).

## Known limitations

1. Load time on a slow phone is the weakest measurement (Lighthouse Performance 66 to 70).
2. Open security findings: S4, S9, S11, S13 and parts of S12, S14, S15 (`docs/SECURITY.md`).
3. The data is a hand-entered snapshot from October 12, 2026. Nothing updates it.
4. Email alerts are switched off. Notifications only fire when the app is opened.
5. Sign-in is web only. The Android map needs a Google key.
6. The API must run as a single process: rate limits, vote and flag buckets and chat history are in memory.
7. Service names, summaries, alerts and budget labels are English in every language.
8. The age check is self-declared, and "I am under 13" has no undo short of clearing the device.
9. `POLICY_VERSION` still reads `2026-10-12` although the policy text was clarified on October 13; it lives outside the folders this pass could edit.
10. A backend test (`backend/tests/test_browse_only.py`) pins exact lines of `settings.tsx` and `community.tsx`. Editing those lines will fail a backend test even if the behavior is unchanged.

## What to do next, in order

1. **Settle the AI rule and your district** (`submission/RULES_CHECKLIST.md`). Everything else depends on being eligible.
2. **Read the code behind `submission/judge_qa.md`** until you can answer each question yourself, and write your part of `submission/AI_DISCLOSURE.md`.
3. **Get the Terms and Privacy Policy reviewed by an adult** (`docs/HUMAN_TODO.md`, section A).
4. **Deploy** (`deployment/deploy_guide.md`), then run its ten-step smoke test on a phone and a computer.
5. **Record the video** (`submission/demo_script.md`, `submission/MEDIA_GUIDE.md`), keeping it under three minutes.
6. **Submit by October 26, before 9:00 AM Pacific**, unless your Member's office confirms a later date.
7. **Translation review** (`docs/I18N_REVIEW.md`). Before any real resident relies on Dari, Chinese or Vietnamese.
8. **Make the repository public** after checking the history for secrets, and merge `fix-round` into `main`.
9. Later: the open security items, a screen-reader pass, load time, and the outreach in `submission/impact_plan.md`.
