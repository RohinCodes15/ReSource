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

**Location stays on the device.** Distances are worked out on the device. The one exception is chat, which sends a rounded position so the assistant can suggest nearby places; the policy says so.

**Strip personal details before saving.** Emails, phone numbers and street addresses are removed from descriptions and posts on the server, and photos are re-encoded so their embedded GPS position is dropped.

**Under 13 is browse-only.** Rather than collect a parent's consent, the app collects nothing from a child and shows everything read-only.

**Email alerts are switched off.** The sign-up form existed but nothing sent email. Collecting addresses for a feature that does not exist is worse than not offering it.

## The assistant

**Two modes.** With an API key, a model answers from the reference data only. Without one, a keyword lookup returns matching rows directly. The app labels which mode produced each answer. The second mode means the app works with no accounts and no cost, and still works if the AI service fails.

**The model sees only the app's data.** The system prompt contains the services, resources, budget and council data and tells the model to answer from nothing else, to say when it does not know, and to point to 211 or the City.

**Haiku by default, with output and daily limits.** The answers are short lookups. A small model keeps cost and abuse bounded.

## Engineering

**One codebase for web, iOS and Android (Expo).** One person can keep it working, and the web build needs no install, which matters for residents on older phones and for judges.

**A FastAPI service between the app and the database.** The app never holds a key that can write. Validation, rate limits and scrubbing happen in one place.

**Local mode with no accounts.** `uvicorn main:app` with no environment file serves the bundled data and keeps submissions in a local folder, so anyone can run and judge the project without signing up for anything.

**Checks that fail the build.** Translations in step, contrast, alt text, a single storage module, no unsupported claims. Each exists because the review in `review/` found that mistake once.

**Per-screen scripts and small web fonts.** The web build loads each screen when it is opened and uses 22 KB font files. Load time on a slow phone is still the weakest measurement (`docs/ACCESSIBILITY.md`).

**One color for magnitude in charts.** Bars are navy; the only multi-color chart is the impact breakdown, whose three levels are ordered, so it uses one hue from light to dark. Every bar carries its value as text and every chart has a table view.

## Decisions left for the creator

Listed in `docs/HUMAN_TODO.md`: the license, the governing-law sentence, the age-gate wording, whether to translate service names, and whether to add an undo for "I am under 13".
