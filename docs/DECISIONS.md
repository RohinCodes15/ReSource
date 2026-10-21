# Decisions

The choices that shaped ReSource and the reasoning behind each, so that the creator can explain them and a later contributor does not undo them by accident.

## Product

**"What changed for me?" is the first thing on Home.** A resident's question is not "what is in the budget" but "does this touch my family". The screen filters the service data by what the person cares about and shows only rows that have a source. It never writes a new sentence about the budget.

**Say what is not known.** Where the City has published no amount or date, the app says the City has not published it. Where the documents show no change, it says the documents show no change, not that nothing changed. A civic app that guesses once loses the trust it depends on.

**No individual council votes.** News coverage reported some votes as unanimous, but the official minutes were not read. Showing a member's vote from a secondhand report could be wrong about a named person, so the app shows the decision, the source, and "Vote record not yet verified".

**No account.** Asking people in a budget crisis to register before they can find a food bank would turn many away. A random token on the device gives each person control of what they sent, including deleting it, without the app knowing who they are.

**Reports are counted only after review.** Anyone can file a report, so an unreviewed count would be easy to inflate and worthless to a council member. Only verified reports appear in public totals.

**Community and Impact live under More.** They matter after someone has found what they came for, not before.

## Data

**Entered by hand, with a source on every row.** The scraper in `scraper/` finds documents and guesses at cuts, but PDF extraction is unreliable and on the current documents it finds nothing itemised. A person read each document and entered each row with its address and date.

**The app carries a copy of the data.** If the API cannot be reached, every screen still shows sourced content, with a banner saying it is the saved copy.

**English for facts, the reader's language for everything around them.** Translating a City figure's label risks changing its meaning. The interface is translated; the facts are shown as written, with a note.

## Privacy and safety

**An HMAC, not a plain hash, for the install token.** A plain SHA-256 of a token can be recomputed by anyone who has the token, and a leaked table of plain hashes can be tested offline against guessed or stolen tokens. An HMAC needs a secret key that only the server holds. So a copy of the database alone cannot link a row to a device, and the same token gives different stored values on a different deployment.

**Row-level security even though the API bypasses it.** The API uses the service-role key, which skips RLS. RLS is there for the public anon key that ships inside the app for sign-in: with RLS on, that key can read only the public catalog and approved posts.

**Location stays on the device.** Distances are worked out on the device. The one exception is chat, which sends a rounded position to our server so basic search can sort nearby places; the policy says so. Since 2026-10-18 that position is not passed on to Anthropic.

**Strip personal details before saving.** Emails, phone numbers and street addresses are removed from descriptions and posts on the server, and photos are re-encoded so their embedded GPS position is dropped.

**Under 13 is browse-only.** Rather than collect a parent's consent, the app collects nothing from a child and shows everything read-only.

**Email alerts are switched off.** The sign-up form existed but nothing sent email. Collecting addresses for a feature that does not exist is worse than not offering it.

## The assistant

**Two modes: a general-purpose Claude assistant, with basic search as the fallback.** With an API key and a successful call, Claude (Claude Sonnet 5 by default, `CLAUDE_MODEL` to change it) answers questions using its general knowledge. Basic search takes over when there is no key, the API call fails, the daily token budget is spent, or a Fremont answer includes an unverified phone number or street address. The app labels each answer "Claude AI" or "Basic search". The fallback means chat still works without the AI service.

**Why the assistant is no longer limited to the app's data (changed 2026-10-18).** Until then the model saw only the services, resources, budget and council data and was told to answer from nothing else. That kept its Fremont facts tied to our sources, but it refused or said "I don't know" to most of what people actually typed, which made the chat feel broken. We chose more useful, general-purpose help and gave up the factual-accuracy guarantee against our civic dataset: Claude's primary answers are not constrained to or verified against that data, and can be wrong. The visible disclaimer now carries that weight: it says AI answers can be wrong and points residents to the sourced Budget and Resources tabs to check Fremont-specific facts. We also prompt Claude to flag local civic claims and replace an unverified phone number or street address with basic search (`answer_validation.py`); those checks reduce some risks, but do not guarantee the rest of an answer is right.

**Sonnet 5 by default, with output, request and token limits.** General questions produce longer and more varied answers than the old lookups, so cost is bounded three ways: at most 1,500 output tokens per answer, request limits per visitor and across everyone (`CHAT_GLOBAL_DAILY_LIMIT`), and a daily token budget across everyone (`CHAT_DAILY_TOKEN_BUDGET`, default 400,000 tokens, about $3 a day).

## Engineering

**One codebase for web, iOS and Android (Expo).** One person can keep it working, and the web build needs no install, which matters for residents on older phones and for judges.

**A FastAPI service between the app and the database.** The app never holds a key that can write. Validation, rate limits and scrubbing happen in one place.

**Local mode with no accounts.** `uvicorn main:app` with no environment file serves the bundled data and keeps submissions in a local folder, so anyone can run and judge the project without signing up for anything.

**Checks that fail the build.** Translations in step, contrast, alt text, a single storage module, no unsupported claims.

**Per-screen scripts and few, small web fonts.** The web build loads each screen when it is opened. It uses three font files of about 21 KB each, declared in `app/public/index.html` with `font-display: swap`, so the page never waits for them. Load time on a slow phone is still the weakest measurement (`docs/ACCESSIBILITY.md`).

**One color for magnitude in charts.** Bars are navy; the only multi-color chart is the impact breakdown, whose three levels are ordered, so it uses one hue from light to dark. Every bar carries its value as text and every chart has a table view.

## Design

**A civic ledger, not a dashboard.** The app is about public money, so it is set like a well-made public document: warm paper, ink, thin rules between sections, and large figures set in a serif (Fraunces) with plain Inter for everything else. Boxes are kept for things a person fills in. This replaced a column of identical white cards under a gradient header, which looked like every other template.

**The first thing on Home is a real figure.** The General Fund for FY 2026/27 ($289.1M of $427.1M across all funds) and where it goes, read from the City's presentation with its page cited. A resident sees what the budget is before being asked anything. The figure comes from the copy of the data bundled with the app, so it shows even before the server answers.

**No empty counts.** "0 impact reports verified" told a resident nothing and looked broken, so a count of zero, or one that cannot be known offline, is not shown at all.

**Gold means "do this".** Navy carries the app. Gold is kept for the one main action on a screen ("See my summary", "Follow these updates", "Send"), so it always points somewhere.

**Drawings of real Fremont places, drawn for the app.** Mission Peak, the NILES sign above Niles and Lake Elizabeth, as simple line drawings. Photographs would have needed per-image licenses and would weigh far more. Each drawing is its own small script, loaded only when shown.

**One icon set, drawn as SVG.** Lucide's line icons replaced Material Design Icons. They match the thin rules of the design, and storing the 142 icons used as drawing data removed a 1 MB icon font from the web download.

**A quieter map.** The map tiles are shown in warm greys so the pins carry the color, pins that sit close together on screen are grouped with a count, and a map image that fails to load is hidden with a note instead of leaving a blank or colored block.

## Decisions left for the creator

The license, the governing-law sentence, the age-gate wording, whether to translate service names, and whether to add an undo for "I am under 13".
