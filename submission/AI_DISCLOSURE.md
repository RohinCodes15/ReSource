# AI-assistance disclosure

A draft for the submission. The contest rules require full disclosure of AI use (see `RULES_CHECKLIST.md`; confirm the exact 2026 wording). Everything in the first two sections is true of this repository. **The third section is yours to write.** Do not submit this page until it describes your part accurately.

## AI used to build ReSource

- **Coding agents.** Most of the code in this repository was written by two AI coding agents working from my instructions: Claude Code (Anthropic) and Codex (OpenAI). That includes the app screens, the API, the tests, the build checks and the deployment files. Commits made with Claude Code carry a `Co-Authored-By` line.
- **Review.** AI agents also reviewed the project and wrote the bug, security, data and judging reports in `review/`. The fixes that followed were written by the same tools.
- **Translations.** The Spanish, Dari, Chinese and Vietnamese text was written by an AI model. It has not been reviewed by native speakers, and the app says so.
- **Documents.** The files in `docs/`, `deployment/` and `submission/`, including drafts of the answers on the submission form and the demo script, were drafted by an AI model and edited by me.
- **Graphics.** The app icon was drawn by a script an AI agent wrote. No AI image generator was used.

## AI used inside the app

- The "Ask ReSource" chat uses Claude Sonnet 5, a general-purpose model from Anthropic. It answers from its own knowledge, not from the app's sourced data, so its answers can be wrong. It is told to flag Fremont-specific facts and point people to the app's sourced Budget and Resources tabs, and the chat screen says AI answers can be wrong.
- With no API key, when the Claude call fails, or when the daily token budget is spent, chat uses a keyword lookup of the app's data with no AI model. The app labels each answer "Claude AI" or "Basic search".
- No AI is used to decide what the budget data says. Every figure was read from a City of Fremont document and entered with its source.

## What I did myself

Write this section in your own words. Judges will ask, and the rules expect you to explain your own contributions and how the code works. Be specific and do not overstate. Things to cover, where they are true:

- The idea, and why Fremont and why now.
- The decisions you made: what to build first, what to leave out, the rules about sources and about not showing unverified council votes, the choice to need no account.
- The documents you read and the data you checked against them.
- What you tested by hand, what you found, and what you sent back to be fixed.
- Any code, configuration or text you wrote or changed yourself, with file names.
- What you learned, and which parts of the code you can explain line by line and which you cannot yet.

If, after writing this, most of the technical work was the tools' and not yours, read the note on the AI rule in `RULES_CHECKLIST.md` and ask your Member's office about eligibility before submitting.
