# Accessibility

What was checked, how, and what the results were. Measured on October 13, 2026 against the exported web build (`npm run build:web`), with the API running in local mode. The target is WCAG 2.1 level AA.

## Results

| Check | Tool | Result |
| --- | --- | --- |
| Automated rules on all 22 routes | axe-core 4 through Playwright (`e2e/compliance.spec.ts`), rule tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` | 0 serious or critical violations |
| Dialogs, and four routes in Dari (right-to-left) | same | 0 serious or critical violations; no sideways scroll |
| Screens that appear only after an action: the "What changed for me" summary, a chat answer, a form error, the map's list view | same | 0 serious or critical violations |
| Keyboard only | Playwright (`e2e/flows.spec.ts`, "keyboard") | Pass: see below |
| Text enlarged to 200% | Playwright | Pass: no content lost on the routes tested |
| Color contrast of the 22 text and background pairs in the theme | `npm run check:contrast` | All meet AA (4.5:1 for text) |
| Text alternatives for images | `npm run check:alt` | 2 image elements, both labeled |
| Lighthouse 12, phone profile | Chrome headless | Accessibility 100, Best Practices 100, SEO 100, Performance 66 to 70 |
| Lighthouse 12, desktop profile | Chrome headless | Accessibility 100, Best Practices 100, SEO 100, Performance 95 to 97 |

Lighthouse was run on Home, What Changed for Me and Budget Transparency after the fixes below. Before them the phone-profile scores on seven routes were Accessibility 97 to 99, Best Practices 96 to 100, SEO 82 to 83 and Performance 34 to 50.

## What the keyboard test proves

1. The first Tab stop on a page is "Skip to main content". It is visible when focused, has a solid focus ring, and Enter moves focus to the main region of the current screen.
2. Opening a dialog (the location chooser) from the keyboard keeps focus inside it: fourteen presses of Tab never leave the dialog.
3. Escape closes the dialog and returns focus to the control that opened it.
4. Chips and buttons are operated with Enter.

Screens in other tabs stay in the page so they keep their state; they are marked `inert`, so Tab and screen readers cannot reach a screen that is not showing.

## Problems found in this pass and fixed

| Problem | Where | Fix |
| --- | --- | --- |
| The summary heading was also a live region, which ARIA does not allow (axe `aria-allowed-attr`, serious) | What Changed for Me | The heading is only a heading; the line under it announces the result |
| The skip link pointed at `#main`, but no element had that id (Lighthouse `skip-link`) | every screen | The main region of the screen in view carries `id="main"` |
| Resource and service cards used a level 3 heading directly under the page title (Lighthouse `heading-order`) | Resource Finder, Map list | Level 2 |
| Tab bar buttons were announced by the screen title ("Resource Finder") while the visible label said "Resources" (WCAG 2.5.3 Label in Name) | tab bar | The spoken name is the visible label |
| Stat tiles and the location chip had spoken names that did not start with their visible text | Home, Service Status, location chip | Spoken name follows the visible text |
| No page description and no `robots.txt` (Lighthouse SEO) | web build | Added both |
| Four 160 KB font files were downloaded before anything was drawn | web build | The web build loads 22 KB WOFF2 copies limited to Latin and Vietnamese letters |
| All screens were in one 2.5 MB script | web build | Each screen is loaded when it is first opened (`asyncRoutes`) |

## Known limits

- **Performance is below 85 on Lighthouse's phone profile (66 to 70).** That profile simulates a slow 4G connection and a slow processor. The page is drawn by JavaScript, so nothing meaningful appears until about 600 KB of compressed script has arrived; the largest text appears at 5 to 8 seconds in the simulation. On the desktop profile the same build scores 95 to 97. Getting past 85 on the phone profile needs the pages to be pre-rendered to HTML at build time (Expo Router's `static` output), which means changing how the app starts so that it can render before saved settings are read. That work was not done.
- **Lighthouse still lists `label-content-name-mismatch` as an informational item** for the stat tiles and the location chip. The spoken names do contain the visible text; the audit is experimental and does not affect the score.
- **Map tiles are excluded from the axe scan.** They are images inside Leaflet's own markup. Every service on the map is also available in the list view, which is scanned.
- **Not tested with a screen reader by a person.** VoiceOver, TalkBack and NVDA were not run. The automated checks find missing names and roles; they cannot tell whether the reading order makes sense.
- **The phone apps were not audited.** axe and Lighthouse run in a browser. The same components render on iOS and Android with `accessibilityLabel`, `accessibilityRole` and 44-point touch targets, but that was read in the code, not measured on a device.
- **Translated text was not reviewed by native speakers** (see `docs/HUMAN_TODO.md`), and Inter has no Persian or Chinese glyphs, so those languages use the device's own font.
- **Budget figures, service descriptions and the full legal text are in English** in every language. Each such screen says so.

## Run the checks yourself

```sh
cd app
npm run check            # includes contrast and alt-text checks
npm run build:web
npm run e2e              # axe on every route, keyboard, 200% text
npx lighthouse http://localhost:4173/ --only-categories=performance,accessibility,best-practices,seo
```

For Lighthouse, start the API (`uvicorn main:app --port 8000` in `backend/`) and serve the build first (`npx serve dist --single --listen 4173`).
