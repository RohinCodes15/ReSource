# Accessibility

What was checked, how, and what the results were. First measured on October 13, 2026, and measured again on October 14, 2026 after the design pass (new type, colors, icons, drawings and map), against the exported web build (`npm run build:web`) with the API running in local mode. The target is WCAG 2.1 level AA.

## Results

| Check | Tool | Result |
| --- | --- | --- |
| Automated rules on all 22 routes | axe-core 4 through Playwright (`e2e/compliance.spec.ts`), rule tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` | 0 serious or critical violations |
| Dialogs, and four routes in Dari (right-to-left) | same | 0 serious or critical violations; no sideways scroll |
| Screens that appear only after an action: the "What changed for me" summary, a chat answer, a form error, the map's list view | same | 0 serious or critical violations |
| Keyboard only | Playwright (`e2e/flows.spec.ts`, "keyboard") | Pass: see below |
| Text enlarged to 200% | Playwright | Pass: no content lost on the routes tested |
| Color contrast of the 25 text and background pairs in the theme, including the new paper background | `npm run check:contrast` | All meet AA (4.5:1 for text, 3:1 for control edges) |
| Text alternatives for images and drawings | `npm run check:alt` (now also checks `<Svg>`) | 6 elements, each labeled or marked decorative |
| Lighthouse 12, phone profile | Chrome headless | Accessibility 100, Best Practices 100, SEO 100. Performance: Home 79, 80, 80 (three runs on the final build); What Changed for Me 73; Budget 69 |
| Lighthouse 12, desktop profile | Chrome headless | Accessibility 100, Best Practices 100, SEO 100, Performance 98 to 99 |
| Same machine, before and after the design pass, Home, phone profile, runs alternated | Lighthouse 12 on a build of commit `ed7e7b9` and on the current build | Before: Performance 56, 66, 70; largest text at 5.4 to 8.1 s. After: 77, 80, 80, and 79, 80, 80 on the final build; largest text at 4.4 to 4.5 s |

Lighthouse was run on Home, What Changed for Me and Budget Transparency after the fixes below. Before them the phone-profile scores on seven routes were Accessibility 97 to 99, Best Practices 96 to 100, SEO 82 to 83 and Performance 34 to 50.

## What the keyboard test proves

1. The first Tab stop on a page is "Skip to main content". It is visible when focused, has a solid focus ring, and Enter moves focus to the main region of the current screen.
2. Opening a dialog (the location chooser) from the keyboard keeps focus inside it: fourteen presses of Tab never leave the dialog.
3. Escape closes the dialog and returns focus to the control that opened it.
4. Chips and buttons are operated with Enter.

Screens in other tabs stay in the page so they keep their state; they are marked `inert`, so Tab and screen readers cannot reach a screen that is not showing.

## The design pass (October 14, 2026)

What changed that matters for access, and how each was checked:

| Change | Why it is safe | Checked by |
| --- | --- | --- |
| Warm paper background `#F6F2E9`, ink text `#1A2233`, hairline rules instead of card shadows | Every text and control-edge pair is in the contrast check, including three new pairs on the paper background | `npm run check:contrast` |
| Fraunces for headlines and large figures | Same sizes as before or larger. Persian and Chinese fall back to the device font at the same weight | axe, including right-to-left |
| Spaced small-capital labels | Letter spacing is turned off in right-to-left languages, because it pulls Persian letters apart | Code (`AppText`), axe in Dari |
| Lucide icons drawn as SVG | Hidden from screen readers like the old icon font; the text beside each icon carries the meaning | `check:alt`, axe |
| Drawings of Fremont places | Decorative and hidden from screen readers; empty states keep their heading and text | `check:alt`, axe |
| "More" tab | "More" alone failed Lighthouse's descriptive-link check once the icon font's hidden glyph no longer sat in the link. The tab still shows "More" and is announced as "More pages and settings", which starts with the visible word (WCAG 2.5.3) | Lighthouse SEO 100 |
| Grouped map pins | Each group is a button named with its count and the services in it ("5 services close together: ..."). Every service is still in the list view | `flows.spec.ts` "a group of pins" |
| Map images that fail | Hidden, never painted over; a status note says so | `flows.spec.ts` "when the map images fail" |
| Motion: the General Fund bar draws in, the cut figures fade in | Off when the system asks for reduced motion (React Native's `isReduceMotionEnabled`, plus a global CSS rule on the web). The headline figure is never animated | Tests run with reduced motion |
| Fonts declared with `font-display: swap` | Text shows at once in a fallback font instead of a blank page | Lighthouse |

## Problems found in the first pass and fixed

| Problem | Where | Fix |
| --- | --- | --- |
| The summary heading was also a live region, which ARIA does not allow (axe `aria-allowed-attr`, serious) | What Changed for Me | The heading is only a heading; the line under it announces the result |
| The skip link pointed at `#main`, but no element had that id (Lighthouse `skip-link`) | every screen | The main region of the screen in view carries `id="main"` |
| Resource and service cards used a level 3 heading directly under the page title (Lighthouse `heading-order`) | Resource Finder, Map list | Level 2 |
| Tab bar buttons were announced by the screen title ("Resource Finder") while the visible label said "Resources" (WCAG 2.5.3 Label in Name) | tab bar | The spoken name is the visible label |
| Stat tiles and the location chip had spoken names that did not start with their visible text | Home (tiles since replaced by figure rows that are named the same way), Service Status, location chip | Spoken name follows the visible text |
| No page description and no `robots.txt` (Lighthouse SEO) | web build | Added both |
| Four 160 KB font files were downloaded before anything was drawn | web build | The web build loads 20 to 23 KB WOFF2 copies limited to Latin and Vietnamese letters; since October 14 there are three of them (Inter 400 and 600, Fraunces 600) and the page no longer waits for them |
| All screens were in one 2.5 MB script | web build | Each screen is loaded when it is first opened (`asyncRoutes`) |

## Known limits

- **Performance on Lighthouse's phone profile is 69 to 80, not 85.** That profile simulates a slow 4G connection and a slow processor. Home scores 79 to 80, What Changed for Me 73 and Budget 69. The design pass raised Home from 56 to 70 on the same machine by not waiting for fonts, dropping the 1 MB icon font, loading the map's stylesheet only with the map, and loading the drawings separately. What is left is script: the page is drawn by JavaScript, and about 3.9 of the 4.4 seconds before the largest text appears are spent waiting for it to run. Going further needs pages pre-rendered to HTML at build time (Expo Router's `static` output), which means changing how the app starts so it can render before saved settings are read. That work was not done.
- **Lighthouse still lists `label-content-name-mismatch` as an informational item** for the Service Status tiles and the location chip. The spoken names do contain the visible text; the audit is experimental and does not affect the score.
- **Map tiles are excluded from the axe scan.** They are images inside Leaflet's own markup. Every service on the map is also available in the list view, which is scanned.
- **Pin groups are web only.** On phones, pins that share an address are still drawn in a small ring around it, as before; they were not grouped, and the phone map was not run.
- **Not tested with a screen reader by a person.** VoiceOver, TalkBack and NVDA were not run. The automated checks find missing names and roles; they cannot tell whether the reading order makes sense.
- **The phone apps were not audited.** axe and Lighthouse run in a browser. The same components render on iOS and Android with `accessibilityLabel`, `accessibilityRole` and 44-point touch targets, but that was read in the code, not measured on a device.
- **Translated text was not reviewed by native speakers**, and neither Inter nor Fraunces has Persian or Chinese glyphs, so those languages use the device's own font.
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
