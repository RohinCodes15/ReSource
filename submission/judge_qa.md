# Judge questions and honest answers

Twenty questions a judge might ask, with answers drawn from the code. File names are given so you can read the code behind each one before the interview. If you are asked something you do not know, say so; that is a good answer.

## The idea

**1. What problem does this solve, in one sentence?**
Fremont's budget cuts are public but buried in long documents, so ReSource shows a resident which changes touch them, where to get help instead, and how to tell the City about it.

**2. Who is it for, and how do you know they need it?**
Fremont residents, especially families, older adults and people more comfortable in Spanish, Dari, Chinese or Vietnamese. Honest answer on evidence: the need is argued from the City's own documents (`problem_statement.md`), not yet from residents. The app has not launched and no user research has been done. `impact_plan.md` has the survey to fix that.

**3. What makes it different from the City's website?**
Three things: it starts from the resident (area and interests) instead of from the budget's structure; every change points to a place that can help; and it gives residents a structured way to report impact. It does not replace the City's site. It links to it on every item.

**4. Is the information accurate? How would I check?**
Every figure links to the document it was read from, with the date it was read (`docs/DATA_SOURCES.md`). It was entered by hand on October 12, 2026 and is only as current as that. The app says where the City has not published something, and it does not show how council members voted because the minutes were not read.

**5. Does the City endorse this?**
No. It is an independent student project and says so on Home and at the bottom of every screen. The City has not reviewed it.

## The technology

**6. What is it built with, and why?**
TypeScript with React Native and Expo, so one codebase runs on the web, iOS and Android. A Python FastAPI service sits between the app and a Supabase Postgres database, so the app never holds a key that can write to the database, and validation, rate limits and scrubbing happen in one place.

**7. How does it work with no accounts?**
The first time a device sends something, the app creates a random token and keeps it on the device (`getInstallToken` in `app/src/state/stores.ts`). It is sent as the `X-Client-Token` header. That is what lets a person see and delete their own reports later without the app knowing who they are.

**8. Why an HMAC and not a plain hash of that token?**
The server stores `HMAC-SHA256(secret, token)`, not the token (`_hmac` in `backend/security.py`). With a plain SHA-256, anyone who obtained a copy of the database and a list of candidate tokens could hash the candidates and match them to rows, and the same token would hash to the same value on every server. An HMAC mixes in a secret key that only the server has, so the database alone cannot be used to link rows to a device, and each deployment produces different values. The trade-off: if that secret is lost or changed, everyone loses the link to their own data, which is why `OWNER_HASH_SALT` must be set once and kept.

**9. How does the chat avoid making things up?**
Honestly, the primary path does not avoid making things up the way the earlier grounded version tried to. Claude Sonnet 5 is a general-purpose model, so its answers—including Fremont-specific answers—can be wrong and are not guaranteed to match the civic dataset. A visible disclaimer says AI answers can be wrong. Residents should check Fremont facts against the app's own sourced Budget and Resources tabs. The system prompt also asks Claude to flag local civic facts and direct residents to those sources. The server replaces an unverified Fremont phone number or street address with basic search (`backend/answer_validation.py`), but that does not verify every claim in the answer.

**10. How does the basic-mode matcher work?**
It is `local_answer` in `backend/grounding.py`, used whenever Claude is unavailable (see question 12). It lower-cases the question and then:
1. checks for emergency words and, if found, leads with 911 and 988;
2. finds resource categories whose keyword list matches (for example "food", "comida", "食物", "غذا", "thực phẩm" all mean Food) and takes up to four resources from them;
3. adds any resource whose name contains a distinctive whole word from the question, ignoring generic words like "services" or "center";
4. if the question is about a department (police, fire, streets, parks) or about cuts in general, lists the reduced services;
5. if it mentions the council or mayor, lists the council contacts;
6. if nothing matched, offers 211 for a general "help" question, or says it does not know.
Latin-script keywords must start a word, so "eat" does not match "weather"; other scripts use plain containment because they have no spaces.

