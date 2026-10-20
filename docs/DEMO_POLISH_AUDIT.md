# Demo polish audit (web)

Checked on 2026-10-20 against the exported web build with the local API, at 390×844 (phone) and 1280×800 (desktop): first paint at 120, 300, 600 and 1000 ms, layout shift (CLS), hover on 78 controls, an offline run with the API blocked, the Tour step by step, and the "Was this helpful?" prompt. Nothing here is fixed yet; this is the list to pick from before recording the demo.

## High: likely to show on camera

1. **Resources, Report and Budget jump on first load.** At about 0.8 s the footer is drawn first, then the content pushes it down. CLS on phone: Resources 0.17, Report 0.22, Budget 0.17 (over 0.1 is noticeable). The other screens are about 0.01.
2. **No hover state anywhere.** None of the 78 buttons, chips, rows and links checked changes on hover; `ui.tsx` only has pressed (opacity 0.8) and disabled (0.5). Some controls have no pressed state either: chat Send, the Report service and impact rows, the clear-search button on Map and Resources, and the language button.
3. **The Tour never spotlights anything.** On all six steps, at both sizes, the target on Home is below the fold, so the Tour falls back to a centered card over an evenly dimmed page.
4. **Gold focus ring around the first Tour card.** The dialog takes focus when it opens, and the global `:focus-visible` style draws a thick gold border around the whole card.
5. **The Tour card flashes blank on Next and Back.** The card resizes at once while its text fades in over 320 ms, and it moves 20 to 40 px up or down between steps because each step is a different height.
6. **Doubled focus ring in the search fields.** On Resources and Map a square gold ring appears inside the rounded field border.

## Medium

7. **Chat Send is navy, not gold.** DECISIONS.md names Send as a gold action; when disabled (how the screen opens) it is a grey-brown circle.
8. **HelpfulPrompt is heavier than it needs to be.** Yes and No are full outline buttons that compete with the Call and Map buttons above them in a chat answer. Its error text is plain grey with no icon, unlike field errors. The thank-you line replaces the whole block, so the bubble shrinks.
9. **The offline banner does not match `<Banner>`.** A full-width yellow strip with no icon; on phones the text wraps badly, and it shifts the page down a little (CLS 0.06) when it appears. It does not show by mistake while the API is reachable.
10. **Map clusters overlap and are clipped.** A "1" cluster sits under the "38" cluster, and pins are cut off at the map edges.
11. **"Clear conversation" is half hidden** under the chat composer at the end of a conversation.

## Low

12. Screens paint in two steps: header and tab bar at about 0.6 s, content at about 1.0 s. On Home and Budget the budget bar and the drawing arrive a moment after the text, in space already kept for them.
13. Scrolling chip rows on Map, Resources and Chat end mid-word at the right edge with no fade.
14. In Budget's "Key numbers" the source links wrap to three lines and the rows do not line up.
15. The Tour card has a shadow; `theme.ts` allows that for floating layers, so it is only noted for consistency.

Empty states and the Report, Community and What Changed for Me screens looked finished.

## Suggested before the demo

Items 1, 2, 4, 5, 6 and 7: small changes that are easy to see. Item 3 if there is time.
