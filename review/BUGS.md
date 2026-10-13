# ReSource: bugs and risks

Independent review, snapshot taken 2026-10-12 about 17:30 PDT. Another agent was editing `app/src` during the review (nine screens and `es.json` were modified in the working tree), so line numbers are from the working copy at that time and may have shifted by a few lines.

## How this was checked

| Check | Result |
| --- | --- |
| `backend`: `pytest` | 41 passed |
| `backend`: `build_seed.py --check` | `seed.sql` matches `shared/data` |
| `backend`: `ruff check` | 7 style findings, none a defect |
| `app`: `tsc --noEmit` | clean |
| `app`: `eslint .` | clean |
| `app`: `check:contrast`, `check:alt`, `check:storage` | pass |
| `app`: `check:i18n` | **fails**, 1,731 problems (B3) |
| `app`: `check:claims` | **fails**, 1 problem (B22) |
| `app`: `jest` | **fails**, 4 suites cannot be parsed (B22) |
| Playwright e2e | not run (it starts servers on fixed ports while another agent is working). The last recorded run in `app/test-results` failed one test (B3). |
| Native builds (iOS, Android) | not run. Native-only items below are marked "not run". |

"Reproduced" means I ran it against the backend in local mode with a temporary state folder, or ran the function directly. "Read" means I traced it in the code and did not execute it.

## Summary

Fix these first; each one is visible in a five-minute demo:

1. **B1**: the first suggestion chip in chat, "Which services were cut?", answers with a homeless-services nonprofit in the default no-API-key mode.
2. **B2**: with an AI key, the conversation breaks permanently after any answer longer than 2,000 characters.
3. **B3**: Dari, Chinese and Vietnamese are 92% untranslated.
4. **B4**: "Made by [Your name]" appears in the footer of every screen, and placeholders appear in the Privacy Policy and Terms.
5. **B5**: with default configuration the Admin and Community Impact screens can never be unlocked, so reports stay "pending" forever.

| ID | Severity | Area | One line |
| --- | --- | --- | --- |
| B1 | High | Chat (basic mode) | Wrong answer to the app's own first suggestion |
| B2 | High | Chat (AI mode) | History validation kills the conversation after a long answer |
| B3 | High | Languages | fa, zh, vi have 97 of 568 strings |
| B4 | High | Polish | Placeholder name and email shown to users |
| B5 | High | Admin | Admin and Impact are dead screens without `ADMIN_TOKEN` |
| B6 | High (not run) | Android | Map likely crashes in a standalone Android build: no Google Maps key |
| B7 | Medium | Chat | Every answer is generated twice on platforms without streaming |
| B8 | Medium | Chat | A reload mid-answer leaves a permanent "Writing an answer" bubble and breaks later sends |
| B9 | Medium | Chat | The streaming request has no timeout |
| B10 | Medium | Reports | Public "Impact reports received" counts unreviewed reports |
| B11 | Medium | Sign-in | Sign-in does not complete on phones; on web it is invisible until you reopen the Sign-in screen |
| B12 | Medium | Privacy | Signing in switches identity, so "Delete my data" misses earlier posts |
| B13 | Medium | Alerts | "Notify me" only fires while the Alerts screen is open, and fires at once for old alerts |
| B14 | Medium | Alerts | Two notices state things that did not happen ("will sync", "removed from our server") |
| B15 | Medium | Location | GPS at City Hall is labeled "near Centerville & Niles" |
| B16 | Medium | Resources | "Find Alternative" does nothing the second time for the same service |
| B17 | Medium | Status | "What changed recently" is led by services that did not change |
| B18 | Medium | Reports | Photos can be uploaded but no one can ever view them |
| B19 | Medium | Server | One 2.5 MB photo upload used about 560 MB of memory |
| B20 | Medium | Under-13 mode | Feedback, voting and flagging still send data |
| B21 | Medium | Email alerts | Emails are collected but nothing sends an email |
| B22 | Medium | Tooling | `npm run check` fails at three steps |
| B23 | Medium | RTL | Several right-to-left issues, one confirmed |
| B24 | Low | Community | Vote counts freeze on posts you voted on |
| B25 | Low | Admin | One tap changes a public service status, no confirmation |
| B26 | Low | Admin | Feedback is stored but there is no screen to read it |
| B27 | Low | Offline | "Try again" hides the offline banner but screens keep the bundled copy |
| B28 | Low (not run) | Map | Map area can be squeezed or clipped on short screens |
| B29 | Low | Reports | A bad `?service=` link produces a report that can never be sent |
| B30 | Low | Server | Vote and flag are check-then-insert; a double request returns 502 in Supabase mode |
| B31 | Low | Server | A Supabase start-up failure silently falls back to local mode |
| B32 | Low | Scraper | `upload_to_supabase.py` cannot insert a row |
| B33 | Low | Docs | README and code comments point at files that do not exist |
| B34 | Low | Various | Smaller items |

