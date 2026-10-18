# Security

A summary of the security review in `review/SECURITY.md` (15 findings, S1 to S15) and what has been done about each, taken from the git history up to October 13, 2026. The backend fixes were made by a second coding agent (Codex) working in `backend/`; this page summarizes its commits and does not re-verify them beyond running the test suite (138 backend tests pass).

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

| ID | Finding | Status | Commit |
| --- | --- | --- | --- |
| S1 | A new client token got a fresh rate-limit allowance | Fixed: limits apply per network and per owner, with a global daily cap on chat | `5052323` |
| S2 | Chat was an open proxy to an expensive model with a 16,000-token cap | Fixed: output and history are bounded. Since 2026-10-18 the default model is Claude Sonnet 5, with a daily token budget (`CHAT_DAILY_TOKEN_BUDGET`) capping spend | `8d0e38e`, `542511c` |
| S3 | One person could hide any post and inflate votes and report counts | Fixed: votes and flags need distinct owners and distinct networks; public counts use verified reports only | `d5a7ab2` |
| S4 | `X-Forwarded-For` is trusted from the client when `TRUST_PROXY=1` | No commit names this finding. Treat as open until checked. | |
| S5 | A small image could use hundreds of megabytes of memory | Fixed: upload bodies are bounded and oversized bitmaps are refused before decoding | `711e6d0`, `ab05c5a` |
| S6 | History and area label supplied by the browser reached the model unfiltered | Fixed: the server keeps its own short-lived history and checks contact facts in generated answers | `a57d7a6` |
| S7 | Email subscriptions had no ownership check or confirmation | Fixed: unconfirmed email writes are disabled; unsubscribe asks for confirmation | `a3220c9`, `ab05c5a` |
| S8 | Free-text service names were stored unscrubbed and could inject spreadsheet formulas | Fixed: names are scrubbed and every CSV cell is escaped | `68fbc99` |
| S9 | Posts publish at once behind a thin word filter | No commit names this finding. Open. Posts can be flagged and are held after three independent flags. | |
| S10 | Three privacy statements did not match the code | Fixed in the app: under-13 mode gates feedback, votes and flags (`ab05c5a`; `23eadee` adds a backend test that pins those gates); email sign-up is off; the policy now states the rounded position sent with chat | `ab05c5a` and the policy text |
| S11 | One shared admin passcode, no attempt limit, no audit trail | No commit names this finding. Open. | |
| S12 | Identity changes at sign-in | Partly fixed: export and delete now cover both the account and the device (`ab05c5a`). The other two points are open. | `ab05c5a` |
| S13 | Row-level security is sound but untested | Open: no test runs the policies. | |
| S14 | No Content-Security-Policy; install token in `localStorage` | Partly addressed: `deployment/deploy_guide.md` and `vercel.json` set security headers for the web build. The token stays in `localStorage`. | |
| S15 | API docs public, unsubscribe by GET, salt derivation, path validation | Unsubscribe by GET is fixed (`a3220c9`). The rest have no commit naming them. | |

"No commit names this finding" means exactly that: the git log has no commit that mentions it. It may still have been touched inside another change. Read the code before relying on either answer.

## What row-level security does and does not protect

The API connects to Supabase with the service-role key, which bypasses row-level security. So RLS does not protect requests that go through the API: those depend on the API's own checks. RLS protects the other door. The web and phone apps contain the public anon key (used for sign-in), and anyone can copy it. With RLS on, that key can read services, resources, alerts and approved posts without their owner hash, and nothing else: not reports, votes, flags, subscriptions, consent records or photos.

## Limits that matter for deployment

- **One API process.** Rate limits, vote and flag network buckets, and chat history live in memory. Running several workers splits them. Use one worker, or move them to a shared store first.
- **Local mode is for development.** It keeps data, including deletion-request emails, in a plain JSON file under `backend/.local_state/`.
- **Set `OWNER_HASH_SALT`.** Without it the salt is derived from another secret, and rotating that secret would cut every resident off from their own data.
- **Set `TRUST_PROXY=1` only behind a proxy you control**, and read S4 first.
- **Use a long random `ADMIN_TOKEN`** (32 characters or more) and share it with as few people as possible. There is no per-person admin login unless Supabase accounts are used.

## Not verified

- Supabase mode, including the RLS policies and storage bucket policy, was not run.
- No penetration test and no dependency vulnerability scan (`npm audit`, `pip-audit`) was run in this pass.
- The backend fixes above were not re-tested by hand; the evidence is the commit history and the passing test suite.
