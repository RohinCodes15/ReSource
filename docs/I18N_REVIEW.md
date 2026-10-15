# Translation review

The app is offered in English, Spanish, Dari, Chinese (Simplified) and Vietnamese. This page records what state each translation is in and what a reviewer needs to do.

## Status

| Language | File | Strings | Written by | Reviewed by a native speaker |
| --- | --- | --- | --- | --- |
| English | `app/src/locales/en.json` | 620 | Source text | Not applicable |
| Spanish | `es.json` | 620 | AI model | **No** |
| Dari | `fa.json` | 620 | AI model | **No** |
| Chinese (Simplified) | `zh.json` | 620 | AI model | **No** |
| Vietnamese | `vi.json` | 620 | AI model | **No** |

**Dari, Chinese and Vietnamese must be read by a native speaker before real residents rely on them.** They were written in one pass on October 13, 2026 and nobody who speaks those languages has read them. Spanish is older but has the same status. The app tells people this in the language list.

`npm run check:i18n` proves only that every language has the same keys as English, the same `{{placeholders}}`, and no empty strings. It cannot tell whether a sentence is correct, natural or polite.

## What a reviewer should look at first

In this order, because mistakes here do the most harm:

1. **Consent and age text** (`consent.*`, `report.consent`, `community.consent`, `alerts.emailConsent`, `signIn.consent`, `dataRequest.consent`). A person must understand what they agree to.
2. **Emergency text** (`home.emergencyBody`, `chat.emergency`). Numbers 911, 988 and 211 must read clearly.
3. **Storage banner** (`storage.*`).
4. **The legal summaries** (`legal.privacySummary`, `legal.termsSummary`). The full policies are shown in English only, with these summaries in the reader's language.
5. **What Changed for Me** (`forMe.*`), especially the sentences that say the City has not published something.
6. **Chat starter questions** (`chat.s1` to `chat.s4`). These also drive the keyword lookup, so if they are reworded, re-run the backend test that checks each one returns an answer.
7. Everything else.

## Known choices to confirm

| Language | Choice made | Question for the reviewer |
| --- | --- | --- |
| Dari | Afghan Dari vocabulary (for example "سرک" for street, "معلومات" for information, "صحی" for health, "باشندگان" for residents) and Western digits | Is the register right for Fremont's Afghan community? Should digits be Persian? |
| Dari | Dates are shown in the Gregorian calendar with Western digits so they match the City's documents | Would readers expect the Solar Hijri date as well? |
| Dari | "City Hall" and neighborhood names are left in English | Should they be transliterated? |
| Chinese | Simplified characters, Mainland terms ("弗里蒙特", "邮政编码") | Many Fremont residents read Traditional characters. Is a Traditional version needed? |
| Chinese | "Council member" as "市议员", "district" as "选区" | Confirm local usage |
| Vietnamese | Formal address with "quý vị" | Is that the right tone, or is it too formal? |
| Spanish | Formal "usted" | Confirm |
| All | Budget figures, service names and descriptions, alerts and resource descriptions stay in English, with a note saying so | A reviewer may prefer translated service names with the English in brackets |

## What is not translated

- Service names, summaries, alerts, resource descriptions and budget labels (they come from `shared/data/`, in English, as written in the source documents).
- The full Privacy Policy and Terms. Legal text should not be machine-translated without review.
- The letter draft in Rep Tracker, because it is addressed to an English-speaking office.
- Chat answers in AI mode are written by the model in the chosen language and are not reviewable in advance. In basic mode the fixed phrases are in `backend/grounding.py`.

## Layout

Dari is right-to-left. The app mirrors rows, margins and icons that point a direction. An automated test checks four screens in Dari for accessibility violations and sideways scrolling. Nobody has checked the Dari layout on a phone, and Inter has no Persian or Chinese glyphs, so those languages use the device's own font.

## How to review

1. Open the app, go to Settings and choose the language.
2. Walk through Home, What Changed for Me, Report an Impact, Alerts, Ask ReSource and Settings.
3. Write corrections against the key name (shown in the JSON file) so they can be applied exactly.
4. After applying corrections, run `npm run check:i18n` in `app/`.
