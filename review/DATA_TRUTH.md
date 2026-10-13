# ReSource: is what the app shows true?

Independent review, snapshot 2026-10-12 about 17:30 PDT. Covers every number, vote, council member, address, phone number and claim a user can see: `shared/data/*.json`, the locale strings, and the legal text.

## Verdict

**The data itself is in good shape.** Everything I could open matched its source, including every figure taken from the FY 2026/27 budget presentation. Nothing looked invented, the three starter posts are labeled, and the app refuses to show how individual council members voted because it has not read the minutes. That restraint is the strongest thing about the project.

**The problems are around the data, not in it:**

1. About a third of the claims rest on three City documents I could not open. `fremont.gov` returns 403 to automated requests and the scraper kept no copy of them. They are cited, and a search engine confirms the documents exist, but nobody other than the original author has checked those numbers.
2. One council title may be wrong (Vice Mayor).
3. Several labels say more than the data supports: `verified: true` on every row, "Reduced" as a status, area tags, "What changed recently", and the "Sources" line in chat.
4. A dozen statements in the app's own copy are not true of the code today.
5. The README still says the data is illustrative. A judge reads that first.

## How I checked

| Mark | Meaning |
| --- | --- |
| **Verified** | I read the source today and it matches. For City PDFs and pages this means the copy saved by the scraper on 2026-10-11 in `scraper/data/`. For other organizations it means the live website. |
| **Corroborated** | I could not open the source, but a search-engine summary of that same page states the same thing. Weaker than verified. |
| **Cited, not checked** | A specific source is cited and exists, but I could not read it. Treat as unconfirmed until a person opens the link. |
| **Labeled sample** | Not real resident content, and the app says so. |
| **Unsupported** | Nothing backs it. |
| **Misleading** | The underlying fact may be right but the presentation says more than the fact. |

Sources I could not open: the City Manager's letter of March 30, 2026; the "Budget Rebalancing" news item of February 13, 2026; the City Manager's FY 2025/26 community message; the Mayor and Council page; the Election Information page. All five returned HTTP 403.

---

## 1. Budget figures (`shared/data/budget.json`)

### From the FY 2026/27 Proposed Budget presentation, May 12, 2026: all verified

Checked against `scraper/data/pdfs/Budget_Presentation_20494.pdf`. Page numbers in the data are correct. Source: https://www.fremont.gov/home/showpublisheddocument/20494/639142770931900000

| Shown in the app | Source page | Status |
| --- | --- | --- |
| Proposed budget, all funds: $427.1 million | 2 | Verified |
| General Fund: $289.1 million | 2 | Verified |
| Revenue table, 7 rows by 3 years (property tax 145.5 / 152.5 / 158.2 and so on) | 4 | Verified, all 21 cells |
| Note: FY 2024/25 sales tax reflects about $11.9 million recovered by the State | 4 | Verified |
| Contingency Reserve $48.3 million, 16.7% | 6 | Verified |
| Budget Uncertainty Reserve $4.3 million | 6 | Verified |
| General Fund shares: Police 45%, Fire 27%, Maintenance 15%, Other 13%; three together 87% | 7 | Verified. The slide prints these numbers; they were not estimated from a chart, despite the note "Read from the chart". |
| Staffing table, 9 functions plus total (996.0 to 994.2, change −1.8) | 9 | Verified, all 30 cells |
| "No capacity to restore eliminated positions or services" | 10 | Verified, exact wording |
| "Staffing and services at current-year levels" | 10 | Verified |
| Hearings June 2 and June 9 | 11 | Verified |

### From the FY 2025/26 Mid-Year Budget Report, March 3, 2026: verified

Checked against `scraper/data/pdfs/FY_2025_26_Mid_Year_Budget_Report_20068.pdf`. Source: https://www.fremont.gov/home/showpublisheddocument/20068/639100281365700000

| Shown in the app | Source page | Status |
| --- | --- | --- |
| $19.9 million of the Budget Uncertainty Reserve applied in FY 2024/25 | 5 | Verified |
| Budget Uncertainty Reserve at $4.3 million | 6 | Verified |

### From the "Budget Rebalancing" news item, February 13, 2026: corroborated

Source: https://www.fremont.gov/Home/Components/News/News/1665/1067