---

## High

### B1. Basic-mode chat answers "Which services were cut?" with Abode Services

- **Where:** `backend/grounding.py:257-262` (the `named` match) and `:271` (`and not picked`).
- **Reproduced.** `local_answer("Which services were cut?", "en", None, None)` returns sources `['Abode Services']`. Same for "What services were cut?".
- **Why:** `named` picks any resource whose name contains a word of four or more letters that also appears in the question. "Abode **Services**" matches the word "services". Because something was picked, the block that lists reduced city services is skipped.
- **Why it matters:** basic mode is what runs with no `ANTHROPIC_API_KEY`, which is the documented default, and this is suggestion chip `chat.s1`. It is the first thing a judge will tap. The wrong answer is then shown with a "Sources: Abode Services" line, which makes it look grounded.
- **Related, same function:** "I was fired" returns the list of city cuts (the hint `fire` matches by prefix). "where is the police station" returns all six reductions.
- **Fix:** match resource names on the whole name or on distinctive words only (drop generic words such as "services", "center", "clinic", "bay", "area"), and do not let a name match suppress the service list when a `SERVICE_HINTS` word is present. Add a test that runs each locale's four suggestion chips and asserts a sensible source.

### B2. AI chat stops working after one long answer

- **Where:** `backend/schemas.py:92-94` (`ChatTurn.content` is 1 to 2,000 characters for both roles), `app/src/app/(tabs)/chat.tsx:57` (history is sent back unmodified), `backend/routers/chat.py:33` (`MAX_TOKENS = 16000`).
- **Reproduced** the server half: posting a history with a 2,001-character assistant turn returns `422 messages.1.content: String should have at most 2000 characters`.
- **Reproduce in the app:** set an API key, ask something that produces a long list (for example "list every resource with address, phone and hours"). Ask any follow-up. It fails with "The answer could not be loaded", and so does every later message until "Clear conversation".
- **Why:** the model may write up to 16,000 tokens, the app stores the whole answer, and the next request replays it as history. The 2,000-character cap was meant for what a person types.
- **Fix:** validate only user turns at 2,000; allow assistant turns up to a larger cap (or truncate them server-side instead of rejecting). Also lower `MAX_TOKENS` to about 1,000, which matches "keep answers short" and limits cost.

### B3. Dari, Chinese and Vietnamese are 92% untranslated

- **Where:** `app/src/locales/fa.json`, `zh.json`, `vi.json` (125 lines each; `en.json` is 656). Fallback to English is `app/src/lib/i18n.ts:83`.
- **Reproduced.** Each of the three files has 97 of 568 keys, plus 53 stale keys that no screen uses. Whole sections are missing: `status`, `category`, `area`, `location`, `map`, `statusPage`, `consent`, `alerts`, `reps`, `budget`, `impact`, `settings`, `about`, `storage`, `legal` and more. Spanish is complete (568 of 568).
- **Effect:** choosing Dari flips the layout to right-to-left and translates the tab bar and a few Home strings, then shows English almost everywhere, including consent checkboxes and the storage banner. Consent text a person cannot read is not informed consent.
- **Chips are stale too.** `chat.s1` to `s3` in fa, zh and vi are older, different questions ("Where can my children go?"), and `s4` is missing so it shows in English. In basic mode, two of three Dari chips and two of three Vietnamese chips return "I don't know" (reproduced). The last recorded Playwright run failed on exactly this (`test-results/flows-language-switch-persist-and-Dari-is-right-to-left/error-context.md`).
- **Fix:** complete the three files, or ship English and Spanish only and say so. Do not list a language that is one-tenth done. Add `نماینده` and `nghị viên` to `COUNCIL_HINTS` (`grounding.py:201`).

