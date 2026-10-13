# ReSource: how a judge would see it

Independent review, snapshot 2026-10-12 about 17:30 PDT. Written as a skeptical Congressional App Challenge judge who has ten minutes, reads the README, opens the web build with no API key and no admin passcode, and taps the obvious things.

## Scores

| Criterion | Score | In one line |
| --- | --- | --- |
| Civic impact | 6 / 10 | A real local problem and honest sourcing, but a thin dataset and a feedback loop the public cannot see |
| Originality | 6 / 10 | A thoughtful combination; the refusal to guess at votes is distinctive; the parts themselves are familiar |
| Technical depth | 7 / 10 | A full, tested stack with unusual care for privacy; undermined by one rate-limit flaw and a failing quality gate |
| Polish | 4 / 10 | "Made by [Your name]" on every screen, three languages one-tenth done, the first chat suggestion answers wrongly |
| Accessibility | 6 / 10 | Among the best web accessibility work I would expect from a student; language access is the gap |
| Clarity of the pitch | 3 / 10 | There is no pitch yet: a stale README, screenshots, and no demo script or video |
| **Overall** | **5.5 / 10** | Strong foundation, not yet presentable |

This is a project whose engineering is ahead of its presentation. About two focused days of work would move it to the 7 to 8 range, because most of what holds it back is unfinished rather than badly conceived.

## What a judge sees in the first five minutes

1. Reads the README. First paragraph: the data is "illustrative and… not official". Notes that the app is a demo with made-up content.
2. Opens Home. Clean, calm, credible. An "independent student project" notice. Four numbers. Good first impression.
3. Scrolls to the footer: **"Made by [Your name] in Fremont, California."**
4. Taps "Ask ReSource", taps the first suggestion, "Which services were cut?" The answer is **Abode Services**, a homelessness nonprofit, with "Sources: Abode Services".
5. Switches to Dari to see the multilingual claim. The layout flips; almost every sentence is still English. Dates now read "۱۰ حمل ۱۴۰۵".
6. Opens Rep Tracker. Seven contact cards, and four Council actions each marked "Vote record not yet verified". Wonders what is being tracked.
7. Submits an impact report. "A moderator will review it." Opens Community Impact to see the result: **"Staff only. Enter the admin passcode."**
8. Opens Budget Transparency. This screen is strong: every number has a source and a page, charts have a table view. The judge's opinion recovers.

Five of the eight steps hit a visible defect. None of them is hard to fix. All of them are in the path any reviewer takes.

---

## Civic impact: 6

**For**

- The problem is real, local and current. Fremont did cut $3.8 million mid-year and about $3 million in maintenance, and residents do not read budget presentations.
- The pairing is the right one: "this was reduced" next to "here is where else to go". "Find Alternative" on a service is the best single idea in the app.
- Every figure carries a source and a page number, and the ones I could check were correct (DATA_TRUTH.md). That is rare in student civic projects, which usually show invented numbers.
- The letter-to-council draft opens in the resident's own email app and the app never sees it. That is a correct, respectful design.
- No account, no tracking, deletion on demand.

**Against**

- **The dataset is small and abstract.** Eleven city services, seven of them marked reduced, and most of those are budget lines ("Department operations: staffing, overtime, training and contract services"), not something a resident experiences. The City has not said which programs changed, and the app says so honestly, but the result is that the app cannot yet answer "what changed for me?".
- **Fourteen resources** for a city of 230,000: one food bank, no shelter intake, no rent help, no legal aid beyond immigration. A resident with a need would be better served by calling 211, which the app itself recommends.
- **The loop does not close.** Reports go to a queue that, by default, no one can open. The aggregated view that would give them civic weight is behind a staff passcode. No report has ever reached an official.
- **Language access is claimed more than delivered.** The substance (what was cut, alerts, resource descriptions) is English in all five languages, and three of the five are barely started.
- **No evidence of use.** No resident tested it, no organization reviewed its listing, no council office has seen it. Judges weigh this heavily, and it costs little to get.
- The data was entered by hand on one day. The scraper finds no itemized cuts (the README says so). After the November 3 election parts of it will be out of date with no process to refresh it.

## Originality: 6

**For**

- Budget transparency tools and resource finders both exist. Putting a reduction and its alternatives on the same card is a fresh framing.
- Showing "Vote record not yet verified" instead of guessing is an unusual and mature choice.
- The offline design, where every screen falls back to bundled, sourced data, is more than most entries attempt.
- The grounded assistant with a no-key basic mode is a sensible answer to "what if the AI is unavailable or unaffordable".