**11. What went wrong with that matcher?**
The first suggested question, "Which services were cut?", answered with a housing nonprofit called Abode Services, because the matcher treated "services" as part of a name. And "I was fired" listed fire department cuts. The fix was whole-word matching, a list of generic words to ignore, and a test that runs every suggested question in every language (`backend/tests/`). This B1 fix applies to `local_answer`, the keyword matcher now used for fallback, not to Claude's primary path.

**12. What is "fallback mode"? What happens when things fail?**
Three separate fallbacks:
- **Basic-search fallback:** chat uses the keyword lookup above and labels the answer "Basic search" if there is no `ANTHROPIC_API_KEY`, the Claude call fails or times out, the daily token budget is spent, or a Fremont-specific Claude answer contains a phone number or street address the app cannot verify. Otherwise, Claude Sonnet 5 gives general-purpose answers labeled "Claude AI". Basic search uses the app's own rows and is limited to the topics its keyword matcher recognizes.
- **No database:** with no Supabase settings the API runs in local mode, serving the bundled data and keeping submissions in a local folder. If Supabase is configured but broken, the API refuses to start instead of silently switching, because that would lose data.
- **No connection:** the app carries a copy of the data. Screens show that copy with a banner, and reload when the connection returns (`app/src/hooks/useData.ts`). Things that need the server, like sending a report, say so and can be retried.

**13. What does row-level security protect, if the API uses the service-role key?**
Nothing about requests that go through the API: the service-role key bypasses RLS, so those depend on the API's own checks. RLS protects against the other key. The app contains Supabase's public "anon" key (for sign-in), and anyone can extract it. With RLS on (`backend/database/rls_policies.sql`), that key can read only the public catalog and approved posts without their owner id. Reports, votes, subscriptions, consent records and photos are closed to it. Honest gap: those policies were read, not tested by a script.

**14. How do you stop spam or one person faking many reports?**
Rate limits per network and per device on every route that writes (`rate_limit` in `backend/security.py`), a daily cap on chat requests and on Claude tokens for everyone together, a honeypot field, and reports count publicly only after a moderator verifies them. Votes and flags need distinct devices and distinct networks. Honest limits: the counters live in one server's memory, so they reset on restart and need one worker; and a determined person with many networks could still get through. Moderation is the real backstop.

**15. What personal data do you hold?**
No names, no precise location, no device id. Report and post text with emails, phone numbers and addresses removed; a ZIP area; a keyed hash of the device token. An email address only if someone files a deletion request, erased when the request is closed. `docs/PRIVACY.md` lists every table. Anyone can download or delete their data in Settings with one tap.

**16. How do you handle children?**
Every form asks the person to confirm they are 13 or older. Choosing "I am under 13" puts the app in browse-only mode: every form is replaced by a notice and nothing is sent. Honest limit: this is a self-declared age and the wording should be reviewed by an adult who knows COPPA; that is on the to-do list.

**17. How accessible is it?**
An automated scan (axe-core) runs on all 22 screens in the test suite with no serious violations; keyboard use, focus handling, 200% text and color contrast are tested; Lighthouse accessibility is 100. Honest limits: nobody has gone through it with a screen reader, the phone apps were not audited, and load time on a slow phone scores 69 to 80 depending on the screen (`docs/ACCESSIBILITY.md`).

## The work

**18. What part did AI play?**
A large one, and it is disclosed. Most of the code, tests, translations and documents were written by AI coding agents (Claude Code and Codex) from my instructions. Answer the rest of this question yourself, using what you wrote in `AI_DISCLOSURE.md`: what you decided, what you checked, what you changed, and what you can explain.

**19. What does not work yet?**
- Translations are unreviewed by native speakers.
- Email alerts are switched off; nothing sends email.
- Sign-in is web only and has never been run against a real project.
- The Android map needs a Google key; without it Android shows a list.
- Nothing has been deployed or used by a real resident.
- Several security findings are still open (`docs/SECURITY.md`).
- The data is a snapshot from October 12, 2026.

**20. What would you do next?**
Get the translations reviewed; put it in front of ten residents and two service organizations and change it based on what they say (`impact_plan.md`); ask the City for a machine-readable list of service changes so the data does not depend on one person reading PDFs; and read the council minutes so votes can be shown with confidence.
