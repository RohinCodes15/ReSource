# Security

A summary of the security review in `review/SECURITY.md` (15 findings, S1 to S15) and what has been done about each, taken from the git history up to October 18, 2026. The earlier backend fixes were made by a second coding agent (Codex) working in `backend/`, and this page summarizes those commits without re-verifying them beyond the test suite. The six fixes made on October 18 (S4, S9, S11, S12, S14, S15) were checked against their diffs and the current code. 222 backend tests pass.

Report a vulnerability by email to rohincodes15@gmail.com. Please do not open a public issue for one.

## How the app is protected

- **No account, no password.** A device proves it owns its reports and posts with a random install token. The server stores only an HMAC of the token under a server-side secret, so a copy of the database does not reveal tokens and cannot be used to act as anyone.
- **Admin routes** need the `ADMIN_TOKEN` header (compared in constant time) or a Supabase user whose role is `admin`. With no token set, admin routes refuse everyone and the app says admin is not set up.
- **Input** is validated by Pydantic models with length limits and unknown fields rejected. Descriptions and posts have emails, phone numbers and street addresses removed before saving.
- **Photos** are size-limited, decoded, re-encoded as JPEG (which drops embedded metadata such as GPS position) and stored privately. Only an admin can view one.
- **Rate limits** on every route that writes or costs money, and a daily ceiling on chat across all visitors.
- **The model** (Claude Sonnet 5) is a general-purpose assistant and is not limited to the app's data, so its answers can be wrong. It is told to flag Fremont-specific facts and point to the sourced Budget and Resources tabs, and a Fremont answer containing a phone number or street address not in the app's data is replaced by basic search before it is shown. User text is treated as information, never as instructions.
- **Secrets** stay on the server. The app reads only `EXPO_PUBLIC_*` values, which are public by design.
- **Row-level security** is enabled on every table in Supabase mode, so the public (anon) key can read only the public catalog and approved posts.

## Findings and status

Commit `49a3c4c` ("Fix round (#2)" on `main`) is a squash merge that combines several earlier fix commits, so one hash covers multiple findings.

| ID | Finding | Status | Commit |
| --- | --- | --- | --- |
| S1 | A new client token got a fresh rate-limit allowance | Fixed: limits apply per network and per owner, with a global daily cap on chat | `49a3c4c` |
| S2 | Chat was an open proxy to an expensive model with a 16,000-token cap | Fixed: output and history are bounded. Since 2026-10-18 the default model is Claude Sonnet 5, with a daily token budget (`CHAT_DAILY_TOKEN_BUDGET`) capping spend | `49a3c4c` |
| S3 | One person could hide any post and inflate votes and report counts | Fixed: votes and flags need distinct owners and distinct networks; public counts use verified reports only | `49a3c4c` |
| S4 | `X-Forwarded-For` is trusted from the client when `TRUST_PROXY=1` | Fixed for one proxy: the API now reads the last `X-Forwarded-For` entry, the one the proxy appends, instead of the first, which the client controls. Behind more than one proxy the last entry is the inner proxy's address, and there is no setting for more hops. No test covers this change. | `cbf64de` |
| S5 | A small image could use hundreds of megabytes of memory | Fixed: upload bodies are bounded and oversized bitmaps are refused before decoding | `49a3c4c` |
| S6 | History and area label supplied by the browser reached the model unfiltered | Fixed: the server keeps its own short-lived history and checks contact facts in generated answers | `49a3c4c` |
| S7 | Email subscriptions had no ownership check or confirmation | Fixed: unconfirmed email writes are disabled; unsubscribe asks for confirmation | `49a3c4c` |
| S8 | Free-text service names were stored unscrubbed and could inject spreadsheet formulas | Fixed: names are scrubbed and every CSV cell is escaped | `49a3c4c` |
| S9 | Posts publish at once behind a thin word filter | Partly fixed: every new post now waits for a moderator, so nothing the word filter misses is published at once. The scrubber still removes agency phone numbers and public addresses from posts; the allow-list the review suggested was not added. Approved posts can still be flagged and are held after three independent flags. | `72fac01` |
| S10 | Three privacy statements did not match the code | Fixed in the app: under-13 mode gates feedback, votes and flags (`49a3c4c`, which also adds a backend test that pins those gates); email sign-up is off; the policy now states the rounded position sent with chat | `49a3c4c` and the policy text |
| S11 | One shared admin passcode, no attempt limit, no audit trail | Partly fixed: failed admin attempts are limited to five per network per 15 minutes; the API refuses to start with an `ADMIN_TOKEN` shorter than 24 characters; moderation, service-status and deletion-request changes are appended to `admin_audit.jsonl`. Still one shared passcode. The log records what changed and when, not who, and it is a file in the local state folder, not the database, so it is lost if the host's disk is replaced. | `8a5ae7d` |
| S12 | Identity changes at sign-in | Fixed: sign-in no longer changes identity, since data belongs to the device only and sign-in is for admins (`41c99a9`). Bearer tokens are verified locally against `SUPABASE_JWT_SECRET`, with no call to Supabase per request, and rejections are logged with their reason (`6011c82`). Not run against a live Supabase project. | `41c99a9`, `6011c82` |
| S13 | Row-level security is sound but untested | Open: no test runs the policies. | |
| S14 | No Content-Security-Policy; install token in `localStorage` | Partly fixed: the web build's CSP in `app/vercel.json` (applied only when hosted on Vercel) now allows connections to localhost, Supabase and Railway API addresses instead of any HTTPS address, and API JSON responses carry their own strict CSP. The install token still lives in `localStorage`, so a script injection would still expose it. | `f2bcfc9` |
| S15 | API docs public, unsubscribe by GET, salt derivation, path validation | Fixed: in production (the default when Supabase is configured) `/docs`, `/redoc` and `/openapi.json` are off and a `*` in `CORS_ORIGINS` stops start-up; Supabase mode refuses to start without `OWNER_HASH_SALT` instead of deriving one; ID path parameters must be UUIDs and get a 400 instead of a database error (`771e905`). Unsubscribe by GET was fixed earlier (`49a3c4c`). HSTS is still left to the host. | `771e905`, `49a3c4c` |