| Shown in the app | Status |
| --- | --- |
| Council approved the plan at the February 10 meeting | Corroborated |
| $3.8 million, of which $3.1 million is General Fund | Corroborated, with a wording caveat below |
| Police: six administrative positions, two detention officers, one detention supervisor | Corroborated |
| No reductions to current sworn police or fire positions | Corroborated |
| Infrastructure maintenance reduced by about $3 million to balance FY 2025/26 | Corroborated |
| "The largest reductions were in Police, Fire and Maintenance Operations" | Cited, not checked |
| "Positions were eliminated or reclassified… no layoffs were anticipated" | Cited, not checked |

Wording caveat: the summary I saw describes "$3.8 million **increase in appropriations for personnel** expenditures" from new labor agreements. The app's headline label is "Operational reductions across all departments: $3.8M" (`budget.json:43`). Both can be true (the increase is offset by reductions), but check the source says the reductions total $3.8 million and not merely that the cost being covered does.

### From the City Manager's letter, March 30, 2026: cited, not checked

Source: https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000

A search confirms a letter of that date to Senator Wahab and Assemblymember Lee exists at the cited address. I could not read it. None of these is confirmed by this review:

| Shown in the app | Where |
| --- | --- |
| About $3 million removed from pavement maintenance and park and median capital replacement | `budget.json:44`, `:60` |
| The quote that the cut "was required to balance the budget" | `services.json:16` |
| 10 more Human Services positions to be eliminated because of State and federal funding changes | `budget.json:70`, `services.json:181`, `alerts.json:47` |
| A 2022 State tax-agency error overpaid Fremont about $20 million | `budget.json:129` |
| 0.9 sworn officers per 1,000 residents against a California average of 2 | `budget.json:132` |
| Population 232,619 across 92 square miles | `budget.json:133` |
| One more fire company recommended by the Standards of Coverage report is not funded | `services.json:155` |

The direct quotation matters most. A quote in quotation marks attributed to a City official must be exact. Have a person open the letter and compare.

### From the City Manager's FY 2025/26 community message: cited, not checked

Source: https://www.fremont.gov/home/showpublisheddocument/18479/638868997000130000

| Shown in the app | Where |
| --- | --- |
| $392.4 million Operating Budget adopted June 10, 2025, balanced without the reserve | `budget.json:136`, `votes.json:48` |
| Homelessness services funded at about $8 million; $667,000 moved among programs | `services.json:214` |
| $150,000 more for Keep Fremont Housed; $128,000 new for overdose prevention | `services.json:215` |

### Other budget items