### B4. Placeholder name, email and legal text are shown to users

- **Where:** `shared/constants.ts:18-23` (`creator: '[Your name]'`, `contactEmail: '[your-contact-email@example.com]'`, `repoUrl`).
- **Shown at:** footer of every screen, `app/src/components/Page.tsx:37` ("Made by [Your name] in Fremont, California."); About, `about.tsx:16-17`; Data deletion request, `data-request.tsx:39` and `:75` ("You can also email your request to [your-contact-email@example.com]"); Privacy Policy and Terms through `Legal.tsx:9` (`legal/content.ts:26`, `:90`, `:98`, `:118`, `:125`, `:192`); and `content.ts:188`, a literal "[Placeholder: these terms are intended to be governed by…]".
- **Why it matters:** the privacy policy tells people to email an address that does not exist to exercise their rights, and promises a reply within 30 days.
- **Fix:** fill in `PROJECT`. Add a rule to `check-claims.mjs` that fails on `[Your ` and `[Placeholder` so it cannot ship again.

### B5. Admin and Community Impact cannot be unlocked with default configuration

- **Where:** `backend/security.py:77-86`. With `ADMIN_TOKEN` empty and no Supabase, `require_admin` always raises 403. `app/src/components/AdminGate.tsx:30` then says "That passcode is not correct."
- **Reproduced.** `/admin/me` with any passcode returns 403; `/impact/summary` returns 403.
- **Effect:** in the zero-configuration mode the README describes, nobody can moderate. Every report stays "Waiting for review", the Community Impact dashboard is unreachable, posts held by the filter never appear, deletion requests and feedback are never seen.
- **Design issue behind it:** the Community Impact dashboard, the feature that turns reports into something a council member could read, is staff-only (`backend/routers/admin.py:122`, `app/src/app/(tabs)/impact.tsx:94`). The Terms say reports are "shown publicly only as totals", but no public screen shows those totals.
- **Fix:** make `/impact/summary` public (it already contains only verified aggregates), keep the CSV export admin-only. When `ADMIN_TOKEN` is unset, have `/config` say so and show "Admin is not set up on this server" instead of "wrong passcode".

### B6. Map tab on a standalone Android build (not run)

- **Where:** `app/app.json` has no `android.config.googleMaps.apiKey`; `app/src/components/ServiceMap.tsx:28` renders `react-native-maps` with the default provider, which is Google Maps on Android.
- **Expected behavior:** in Expo Go the map works because Expo Go carries its own key. In a development or release build, Google Maps without a key either throws "API key not found" when the map view is created or draws a blank grey map. I did not build for Android, so treat this as a strong warning, not a confirmed crash.
- **Fix:** add a restricted Maps SDK key through app config, or test the release build on a device before the demo and fall back to the list view on Android if no key is set.

---

## Medium

### B7. Every answer is generated twice where streaming is unavailable

- **Where:** `app/src/lib/api.ts:152` and `:163-168`.
- **Read.** `sendChat` always calls `POST /chat/stream` first. Only after the response arrives does it check `response.body?.getReader`. Where that is missing it throws the finished stream away and calls `POST /chat`, which generates a second, different answer.
- **Effect:** double latency, double model cost, and each question uses two of the 12 requests per minute. Whether React Native's `fetch` exposes a body stream on this Expo SDK needs checking on a device; if it does not, this affects every phone.
- **Fix:** read the SSE text from the first response when there is no reader (`await response.text()` and parse it), or decide by platform before sending.

### B8. A reload during "Writing an answer" corrupts the saved conversation

- **Where:** `app/src/app/(tabs)/chat.tsx:49` saves an assistant message with `content: ''` before the request starts; `app/src/state/stores.ts:114` persists it when optional storage is accepted.
- **Reproduced** the server half: an empty assistant turn returns `422 … at least 1 character`.
- **Reproduce:** web, "Accept all" on the storage banner, send a question, reload the tab before the first text arrives. The saved history now ends with an empty assistant turn. It renders as "Writing an answer" forever, and every later question fails with 422.
- **Fix:** do not persist the placeholder (keep "pending" in component state), and filter empty turns out of the payload.