**Against**

- Map, chatbot, community board, alerts, admin panel: the feature list is the standard civic-app list. Breadth is standing in for one idea carried all the way through.
- "Rep Tracker" promises accountability and delivers a phone list.
- A judge will ask "what does this do that 211 and the City's own site do not?" The honest answer today is "puts cuts and alternatives side by side, in plain language". That is a good answer. The app should be built around it, and right now it is one button on a detail sheet.

## Technical depth: 7

**For**

- A complete stack: Expo app for web, iOS and Android; FastAPI; Postgres with row-level security; a scraper; shared types and data.
- Two interchangeable data stores, so the whole thing runs with zero accounts and switches to Supabase by setting two variables.
- 41 backend tests pass. Type check and lint are clean. A script proves `seed.sql` matches the JSON.
- Privacy engineering beyond the usual: an HMAC of a random install token instead of any device id, consent records with a policy version, EXIF stripping by re-encoding, a storage module that is the only code allowed to touch device storage with a script to enforce it, export and deletion endpoints.
- Server-sent-event streaming with a withdraw-and-replace event, prompt caching, a refusal path.
- Custom checks for contrast, alt text, storage keys and unsupportable claims.

**Against**

- **The rate limiter can be bypassed by changing one header** (SECURITY.md S1). With an API key attached, that is an unlimited bill, and it also lets one visitor hide any post or inflate the public report count. A judge who tries it will find it in a minute.
- **The project's own gate fails**: `npm run check` stops at translations, at the claims check, and at jest, which has no tests and trips over the Playwright files.
- **Features that exist in code but do not work**: sign-in on phones, email alerts (no sender), photo review (no way to view a photo), notifications (only fire while you are already looking at the list), the scraper's upload (cannot insert a row).
- **Two chat defects**: the first suggested question answers wrongly without a key, and with a key the conversation dies after one long answer.
- **Android**: the native map has no Google Maps key configured. Not run in this review; likely blank or crashing outside Expo Go.

**A question the student should be ready for.** The About screen says AI coding tools helped build this. The code is uniformly polished in a way that suggests heavy assistance. Check the current contest rules on AI assistance and disclose in the submission itself, since the app says the disclosure is there and it is not. Judges score the student's own understanding, so be ready to explain, without notes: why an HMAC and not a plain hash; what row-level security protects against given that the API uses the service-role key; how the basic-mode matcher works and why it gave the wrong answer; and one bug you found and fixed yourself.

## Polish: 4

**For**

- Consistent visual system: one type scale, one spacing scale, one card style, restrained color.
- Loading skeletons, empty states, error states with retry, and an offline banner on every data screen.
- Thoughtful microcopy in English ("Nothing was lost: you can try again").
- Charts with exact values in text and a table view.

**Against**

- **"[Your name]"** in the footer of every screen, and **"[your-contact-email@example.com]"** in the privacy policy as the address for exercising legal rights. A literal "[Placeholder: …]" paragraph in the Terms.
- **Three languages are 8% translated** while listed as available.
- **The first suggested chat question gives a wrong answer.**
- **Two screens in the menu are locked** with "That passcode is not correct" when no passcode exists.
- **The README describes a different app**: illustrative data, a flag button, folders that are gone, a 503 that no longer happens. Seven documents are referenced that do not exist.
- "What changed recently" leads with three services that did not change.
- AI answers show raw markdown asterisks, and the sources appear twice.
- Light mode only.

Polish is where first impressions are made, and every item above is on the main path.

## Accessibility: 6

**For**, and this is real work:

- Contrast is defined as data and checked by script; all 22 pairs meet WCAG AA.
- Status is never color alone: icon plus word on badges, a glyph inside map pins.
- A skip link, a two-color focus ring, and off-screen tabs made `inert` so keyboard focus cannot wander into hidden screens.
- Reduced-motion respected in both CSS and animations.
- Labeled inputs with errors tied to fields, live regions for status messages, heading levels, real table roles.
- Every chart has a text summary and a table alternative.
- A list view as an alternative to the map, with keyboard-reachable pins on web.
- 44-point touch targets as a named constant. A text-size setting.
- Language names shown in their own language with `lang` attributes; no flags.
- Legal text marked as English for screen readers when the interface is not.
- Axe is wired into the Playwright suite.

**Against**

