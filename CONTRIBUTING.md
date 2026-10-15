# Contributing to ReSource

Thank you for wanting to help. ReSource is a student project about Fremont's city budget, and what makes it worth using is that people can check what it says. Most of the rules below protect that.

## Before you start

- Read `docs/DECISIONS.md`. It explains choices that may look odd, such as not showing council votes.
- For anything larger than a typo, open an issue first and say what you plan to change.
- Security problems: email rohincodes15@gmail.com instead of opening a public issue.

## Running it

See `README.md`. In short: start the API from `backend/` with `uvicorn main:app --port 8000`, then the app from `app/` with `npx expo start`. No accounts or keys are needed.

## Rules for content

1. **Every fact needs a source.** A row in `shared/data/` must have the address of the public document or page it came from and the date you read it. If you cannot cite it, it does not go in.
2. **Do not fill gaps.** If the City has not published an amount, a date or a vote, leave the field empty. The app is built to say "not published".
3. **Label sample content.** Anything written for the project and not from a real source is marked as sample in the data and on screen.
4. **No claims the project cannot support.** `npm run check:claims` blocks words like "official", "live data" and user counts. If it stops you, reword; there is no way to switch it off for one line.
5. **No text inside screens.** Add the string to `app/src/locales/en.json` and to the other four languages. Say in your pull request if a translation is machine-written.
6. **No tracking.** No analytics, advertising or crash-reporting packages. All device storage goes through `app/src/lib/storage.ts`.
7. **No secrets.** Never commit a `.env` file or a key.

## Rules for code

- Match the code around you: its naming, its comment style, its level of abstraction.
- Every control needs an accessible name, and touch targets are at least 44 points.
- Add or update a test for what you change. End-to-end tests are in `app/e2e/`, unit tests in `app/src/__tests__/`, API tests in `backend/tests/`.
- Before opening a pull request, run:

```sh
cd app && npm run check && npm run build:web && npm run e2e
cd ../backend && python -m pytest
```

## Pull requests

- One change per pull request, with a description of what changed and how you tested it.
- If you used an AI tool to write the change, say so.
- Screenshots for anything visible.

## Corrections from the public

If you work for an organization listed in the app and something is wrong, you do not need to use GitHub. Email rohincodes15@gmail.com or use "Report a problem" in the app's Settings.

By contributing you agree that your contribution is released under the MIT License in `LICENSE`.