### B9. No timeout on the streaming chat request

- **Where:** `app/src/lib/api.ts:152`. `request()` has a 10-second abort, `sendChat` has none.
- **Effect:** if the server accepts the connection and stalls, the screen shows "Writing an answer" until the person presses Stop.
- **Fix:** abort after about 20 seconds without a byte.

### B10. "Impact reports received" counts unreviewed and rejected reports

- **Where:** `backend/routers/public.py:109` (`reports_total = store.count("reports")`), shown at `app/src/app/(tabs)/index.tsx:76`.
- **Reproduced.** The count went from 0 to 1 the moment a report was created with status `pending`.
- **Conflicts with:** `en.json:296` ("A moderator will review it before it is counted"), `legal/content.ts:164` ("count only after review") and `content.ts:158`.
- **Effect:** anyone can inflate the number on the home screen. See SECURITY.md S1 for why the rate limit does not stop that.
- **Fix:** show `reports_verified`, or label the tile "received, not yet reviewed".

### B11. Sign-in does not complete

- **Where:** `app/src/app/(tabs)/sign-in.tsx:26-33` (the only auth listener lives in this screen), `:40` (`emailRedirectTo` is `undefined` on phones), `app/src/lib/supabase.ts:15` (`persistSession: false`).
- **Read; needs a Supabase project to run.**
- **Phones:** the emailed link opens the Supabase site URL in a browser. Nothing brings the session back into the app, so sign-in cannot finish.
- **Web:** the link opens a new tab at `/`. The session exists only in that tab's memory, and the app does not learn about it until the person navigates to More, Settings, Sign in, which is where the listener is registered. The tab they started in never signs in.
- **Fix:** register `onAuthStateChange` once in the root layout. On phones, pass a deep link (`resource://sign-in`) and handle it, or hide sign-in on phones.

### B12. Signing in changes who you are, so deletion misses earlier data

- **Where:** `backend/security.py:61-67`. `owner_from` uses the account when a bearer token is present and the install token otherwise. `backend/routers/account.py:127-143` deletes by that one owner.
- **Read.**
- **Reproduce:** post a tip without an account, sign in, open Settings, "Delete my data". The receipt counts only account-owned rows. The earlier post stays public, no longer shows "Your post", and cannot be deleted until you sign out.
- **Fix:** on export and delete, act on both hashes when both a bearer token and an install token are sent; or migrate install-token rows to the account at first sign-in.

### B13. "Notify me on this device" does not do what it says

- **Where:** `app/src/app/(tabs)/alerts.tsx:81-87`. The check runs inside the Alerts screen's effect.
- **Read.** A notification is posted only when the Alerts screen is mounted and has just fetched, which is when the person is already looking at the list. There is no background fetch and no push token. `en.json:328` says "The app posts a notification when it finds a new matching update."
- **Second problem:** turning the switch on makes every existing alert "not yet announced", so the phone immediately notifies about the newest alert, which is months old.
- **Fix:** seed `notified` with the current alert ids when notifications are switched on. Describe the feature honestly ("when you open the app") or add a real push or background task.

### B14. Two alert notices state things that did not happen

- **Where:** `alerts.tsx:99-101`: on a failed save the notice is `alerts.savedOffline`, "…it will sync next time" (`en.json:325`). There is no retry or sync code anywhere.
- **Where:** `alerts.tsx:105-109`: `unsubscribe()` shows "Your choices were removed from our server" (`en.json:326`) before the request is sent, and swallows the error if it fails.
- **Fix:** queue and retry, or change the copy. Show the "removed" message only after the delete succeeds.

### B15. GPS label names the wrong neighborhood in central Fremont

- **Where:** `app/src/components/LocationChip.tsx:20-26`. The label is the ZIP whose centroid is nearest, not the ZIP that contains the point.
- **Worked example:** City Hall (37.5518, -121.9826) is in 94538. It is 1.3 miles from the 94536 centroid and 3.8 miles from the 94538 centroid, because the 94538 area stretches south into the industrial district. Someone at City Hall, Fremont BART or the Hub is told "your location, near Centerville & Niles".
- **Also:** a GPS location has no `area` (`LocationChip.tsx:53`), so the "Add my area" link on Alerts (`alerts.tsx:153`) and the default area on Report and Community only work for people who typed a ZIP.
- **Fix:** use ZIP boundary polygons, or drop the neighborhood name for GPS and say "your location".

