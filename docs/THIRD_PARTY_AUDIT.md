# Third-party audit

Every outside service the app or the API can contact, what it receives, and whether it is needed. Checked against the code on October 13, 2026.

| Service | Contacted by | Receives | Needed? | Turned on by |
| --- | --- | --- | --- | --- |
| ReSource API | App | Requests, the install token, and what a person submits | Yes, for live data and anything that is sent. Without it the app shows the data bundled inside it. | `EXPO_PUBLIC_API_URL` |
| OpenStreetMap tile server | Web browser | IP address, map area viewed | Only for the web map. The list view works without it. | Opening the Map screen on the web |
| Apple Maps / Google Maps | Phone | IP address, map area viewed | Only for the phone map | Opening the Map screen on a phone |
| Anthropic | API server | Chat messages and language (no location since 2026-10-18) | No. Without a key, chat answers by basic search. | `ANTHROPIC_API_KEY` |
| Supabase (database, storage) | API server | Everything stored | No. Without it the API uses local files. | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase Auth | App | Email address | No. Sign-in is optional and off by default. | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Expo push service | Nobody | Nothing | Not used. Notifications are local to the device; no push token is requested. | |
| City of Fremont and organization websites | The person's browser, when they tap a source link | Whatever a normal visit sends | Links only. The app does not fetch these pages. | Tapping a link |
| The person's email app | Phone or browser | The letter draft | Only for "Write a letter". ReSource does not send, store or read the letter. | Tapping "Open in my email app" |

## What is not there

Checked by `npm run check:storage`, which fails the build if any of these packages is installed, and by reading `app/package.json`:

- No analytics (no Google Analytics, Firebase Analytics, Segment, Amplitude, PostHog, Mixpanel).
- No advertising SDK and no in-app purchases.
- No crash reporter (no Sentry, Bugsnag, Crashlytics).
- No fonts or scripts loaded from a CDN. Inter is bundled with the app.
- No social login and no embedded third-party widgets.

`e2e/compliance.spec.ts` records every network request the web build makes with optional storage rejected and fails if any goes to a host other than the API and, on the Map screen, the tile server.

## Terms to read before public launch

| Service | Why |
| --- | --- |
| OpenStreetMap tile usage policy | The public tile server is for light use. For real traffic, use a hosted tile provider and set `EXPO_PUBLIC_MAP_TILE_URL`. |
| Google Maps Platform | An Android build needs a key, and billing must be enabled on the Google Cloud project even within the free allowance. |
| Anthropic usage policies | The assistant is offered to the public; check the rules on age and on telling people they are talking to an AI (the app says so on the chat screen). |
| Supabase | Free projects pause after a period without activity. |

## Not verified

- What Apple's and Google's map SDKs send on a phone; this was not measured.
- The data-processing terms of each provider. An adult should read them before real residents use the app.
