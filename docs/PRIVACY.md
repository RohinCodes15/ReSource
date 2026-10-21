# Privacy audit

What the app actually stores and sends, checked against the code on October 13, 2026, and compared with the Privacy Policy people see in the app (`app/src/legal/content.ts`). This is an engineering audit, not legal advice. The policy itself is a draft that an adult must review before public launch.

## What is stored on the server

| Data | Table | Tied to a person by | Who can read it | How it is removed |
| --- | --- | --- | --- | --- |
| Impact report: service, ZIP area, description, impact level, optional photo, time | `reports` | Keyed hash of the install token | Admin. The public sees totals of verified reports only. | "Delete my data", or an admin |
| Community post: text, ZIP area, time, vote count | `posts` | Keyed hash | Everyone (approved posts, without the hash) | Delete on the post, "Delete my data", or an admin |
| Votes and abuse flags | `post_votes`, `post_flags` | Keyed hash | Nobody outside the API | "Delete my data" |
| Alert topics and areas | `subscriptions` | Keyed hash | Nobody outside the API | "Stop following", "Delete my data" |
| Consent records: what was agreed to, policy version, time | `consent_records` | Keyed hash | Nobody outside the API | "Delete my data" |
| Feedback message and kind | `feedback` | Nothing | Admin | Not tied to anyone, so it cannot be found per person |
| Deletion request: email address and description | `deletion_requests` | The email address itself | Admin | The address is erased when the request is marked completed |
| Email alert address | `email_subscriptions` | The address | Nobody | Sign-up is switched off: the API refuses it, so the table stays empty |

The install token is a random value made on the device. The server never stores it. It stores an HMAC of it under a server-side secret (`OWNER_HASH_SALT`), which is what the table calls "keyed hash".

## What is held in memory only

| Data | For how long | Why |
| --- | --- | --- |
| Rate-limit counters, keyed by a hash of the IP address and by the keyed hash | Up to 24 hours | To limit how often one visitor can send things |
| Network buckets for votes and flags | Up to 24 hours | So one network cannot stack votes or hide a post alone |
| The current chat conversation, keyed by the keyed hash and language | Up to 10 minutes | So the assistant can follow a conversation without trusting history sent by the browser |

None of these are written to the database. A restart clears them.

## What leaves the server

| To | What | When |
| --- | --- | --- |
| Anthropic | The current question, earlier turns of the same conversation (held in server memory for up to ten minutes) and the chosen language. No location: since 2026-10-18 the rounded position stays on our server, where basic search uses it to sort nearby places. | Only when `ANTHROPIC_API_KEY` is set, the daily token budget is not spent, and someone uses chat |
| Supabase | Everything in the tables above, and sign-in emails | Only when Supabase is configured |
| Nobody else | | The server makes no other outbound calls |

## What the device sends to others directly

| To | What | When |
| --- | --- | --- |
| OpenStreetMap tile server | IP address and the map area viewed | Web, when the Map screen is open |
| Apple or Google | Same | Phones, when the Map screen is open |
| Supabase Auth | Email address | Only if accounts are configured and the person signs in |

`e2e/compliance.spec.ts` ("with Reject all, the app talks only to its own API and, on the map, the tile server") checks this in the web build: it records every request and fails on any other host.

## What stays on the device

Nine keys, all declared in `app/src/lib/storage.ts`, which is the only file allowed to touch storage (`npm run check:storage` enforces that). The Cookie Policy screen renders the same list, and a test checks that it matches. Eight are essential. One, chat history, is optional and is written only after "Accept all" or the matching switch.

No analytics, advertising or crash-reporting package is installed. `check:storage` fails the build if one is added.

## Flows verified on October 13, 2026

Each was exercised by an automated test against the real API in local mode.

| Flow | Result | Test |
| --- | --- | --- |
| Storage banner: three equal choices, nothing optional written before a choice, the choice persists | Works | `compliance.spec.ts` "storage banner" |
| Consent checkbox and age checkbox are required before a report, a post, a deletion request | Works | `flows.spec.ts` "report: validation", "community", "data deletion request form" |
| "I am under 13" replaces the report, post, chat, alert, feedback and sign-in forms and disables voting and flagging | Works in the app. The API separately refuses a report, post or email sign-up that does not confirm age 13 or older. Feedback, votes and flags are blocked by the app only: the API has no way to know a caller's age. | `flows.spec.ts` "under 13"; backend `tests/test_browse_only.py` |
| Download my data | Works: a JSON file with every table above for this device | `flows.spec.ts` "settings" |
| Delete my data | Works: rows are removed at once and a receipt is shown. Covers both the account and the device when signed in. | `flows.spec.ts` "settings"; backend tests |
| Clear data on this device | Works: storage is emptied and the language returns to the device's | `flows.spec.ts` "settings" |
| Data deletion request form | Works: validation, consent, receipt | `flows.spec.ts` "data deletion request form" |
| Stop following alerts | Works: the choice is removed from the server; if the server cannot be reached the app says the choice is still stored there | `flows.spec.ts` "alerts" |
| Email unsubscribe link | Works at the API: the link shows a confirm button and removes the address on confirm. No address can be added, so this only matters for a future version. | backend `tests/` (138 passing) |

## Where the policy and the code differ

| Policy says | Code does | Status |
| --- | --- | --- |
| "Use the unsubscribe link in any alert email" | No alert email is ever sent, and sign-up is refused | Harmless, but the sentence describes a feature that is off. Reword or remove it when the Terms are reviewed. |
| "Connections are encrypted (HTTPS)" | True only once the API and site are deployed behind HTTPS. Local development uses HTTP. | Follow `deployment/deploy_guide.md`; both recommended hosts provide HTTPS. |
| "Before any form that sends us something, the app asks you to confirm you are 13 or older" | True. The checkbox sits next to an "I am under 13" button, which may nudge a child to tick the box. A neutral question asked once is the usual pattern. | Open. Needs an adult who knows COPPA. |
| Policy version `2026-10-12` | The policy text changed on October 13 (two clarifications, listed in its change log). The version constant lives in `shared/constants.ts` and `backend/settings.py`, outside the folders this pass could edit. | Bump both to `2026-10-13` together. |

## Not verified

- Supabase mode end to end. Row-level security policies were read, not run (`docs/SECURITY.md`).
- Anything on a physical phone, including what Apple's and Google's map SDKs send.
- What the hosting providers log. Their access logs will contain IP addresses whatever the application does.