### B16. "Find Alternative" silently does nothing the second time

- **Where:** `app/src/app/(tabs)/resources.tsx:85-89`. Filters are applied only when the `categories` route parameter changes.
- **Read.** Reproduce: Map, Human Services, "Find Alternative" (five categories are selected). Tap the "All" chip. Go back to the map and tap "Find Alternative" on the same service. The parameter is identical, so no categories are selected, and the list shows everything under an "Alternatives for: Human Services safety-net programs" banner.
- **Also:** tapping "All" (`resources.tsx:132`) clears the chips but leaves that banner in place.
- **Fix:** add a changing value to the link (a timestamp parameter), or apply filters in a focus effect. Clear `from` when filters are cleared by hand.

### B17. "What changed recently" lists services that did not change

- **Where:** `app/src/app/(tabs)/status.tsx:30` sorts by `updated_at`. In `shared/data/services.json` the three open services with "We found no budget-related change" have `updated_at: "2026-10-12"` (lines 250, 279, 308), the day the data was checked.
- **Effect:** the top three cards under "What changed recently" are the two Age Well Centers and Youth and Family Services, all open and unchanged. The actual changes (February and March 2026) are pushed down or off the five-item list.
- **Fix:** sort by `effective_date`, or list only services whose status is not `open`. Keep "checked on" separate from "changed on".

### B18. Report photos are write-only

- **Where:** `backend/routers/contribute.py:69-102` stores the photo. No route returns one. `_report_view` in `backend/routers/admin.py:29-30` exposes only `has_photo`, and `app/src/app/(tabs)/admin.tsx:49` shows the words "has a photo".
- **Reproduced:** the admin report payload has no photo field or URL.
- **Effect:** residents are asked for photos, moderators verify reports without seeing them, and the photos are kept indefinitely for no purpose. That is the opposite of the data-minimization goal stated in `schema.sql:5-9`.
- **Fix:** add an admin-only route that returns a short-lived signed URL, or remove the photo feature.

### B19. One photo upload can exhaust server memory

- **Where:** `backend/routers/contribute.py:81-93`.
- **Reproduced.** A 9,400 by 9,400 pixel PNG of one color is 2.5 MB, passes the 5 MB check, and raised the process's peak memory by about 560 MB while Pillow decoded and converted it. A free-tier container with 512 MB would be killed by a single request.
- **Also:** the handler is `async def` and does the decode on the event loop, so the whole API stalls while it runs. The 5 MB limit is applied after the framework has already received and spooled the entire body.
- **Fix:** check `image.size` right after `Image.open` and reject above about 25 megapixels; set `Image.MAX_IMAGE_PIXELS`; make the handler a plain `def` so it runs in the thread pool; set a request-size limit at the proxy.

### B20. Under-13 "browse-only" mode still sends data

- **Where:** the feedback form in `app/src/app/(tabs)/settings.tsx:120-128` is not gated by `ageStore`. In `app/src/app/(tabs)/community.tsx:113-125` and `:137`, the vote and "Report abuse" controls are not gated either.
- **Conflicts with:** `en.json:310` ("this app will not collect anything from you"), `legal/content.ts:21` and `:96`.
- **Read.** A person who tapped "I am under 13" can still send free text to `/feedback` and create vote and flag rows tied to their install-token hash.
- **Fix:** gate those three controls on `age === 'under13'`, the same way the post form is gated.

### B21. Email alerts collect addresses and never send anything

- **Where:** `backend/routers/account.py:62-78` stores the address. A search of `backend/` for `smtplib`, `sendmail` or any mail client finds nothing; the SMTP settings in `backend/settings.py:47-51` are only used to compute `email_enabled`.
- **Effect:** hidden by default. If someone sets `SMTP_HOST`, `EMAIL_FROM` and `PUBLIC_API_URL`, the form appears, says "You are signed up for email alerts. Every email has an unsubscribe link" (`en.json:339`), stores the address, and no email is ever sent.
- **Fix:** remove the form and endpoints until there is a sender, or build the sender.