| Shown in the app | Source | Status |
| --- | --- | --- |
| Council adopted the FY 2026/27 budget on June 9, 2026 after hearings June 2 and 9 | [The Fremont Connection, June 12, 2026](https://content.govdelivery.com/accounts/CAFREMONT/bulletins/41b9e82) | Verified on the live page. The page gives no amount and no tally, and the app claims neither. |
| Council deferred a half-cent sales tax measure; reported as unanimous; estimated $30 to $35 million a year | [Hoodline, July 24, 2026](https://hoodline.com/2026/07/fremont-council-slams-brakes-on-half-cent-tax-hike-before-november-vote-6944803/) | Verified on the live page. Hoodline cites The Mercury News and gives no meeting date; the app shows "July 2026" and says the minutes were not checked. Accurate. |

### Budget presentation issues

- **`budget.intro` (`en.json:440`) says "Every figure below links to the City document it was read from."** One timeline entry cites Hoodline, which is a news site. Say "to its source".
- **"Positions eliminated or announced" chart** (`budget.tsx:57-65`) draws nine eliminated police positions and ten announced Human Services positions as bars on one axis. They are different kinds of fact. The same screen's staffing table shows Human Services at −2.8, which will look like a contradiction to a careful reader. The service detail explains the difference (`services.json:182`); the chart does not.
- **`reductionsSummary` (`en.json:444`) says "Two reductions balanced the FY 2025/26 budget."** The $3 million was at adoption in June 2025; the $3.8 million was a mid-year response to new labor costs in February 2026. Close, but they were two separate events.

---

## 2. Council (`shared/data/council.json`, `votes.json`)

Source cited by the app: https://www.fremont.gov/government/mayor-city-council (not readable in this review).

| Shown in the app | Status |
| --- | --- |
| Mayor Raj Salwan, elected citywide, term to 2028 | Corroborated |
| District 1 Teresa Keng (2028), District 2 Desrie Campbell (2026), District 3 Kathy Kimberlin (2026), District 4 Yang Shao (2026), District 5 Yajing Zhang (2028), District 6 Raymond Liu (2028) | Corroborated: names, districts and term years |
| **Raymond Liu is Vice Mayor** | **Needs checking.** A search summary of a City district map lists Yajing Zhang as Vice Mayor, and an older City document lists Teresa Keng. The title rotates. I could not open the Council page. Confirm before the demo; getting an official's title wrong is the kind of error a local judge notices. |
| Seven phone numbers and seven email addresses | Cited, not checked. The emails follow the City's first-initial-last-name pattern. |
| "Term ends November 2028" for four members, "December 2026" for three | Inconsistent convention within one file. Use the same basis for all seven. |
| City Clerk (510) 284-4060 | Verified (department directory, local copy) |
| Election on November 3, 2026; Districts 2, 3 and 4 on the ballot | Consistent with the 2026 term endings; the City page was not readable. Cited, not checked. |
| District Locator link | Not checked |

### Votes

| Item | What the app shows | Status |
| --- | --- | --- |
| Four Council actions (June 2025, February 2026, June 2026, July 2026) | Outcome and a summary | Outcomes verified or corroborated as above |
| Tally | "Vote record not yet verified" on three; "Reported as unanimous" on one | **Honest.** `member_votes` is empty in all four (`votes.json:10`, `:24`, `:38`, `:52`). |

This is correct behavior. It also means the screen called **"Rep Tracker" tracks nothing about any representative.** It is a contact list plus four Council actions with no individual votes. Rename it ("Your Council") or fill in the votes from the minutes; the agenda-center link is already on each card.

After November 3, 2026 the election banner and the `alert-election-2026` alert will describe a past event as upcoming, and the three seats may have new holders in December. Nothing in the app expires dated content.

---

## 3. City services (`shared/data/services.json`)

### Contact details

| Service | Phone | Address | Hours |
| --- | --- | --- | --- |
| Street pavement maintenance | (510) 979-5700 verified | 42551 Osgood Rd: not checked | none |
| Park and median capital replacement | (510) 494-4300 verified | City Hall Building B: not checked for this office | none |
| Police administrative staffing | (510) 790-6800 verified | 2000 Stevenson Blvd: not checked | none |
| Detention Facility staffing | (510) 790-6800 (same as Police) | 1990 Stevenson Blvd: not checked | none |
| Department operations | (510) 284-4000 verified as the City Manager's Office number | 3300 Capitol Ave verified | none |
| Fire Department operations | (510) 494-4200 verified | City Hall Building A: not checked | none |
| Human Services safety-net programs | (510) 574-2050 verified | 3300 Capitol Ave, Building B verified | "Mon–Fri 8:30–5:00, closed 12–1": the source gives these hours for the Aging and Family Services office in the same building. Inferred for the department. |
| Homelessness response | (510) 574-2050 verified | same | none |
| Age Well Center at Lake Elizabeth | (510) 790-6600 verified | 40086 Paseo Padre Pkwy verified | 8:00–4:30 verified; "except City holidays" inferred |
| Age Well Center at South Fremont | (510) 742-7540 verified | 47111 Mission Falls Ct verified | same |
| Youth and Family Services | (510) 574-2100 verified | 39155 Liberty St, Suite E500 verified | 8:00–5:00 verified. Sliding-scale fees and the six counseling languages verified. |

"Verified" here means the City pages saved by the scraper on October 11: [department directory](https://www.fremont.gov/about/department-directory), [older adults and caregivers](https://www.fremont.gov/residents/older-adults-caregivers), [youth](https://www.fremont.gov/residents/youth).

### Things the labels overstate

1. **`"verified": true` on every one of the 25 catalog rows and 6 alerts.** Nothing in the repository records who verified what, or how. For the rows that depend on the three documents I could not open, the flag is an assertion. Either drop the field or replace it with `checked_by` and `checked_on` filled in by a person.
2. **"Reduced" is the app's judgment, not the City's word.** "Fire Department operations budget: Reduced" (`services.json:142-146`) rests on "one of the three departments with the largest reductions", while the same row says no sworn positions were cut. A resident reading a "Reduced" pin on the fire department may conclude that emergency response got worse, which the source does not say. Consider a separate label for "budget trimmed, no announced service change".
3. **Area tags describe where the office is, not who is affected.** Police administrative staffing, Detention staffing and Human Services are tagged `94538` (`services.json:61`, `:90`, `:173`) because the buildings are there. Filtering Service Status by "Central Fremont & Irvington" then shows reductions as though they were local to that neighborhood, and every other neighborhood shows fewer. All three are citywide.
4. **Map pins are budget lines, not places.** "Street pavement maintenance" is pinned on the Maintenance Center on Osgood Road. The reduction is not at that address. The map implies a geography the data does not have; five of the seven reductions sit on City Hall or the police station.
5. **All coordinates are hand-placed.** Every row has `"coords": "approximate"`. `scraper/logs/scraper.log` shows the geocoder attempts were refused. The app says so on each detail sheet and directions use the street address, which is the right mitigation. The "≈" before distances on the resource list is honest.
6. **"What changed recently" is sorted by the day the data was checked**, so three unchanged, open services lead it (BUGS.md B17).
7. **Cross-source details under one citation.** Each row can cite one source, but:
   - `svc-park-median` cites the City Manager's letter, while its detail quotes "the City's February 13, 2026 release" (`services.json:43`, `:51`).
   - `svc-fire-ops` cites the February 13 release, while its detail comes from "a March 30, 2026 City letter" (`:155`, `:163`).
   - `alert-maintenance` (`alerts.json:73-84`) is about the budget adopted June 10, 2025 and "a later City letter", and cites the February 13, 2026 rebalancing release.
   A reader who follows the link will not find the stated fact. Allow two sources per row.
8. **Admin can change a status and the City citation stays attached** (`backend/routers/admin.py:71-79`). After one tap in Admin Tools, a status the City never published is displayed under "Source: City of Fremont". The admin screen warns about this (`en.json:511`) but the app does not prevent it. Clear or replace the source when status is edited by hand.

---

## 4. Community resources (`shared/data/resources.json`)

| Resource | Address | Phone | Hours and description | Status |
| --- | --- | --- | --- | --- |
| [TCV Food Bank + Mobile Pantry](https://tcvfoodbank.org/) | 37350 Joseph St | (510) 793-4583 | Mon–Thu 10–2; Fri drive-thru 10–11:30; ID for first visit; no new cards Fridays; five website languages | **Verified** (live site) |
| [Bay Area Community Health: Liberty](https://bach.health/alameda-county-locations) | 39500 Liberty St | (510) 770-8040 | Mon–Thu 8–7, Fri–Sat 8–5; medical, behavioral health, vision | **Verified** |
| Bay Area Community Health: Irvington Dave | 40910 Fremont Blvd | (510) 770-8040 | Medical Mon–Fri 8–7, Sun 8–5; dental Mon–Fri 8–7, Sat 8–5 | **Verified** |
| Bay Area Community Health: Mowry II | 1999 Mowry Ave | (510) 770-8040 | Medical 8–5; Teen Clinic Mon–Thu 9–6, Fri 8–5; Convenient Care 5–8 | **Verified** |
| [Immigration Institute of the Bay Area: Fremont](https://iibayarea.org/offices/fremont/) | 39055 Hastings St, Suite 202 | (510) 894-3639 | First consultation by phone or online | **Verified** |
| [League of Volunteers](https://www.lov.org/contact-lov) | PO Box 1170, Newark | (510) 793-5683 | Tue–Fri 9–2; remote staff | **Verified.** The site says remote operation; "no walk-in office" is a fair reading, not a quote. |
| [Abode Services](https://abode.org/) | 40849 Fremont Blvd | (510) 657-7409 | Administrative office | **Verified** |
| City of Fremont Senior InfoLine | 3300 Capitol Ave, Bldg B | (510) 574-2041 | Four languages; calls returned within 2 days | **Verified** (City page, local copy) |
| Fremont Family Resource Center | 39155 Liberty St | (510) 574-2000 | Houses City, County and nonprofit agencies | Phone and address verified; description not checked |
| 988 Suicide & Crisis Lifeline | phone | 988 | 24 hours | Verified that the City's youth page points to it |
| 211 Alameda County | phone | 211 | 24 hours, 7 days | Not checked; standard service |
| Fremont Library, Centerville Library, Niles Library | three addresses | three numbers | "Run by the County, not paid for from the City of Fremont budget" | **Not checked.** The funding statement is a factual claim about government budgets and deserves a source of its own. |

Fourteen resources is a thin list for a city of 230,000. There is one food source, no shelter intake number, no rental-assistance program, no legal aid other than immigration, and no utility-assistance program. The data is accurate; it is not yet enough to be the reason someone opens the app.

---

## 5. ZIP codes (`shared/data/zips.json`)

| Shown | Status |
| --- | --- |
| Four Fremont ZIP areas with Census centroids | Cited (2024 Gazetteer); not checked. Coordinates are plausible. |
| Neighborhood names ("Centerville & Niles") | The project's own labels. The file's note says ZIP boundaries do not follow neighborhoods. |
| 94537 mapped to City Hall | Reasonable and explained |
| "your location, near Centerville & Niles" for a GPS fix | **Wrong for central Fremont.** The label is the nearest centroid, not the ZIP containing the point. City Hall itself gets this label though it is in 94538 (BUGS.md B15). |

Distances for someone who types a ZIP are measured from the ZIP's centroid. For 94555 that point is west of Ardenwood, toward the bay, so "nearest" can be off by a mile or two. The app does not say distances from a ZIP are approximate.

---

## 6. Posts, counts and the assistant

| Shown | Status |
| --- | --- |
| Three starter posts | **Labeled sample.** Each carries "Starter post by ReSource" (`community.tsx:128`), and their contents match verified sources. They are excluded from the post count (`public.py:111`). |
| "City services with reductions", "tracked", "Places to get help" on Home | Computed from the data on each load. Accurate. |
| **"Impact reports received"** | **Misleading.** Counts every report ever submitted, including unreviewed and rejected ones (`public.py:109`). The app tells the reporter "A moderator will review it before it is counted" (`en.json:296`). Anyone can raise the number (SECURITY.md S3). |
| Community Impact totals | Verified reports only. Accurate, but visible to staff only, so no member of the public sees them. |
| Upvote counts | Not reliable: one person can add any number (SECURITY.md S3). |

### The assistant

| Shown | Status |
| --- | --- |
| "AI answer from ReSource data" badge | **Unsupported as a guarantee.** The model is instructed to use only the supplied data. Nothing checks that it did. |
| "Sources: …" row under each answer | **Misleading.** It lists catalog names that appear anywhere in the reply text (`grounding.py:179-183`). It is not a record of where a fact came from. |
| "Basic search of ReSource data" answers | Grounded by construction, but the matching is wrong often enough to matter. "Which services were cut?", the first suggested question, returns Abode Services with "Sources: Abode Services" (BUGS.md B1). A wrong answer with a source line is worse than no answer. |
| "I don't know… call 211 or the City at (510) 284-4000" | Good fallback; both numbers verified. |

---

## 7. Claims in the app's own copy

| Claim | Where | Status |
| --- | --- | --- |
| "Made by [Your name]", contact "[your-contact-email@example.com]" | every footer, About, Privacy, Terms, Data request | **Unsupported.** Placeholders shown as fact. |
| "ReSource's own code is released under the MIT License." | `en.json:654` | **Unsupported.** No LICENSE file exists. |
| "AI coding tools were also used… which is disclosed in the project's submission materials." | `en.json:567` | **Unsupported.** `submission/` contains screenshots only. |
| "Your location stays on your device." / "never stored on our server" | `content.ts:20`, `:51`; `en.json:196`, `:647` | **Misleading.** Not stored, but sent to the server at about 100-meter precision with every chat message (SECURITY.md S10). |
| "Under 13… the app collects nothing from you." | `en.json:310`, `:647`; `content.ts:21` | **False as built.** Feedback, votes and flags are still sent (BUGS.md B20). |
| "Saved on this device… it will sync next time." | `en.json:325` | **False.** No sync exists. |
| "Your choices were removed from our server." | `en.json:326` | **Unverified at the time it is shown**; displayed before the request, and shown even if it fails. |
| "The app posts a notification when it finds a new matching update." | `en.json:328` | **Misleading.** Only while the Alerts screen is open. |
| "You are signed up for email alerts. Every email has an unsubscribe link." | `en.json:339` | **False.** Nothing sends email. Hidden unless SMTP is configured. |
| "A moderator will review it before it is counted." / "count only after review" | `en.json:296`, `content.ts:164` | **False for the Home screen count.** |
| "Reports are shown publicly only as totals" | `content.ts:158`, `en.json:296` | True that nothing else is shown; no public screen shows the totals either. |
| "We will reply within 30 days." | `en.json:588`, `content.ts:74` | **A promise with no process behind it.** In default configuration nobody can even read the requests. |
| "Every item shows its source and the date we last checked it." | `en.json:564` | Mostly true. The "All services" list on Service Status has no source line, and `statusPage.intro` (`en.json:253`) says each entry links to its document. |
| "The CSV… contains no names or identifiers." | `en.json:473` | **Not guaranteed.** It contains free text and the report id; a name typed into "Something else" goes straight through (SECURITY.md S8). |
| "Map data © OpenStreetMap contributors." | `en.json:220` | True on web, wrong on phones (Apple or Google). |
| "ReSource uses only openly licensed or self-made fonts, icons, maps and data." | `en.json:653` | Apple and Google map tiles on phones are neither. |
| "Connections are encrypted (HTTPS)." | `content.ts:103` | Depends on deployment. The documented setups use `http://`. |
| "Translations… have not yet been reviewed by native speakers." | `en.json:4` | True, and understated: three of the four translations are 8% present (BUGS.md B3). |
| "Fremont has a mayor elected citywide and six council members, one per district." | `en.json:374` | Corroborated. |
| "Independent student project, not an official City of Fremont service." | Home, footer, About, Terms | True and well placed. |
| "The City has not reviewed or endorsed this app." | `en.json:457` | True and well placed. |
| "ReSource has no ads, analytics or trackers." | `en.json:606`, `content.ts:19` | **Verified.** `check-storage.mjs` passes and I found no analytics package or tracking request. |

### The README contradicts the app

`README.md:3`: "The service changes, alerts, posts, and council vote examples in this demo are illustrative and are not official city notices or vote records."

That sentence describes an earlier version. The app now presents the same content as sourced fact with citations. If a judge reads the README and then the app, either the README is wrong or the app is overstating. Rewrite the README to say what is true today: which items are sourced, which were verified by a person, and which are starter content.

---

## 8. What to do, in order

1. **Have a person open the three City documents** (the March 30 letter, the February 13 release, the FY 2025/26 community message) and tick off the 17 claims listed in section 1 against them. Record the date and who checked. This converts a third of the app from "cited" to "verified" in under an hour.
2. **Confirm the Vice Mayor** on the Council page, and the seven phone numbers while there.
3. **Fill in `[Your name]` and the contact email**, add a LICENSE file or remove the MIT sentence, and rewrite the first paragraph of the README.
4. **Stop counting unreviewed reports** on Home.
5. **Fix or remove the "Sources" line in chat** for answers that are not checked against the data, and fix the basic-mode answer to the first suggested question.
6. **Replace `verified: true`** with who checked and when, per row.
7. **Retag citywide services as citywide**, sort "What changed recently" by the date of the change, and allow two sources on a row.
8. **Add an expiry date to dated content** so the election notice stops showing as upcoming after November 3.
9. **Correct the copy** in section 7 that describes sync, notifications, under-13 collection and location in ways the code does not match.

## Appendix: how each source was reached

- **Local copies made by the scraper on 2026-10-11:** the two budget PDFs in `scraper/data/pdfs/`, and the City pages for older adults, youth and the department directory in `scraper/data/raw/`.
- **Live pages opened today:** The Fremont Connection, Hoodline, TCV Food Bank, Bay Area Community Health, IIBA Fremont, League of Volunteers, Abode Services (links in the tables above).
- **Search-engine summaries only, because the page returned 403:** the Budget Rebalancing news item, the City Manager's letter, and the Council roster (including the City's "Get to Know Your City Council" story map at https://storymaps.arcgis.com/stories/c2a5d45590bf4867b1c168e4b7ecd504).