- **Language is an accessibility issue here, and it is the weakest part.** Fremont is one of the most linguistically diverse cities in the Bay Area. Three of five offered languages are barely present, consent text falls back to English, and the content is English throughout.
- Chinese is Simplified only, with no Traditional option. Hindi and Punjabi are accepted by the server and absent from the app.
- Tab-bar labels are 10 pixels with font scaling switched off (`(tabs)/_layout.tsx:63-65`), and ignore the text-size setting.
- The text-size setting tops out at 130%.
- Right-to-left on Android is unverified, and relies on a style property that is documented as iOS-only (BUGS.md B23).
- Dari dates switch to the Solar Hijri calendar while the sentence around them names the Gregorian date.
- Non-Latin headings probably lose their bold weight because weight is carried by the Inter family name.
- Status-count tiles act as filters with no pressed state.
- None of this was tested with a screen reader on a phone, as far as the repository shows.

## Clarity of the pitch: 3

There is no pitch in the repository. A judge's inputs today are:

- A README whose first paragraph says the content is illustrative, followed by setup commands.
- A `submission/` folder with screenshots and nothing else.
- An About screen with a good one-sentence purpose and a creator named "[Your name]".

What is missing:

- **The story.** Who is the resident, what happened to them, what did they do with ReSource? One named scenario beats a feature list.
- **The one-sentence claim.** The tagline is close: "See which Fremont city services changed with the budget, and where to find help." Lead with it everywhere.
- **Why you.** A Fremont student noticed something in their own city. That is the strongest part of any Congressional App Challenge entry and it appears nowhere.
- **Evidence.** One quote from a neighbor, a librarian, a food bank volunteer or a council aide.
- **A demo path.** Eleven destinations with no guidance means a judge wanders into the weakest ones.
- **Honest limits.** The app is good at saying what it does not know. The pitch should do the same: what is verified, what is not, what comes next.
- **The AI disclosure** the About screen says is in the submission materials.

---

## The five improvements with the most impact

### 1. Fix the first five minutes

Half a day. Nothing else matters if these remain.

- Fill in the name and contact email; remove the placeholder paragraph in the Terms.
- Fix the basic-mode answer to "Which services were cut?" and add a test that runs every suggestion chip in every language.
- Rewrite the README: what it is, who made it and why, what is verified, how to run it in one command, and a two-minute tour.
- Make `npm run check` pass, so the claim "every control works" is backed by a green run.
- Confirm the Vice Mayor's name.

### 2. Decide on languages, and translate the substance

One to two days.

- Either finish Dari, Chinese and Vietnamese or remove them from the picker. English plus complete Spanish is a stronger entry than five languages at 8%.
- Translate what matters: the seven reduction summaries, the six alerts, the fourteen resource descriptions. That is about thirty short paragraphs per language.
- Ask one native speaker per language to read it, and name them in the credits. This is also your evidence of community involvement.

### 3. Close the loop in public

One day. This is what turns the app from a reference into civic technology.

- Make the Community Impact summary public: verified reports by service, by area and by impact level. The endpoint already returns only aggregates.
- Ship a demo mode in which moderation works out of the box, so a judge can submit a report, verify it, and watch the public total change.
- Add a "share this summary with the Council" action that produces a one-page summary a resident can attach to the letter the app already drafts.
- Count only verified reports on Home.

### 4. Make the data deeper and provably checked

One to two days, mostly reading, not coding.

- Open the three City documents this review could not, and verify the 17 claims listed in DATA_TRUTH.md. Record who checked and when on each row, in place of a blanket `verified: true`.
- Read the minutes for the four Council actions and fill in how each member voted. Then "Rep Tracker" earns its name and becomes the app's most original screen.
- Triple the resource list using 211 and the Family Resource Center: shelter intake, rent help, utility help, legal aid, food sites by day of week.
- Tag citywide reductions as citywide, and give dated items an expiry so the election notice does not go stale on November 4.

### 5. Close the cheap abuse paths, then tell the story

One day for the fixes, one for the pitch.

- Rate-limit by IP as well as by token, add a global daily ceiling on chat, drop the output cap to about 1,000 tokens, and default to a smaller model.
- Hold community posts for review until a moderator is active. Cap image dimensions on upload.
- Then record a two-minute video: the problem in one sentence, one resident's path through the app (a cut, an alternative, a report, a letter), the sourcing and privacy choices in fifteen seconds, and what you learned. Put the AI-tools disclosure and a short list of known limits in the submission folder.

## If there is only one day

Do item 1 in full, remove the three unfinished languages from the picker, make the impact summary public, and record the video. That alone changes Polish from 4 to about 7 and Pitch from 3 to about 7.