### B22. The project's own gate, `npm run check`, fails

- **Where:** `app/package.json:63`.
- **Reproduced**, three independent failures:
  1. `check:i18n` exits 1 (B3).
  2. `check:claims` exits 1: `app/src/locales/en.json:467` contains "Verified resident reports", which trips the rule `/\bverified resident/i` in `scripts/check-claims.mjs`. Reword to "Resident reports that a moderator verified".
  3. `npm test` runs `jest`, which has no configuration and no unit tests, so it picks up the four Playwright files in `e2e/` and fails to parse them. There are zero unit tests for the app.
- **Fix:** add a `jest` section with `preset: "jest-expo"` and `testPathIgnorePatterns: ["/e2e/"]` plus at least a few tests for `lookupZip`, `formatDate`, `sortByDistance`; or drop jest from `check`.

### B23. Right-to-left layout

Confirmed:

- **Dates switch calendar and digits.** `app/src/lib/i18n.ts:30` gives Dari the locale `fa-AF`, and `formatDate` (`i18n.ts:113-123`) passes it to `Intl.DateTimeFormat`. March 30, 2026 renders as "۱۰ حمل ۱۴۰۵" (Solar Hijri, Persian digits). The surrounding text is English and says "March 30, 2026 letter", and money stays in Western digits (`i18n.ts:125`). A reader sees two calendars for one event. Pick one: keep Gregorian with `fa-AF-u-ca-gregory-nu-latn`, or show both.
- **Almost all Dari text is English** (B3), so most screens are English sentences in a mirrored layout.

Read, not run on a device:

- `app/src/components/ui.tsx:82` relies on `writingDirection`, which React Native documents as iOS-only. The app never calls `I18nManager.forceRTL`. On Android, mirroring depends entirely on the `direction` style at `_layout.tsx:105`; text alignment of Dari paragraphs needs checking on a real Android device.
- `app/src/components/Charts.tsx:148`: numeric table cells use `textAlign: 'right'`, a physical side. In RTL the number columns sit on the left and align toward the label column. Use `'end'`-style logic through `isRTL`.
- `app/src/theme.ts:51-67`: weight is chosen by Inter family name (`Inter_700Bold`). Inter has no Arabic-script or Chinese glyphs, so Dari and Chinese fall back to a system font at normal weight. Headings and body text then look the same weight. Add `fontWeight` alongside `fontFamily`.
- `app/src/app/(tabs)/reptracker.tsx:94` and `:80`: `term_ends` ("November 2028") and election seats ("District 2") come straight from data in English inside translated sentences.
- The budget, service summaries, alerts and resource descriptions are English in every language (acknowledged for the budget at `en.json:441`, not for the rest).

---

## Low

### B24. Vote counts freeze on posts you voted on
`app/src/app/(tabs)/community.tsx:31`, `:35`, `:61`. The `local` override is never cleared, and the screen stays mounted in the tab navigator. After you vote on a post, later reloads still show the count from the moment you voted. Clear `local` when new data arrives.

### B25. One tap changes a public status
`app/src/app/(tabs)/admin.tsx:104` calls `updateServiceStatus` directly from a chip. There is no confirmation and no undo, the change is public at once, `updated_at` becomes today (`backend/routers/admin.py:73`) so it jumps to the top of "What changed recently", and the City source link stays attached to a status the City never published. See DATA_TRUTH.md.

### B26. Feedback has no reader
`GET /admin/feedback` exists (`backend/routers/admin.py:99-101`) but the admin screen has four tabs and none of them shows feedback. "Wrong information" reports from residents go nowhere visible.

### B27. Offline banner "Try again"
`app/src/app/_layout.tsx:75` calls `getConfig`, which clears the banner when the API answers. Screens that already fell back keep showing the bundled copy until they are refocused after 30 seconds (`app/src/hooks/useData.ts:57`). Trigger a reload of mounted screens when `offlineStore` goes from true to false.

### B28. Map on short screens (not run)
`app/src/app/(tabs)/map.tsx:141-158` is a non-scrolling column: search, filter chips, view switch, location chip, count, then a map with `minHeight: 260` (`:200`) and a note. On a 568-point-tall phone, or at the "Larger" text size, the controls take roughly half the space and the map plus note may overflow under the tab bar. Check at 320 by 568 and at text scale 1.3.

