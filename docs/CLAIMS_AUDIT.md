# Claims audit

What the app and its materials say about themselves, and what backs each statement up. Checked on October 13, 2026.

## The automatic check

`npm run check:claims` (`app/scripts/check-claims.mjs`) reads every screen, translation file, legal text, data file, the README and the `submission/` folder, and fails the build on any of these:

| Rule | Why it is banned |
| --- | --- |
| "real-time", "live data", "up-to-the-minute" | The data is entered by hand from public documents |
| "official app / service / source / partner" unless negated | ReSource is not a City service |
| "endorsed / approved / sponsored by the City" | It is not |
| "trusted by" | There is no evidence to cite |
| "verified resident" | Residents are anonymous; only reports are verified, by a moderator |
| A number followed by "residents helped / users served" and the like | No such number exists |
| "100% accurate", "always accurate", "never wrong", "AI-powered accuracy" | The assistant can be wrong and the app says so |
| "world-class", "cutting-edge", "revolutionary", "award-winning", "#1" and similar | Cannot be supported |
| "guarantee" | Nothing is guaranteed |
| "coming soon" | Every control shown must work |
| "TODO", "FIXME", "TBD", "lorem ipsum", "[Placeholder" | Leftover draft text |
| "limited time", "act now", "don't miss out" | Fake urgency |
| "No thanks, I don't..." | Confirm-shaming |

Last run: 53 files, 18 rules, no matches.

## Statements the app makes, and their support

| Statement | Where | Support |
| --- | --- | --- |
| Independent student project, not an official City of Fremont service | Home, the footer of every screen, About, Terms | True. Shown before any content. |
| Every figure links to the City document it was read from | Budget Transparency, Service Status, What Changed for Me | Each row in `shared/data/` has a source address and retrieval date (`docs/DATA_SOURCES.md`). A unit test checks every service returned by What Changed for Me has one. |
| Counts on Home are counted from the database | Home | `/stats` counts rows on each request; a test compares the screen with the API. Offline, the note says the counts come from the saved copy. |
| Reports are counted only after a moderator verifies them | Report, Community Impact, Terms | The public count and the impact totals use verified reports only (backend test). |
| No ads, analytics or trackers | Storage banner, Privacy Policy, About | `check:storage` and the network test in `e2e/compliance.spec.ts`. |
| Location stays on your device | Location dialog, Privacy Policy | True for the stored location. A rounded position is sent to our server with a chat question when a location is set (it is not passed to Anthropic); the policy says so. |
| Under 13: the app collects nothing | Consent notice, Privacy Policy | Forms, voting, flagging and feedback are replaced by a browse-only notice (test "under 13"). The API also refuses a report or post without the age confirmation. Someone who bypasses the app and calls the API directly is not stopped from sending feedback or a vote, so "collects nothing" is a statement about the app, not a technical barrier. |
| AI answers can be wrong; check Fremont facts in the Budget and Resources tabs | Chat | True. Since 2026-10-18 Claude answers from its own knowledge, not the app's data; the notice is always visible. Basic search answers come from the app's data and list their sources. |
| Translations were not reviewed by native speakers | Language list | True. Stated in the app and in `docs/I18N_REVIEW.md`. |
| The code is MIT-licensed | Credits | `LICENSE`. |
| Free, no purchases | About | No payment package is installed. |

## Sample content

Three Community Board posts were written for this project so the board is not empty. They carry `is_sample: true`, are labeled "Starter post by ReSource" on screen, cannot be flagged or deleted from the app, and are left out of the post count. Nothing else in the app is sample data.

## Things the app deliberately does not say

- It does not say how any council member voted. The official minutes were not read, so each action shows "Vote record not yet verified" or "Reported as unanimous" with the news source.
- It does not give a dollar amount or a date where the City has not published one. It says the City has not published it.
- It does not say a service is unchanged. It says the documents read show no budget-related change.
- It does not claim any number of users, because there are none to count yet.

## Open

- The submission documents in `submission/` are covered by the same check. Re-run `npm run check:claims` after editing them.
- The demo video and anything said aloud are not checked by a script. `submission/demo_script.md` avoids the banned claims; keep to it.