"No commit names this finding" means exactly that: the git log has no commit that mentions it. It may still have been touched inside another change. Read the code before relying on either answer.

## What row-level security does and does not protect

The API connects to Supabase with the service-role key, which bypasses row-level security. So RLS does not protect requests that go through the API: those depend on the API's own checks. RLS protects the other door. The web and phone apps contain the public anon key (used for sign-in), and anyone can copy it. With RLS on, that key can read services, resources, alerts and approved posts without their owner hash, and nothing else: not reports, votes, flags, subscriptions, consent records or photos.

## Limits that matter for deployment

- **One API process.** Rate limits, vote and flag network buckets, and chat history live in memory. Running several workers splits them. Use one worker, or move them to a shared store first.
- **Local mode is for development.** It keeps data, including deletion-request emails, in a plain JSON file under `backend/.local_state/`.
- **Set `OWNER_HASH_SALT`.** Supabase mode in production refuses to start without it. The salt is no longer derived from another secret. Local and development mode generate a random salt in `backend/.local_state/salt` instead. Every resident's owner hash depends on this value, so changing it on a live deployment cuts every resident off from their own reports, posts, export and deletion. Set it once and never change it casually. A deployment that ran before this change without the variable used a salt derived from the service-role key; set `OWNER_HASH_SALT` to that same derived value (the SHA-256 hex digest of `resource-owner-salt:` followed by the key) to keep existing data reachable.
- **Set `TRUST_PROXY=1` only behind a proxy you control.** The API trusts the last `X-Forwarded-For` entry, which is correct behind exactly one proxy, such as Railway's (S4). Behind more than one proxy, rate limits would see the inner proxy's address instead of the visitor's.
- **Use a long random `ADMIN_TOKEN`** (32 characters or more) and share it with as few people as possible. There is no per-person admin login unless Supabase accounts are used.

## Not verified

- Supabase mode, including the RLS policies and storage bucket policy, was not run.
- No penetration test and no dependency vulnerability scan (`npm audit`, `pip-audit`) was run in this pass.
- The backend fixes above were not re-tested by hand; the evidence is the commit history and the passing test suite.