### B29. Bad `?service=` link on Report
`app/src/app/(tabs)/report.tsx:53-56` accepts any id. With an unknown id no radio is selected, `serviceError` (`:59`) is null, and on submit `service_name` is the empty string (`:99-100`), which the server rejects. The person sees "could not be sent… try again" and it can never succeed. Validate the parameter against the loaded list.

### B30. Vote and flag are not atomic
`backend/routers/contribute.py:147-151` and `:165-166` count, then insert. Two simultaneous requests both insert. In Supabase mode the unique constraint (`schema.sql:110`, `:118`) turns the second into a `StoreError`, which the app shows as a generic failure. Use an upsert with "on conflict do nothing".

### B31. Silent fallback to local mode
`backend/store.py:243-246`. If the Supabase client cannot be created, the API logs the exception and serves bundled data, writing reports to local disk. In production that looks healthy while losing data on the next deploy. Fail start-up when `SUPABASE_URL` is set but unusable.

### B32. Scraper upload cannot insert
`scraper/upload_to_supabase.py:79` inserts records with no `id`, but `services.id` is a text primary key with no default (`backend/database/schema.sql:14`). Every insert fails. The comment at `:64` ("only unique key is its generated id") and `parse_budget.py:57` ("only accepts these five values") describe an older schema. The script would also write unreviewed parser output, pinned to City Hall coordinates (`parse_budget.py:225-227`), straight into the public table. The README says the parser currently finds no itemised cuts, so today this pipeline produces nothing; the data in the app was entered by hand.

### B33. Documentation that points nowhere
- `README.md:3` says the service changes, alerts and votes "are illustrative and are not official". The app now says they are sourced. One of the two is wrong, and a judge reads the README first.
- `README.md:42` says chat uses "sample files in `backend/data/`" (no such folder) and `:43` says the route returns 503 without a key (it returns a basic answer).
- `README.md:47-51` describes a "flag button", `app/locales/` and "Translated so far: the tab bar, screen titles, Home, and AI Chat".
- Referenced and missing: `deployment/ENV.md`, `docs/SECURITY.md`, `docs/DECISIONS.md`, `docs/HUMAN_TODO.md`, `docs/I18N_REVIEW.md`, `docs/LICENSES.md`, `docs/CLAIMS_AUDIT.md`, and a docker compose file (`.env.example:9`).
- `en.json:654` says the code "is released under the MIT License". There is no LICENSE file.

### B34. Smaller items
- **Chat shows raw markdown and a duplicate source line.** `chat.tsx:157` renders plain text, and rule 4 in `grounding.py:39-40` makes the model end with "Sources: …", which then appears above the app's own "Sources" row. Tell the model not to use markdown and strip the final line.
- **Install token race.** `app/src/state/stores.ts:133-139`: several first requests start together on a fresh install, each generates a different token, and the last write wins. The first few read requests carry tokens that are never used again. Harmless today; memoize the promise.
- **"Clear data on this device" keeps the language** until restart: `languageStore` is not in the reset list at `stores.ts:157`.
- **"I am under 13" has no undo** short of "Clear data on this device" (`ConsentFields.tsx:76`). A mis-tap locks every form.
- **Status tiles are filters with no pressed state** (`status.tsx:47`); the list they filter is several screens further down.
- **Photo size is not checked on web** when `asset.fileSize` is missing (`report.tsx:77`); the server rejects it and "Try again" repeats the same failure with no reason shown.
- **`hi` and `pa` are accepted by the API** (`backend/schemas.py:12`) but have no translated strings; replies fall back to English text.
- **Admin gate maps every failure to "wrong passcode"**, including 429 and 500 (`AdminGate.tsx:30`).
- **"Map data © OpenStreetMap contributors"** (`en.json:220`) is shown on phones, where the map is Apple or Google.
- **Supabase list calls have no paging** (`backend/store.py:179-186`); the default cap is 1,000 rows, after which counts and the impact summary are silently short.
- **The prompt-cache comment is wrong when a location is shared** (`backend/grounding.py:170-171`): distances and ordering change with the rounded position, so the "unchanged" block differs per location.
