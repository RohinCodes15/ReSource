# Data sources

Every fact the app shows about the city comes from one of the files in `shared/data/`. Each row in those files names the public document or page it was read from and the date it was read. The tables below are generated from those files, so they list exactly what the app uses. All sources were read on October 12, 2026.

Rules followed when the data was entered:

- A figure is entered only if a public document states it. Where the City has not published an amount or a date, the field is empty and the app says so.
- A service is marked "reduced" only when a City document describes a reduction to it. "open" means the documents read show no budget-related change, not that someone confirmed nothing changed.
- How individual council members voted is not shown, because the official minutes were not read. See `docs/DECISIONS.md`.
- Map positions are approximate (the data marks them `coords: "approximate"`), and the app says so on the map.
- ReSource cites City documents. The City has not reviewed or endorsed the app.

## Budget figures (`shared/data/budget.json`)

Retrieved 2026-10-12. Every figure on the Budget Transparency screen names one of these documents and, where the document has pages, the page.

| Key | Document | Address |
| --- | --- | --- |
| `proposed2627` | FY 2026/27 Proposed Budget presentation, May 12, 2026 | https://www.fremont.gov/home/showpublisheddocument/20494/639142770931900000 |
| `midyear2526` | FY 2025/26 Mid-Year Budget Report, March 3, 2026 | https://www.fremont.gov/home/showpublisheddocument/20068/639100281365700000 |
| `rebalance` | City Council Approves Budget Rebalancing, February 13, 2026 | https://www.fremont.gov/Home/Components/News/News/1665/1067 |
| `cmletter` | City Manager letter to Sen. Wahab and Asm. Lee, March 30, 2026 | https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000 |
| `cmmessage2526` | Community Message from the City Manager on the FY 2025/26 Operating Budget | https://www.fremont.gov/home/showpublisheddocument/18479/638868997000130000 |
| `connection0612` | The Fremont Connection, June 12, 2026 | https://content.govdelivery.com/accounts/CAFREMONT/bulletins/41b9e82 |
| `hoodline` | Hoodline, July 24, 2026 | https://hoodline.com/2026/07/fremont-council-slams-brakes-on-half-cent-tax-hike-before-november-vote-6944803/ |

## City services (`shared/data/services.json`)

Eleven entries. "open" means the documents read show no budget-related change.

| Service | Status | Source | Address | Retrieved |
| --- | --- | --- | --- | --- |
| Street pavement maintenance | reduced | City Manager letter to Sen. Wahab and Asm. Lee, March 30, 2026 | https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000 | 2026-10-12 |
| Park and street-median capital replacement | reduced | City Manager letter to Sen. Wahab and Asm. Lee, March 30, 2026 | https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000 | 2026-10-12 |
| Police Department administrative staffing | reduced | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| Fremont Detention Facility staffing | reduced | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| Department operations: staffing, overtime, training and contract services | reduced | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| Fire Department operations budget | reduced | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| Human Services safety-net programs | reduced | City Manager letter to Sen. Wahab and Asm. Lee, March 30, 2026 | https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000 | 2026-10-12 |
| Homelessness response services | open | Community Message from the City Manager on the FY 2025/26 Operating Budget | https://www.fremont.gov/home/showpublisheddocument/18479/638868997000130000 | 2026-10-12 |
| Age Well Center at Lake Elizabeth | open | Aging and Family Services (City of Fremont) | https://www.fremont.gov/residents/older-adults-caregivers | 2026-10-12 |
| Age Well Center at South Fremont | open | Aging and Family Services (City of Fremont) | https://www.fremont.gov/residents/older-adults-caregivers | 2026-10-12 |
| Youth and Family Services counseling | open | Youth & Family Services (City of Fremont) | https://www.fremont.gov/residents/youth | 2026-10-12 |

## Places to get help (`shared/data/resources.json`)

Each listing was read from the organization's own page, or from the City page that lists it.

| Resource | Source address | Retrieved |
| --- | --- | --- |
| TCV Food Bank + Mobile Pantry | https://tcvfoodbank.org/ | 2026-10-12 |
| 211 Alameda County | https://211alamedacounty.org/ | 2026-10-12 |
| Fremont Family Resource Center | https://www.fremont.gov/about/department-directory | 2026-10-12 |
| City of Fremont Senior InfoLine | https://www.fremont.gov/residents/older-adults-caregivers | 2026-10-12 |
| Bay Area Community Health: Liberty Clinic | https://bach.health/alameda-county-locations | 2026-10-12 |
| Bay Area Community Health: Irvington Dave Clinic | https://bach.health/alameda-county-locations | 2026-10-12 |
| Bay Area Community Health: Mowry II Clinic | https://bach.health/alameda-county-locations | 2026-10-12 |
| 988 Suicide & Crisis Lifeline | https://www.fremont.gov/residents/youth | 2026-10-12 |
| Abode Services | https://abode.org/ | 2026-10-12 |
| Immigration Institute of the Bay Area: Fremont | https://iibayarea.org/offices/fremont/ | 2026-10-12 |
| League of Volunteers (LOV) | https://www.lov.org/contact-lov | 2026-10-12 |
| Fremont Library | https://aclibrary.org/locations/ | 2026-10-12 |
| Centerville Library | https://aclibrary.org/locations/ | 2026-10-12 |
| Niles Library | https://aclibrary.org/locations/ | 2026-10-12 |

## Alerts (`shared/data/alerts.json`)

Six updates shown on the Alerts screen.

| Alert | Published | Source | Address | Retrieved |
| --- | --- | --- | --- | --- |
| Council Districts 2, 3 and 4 are on the November 3, 2026 ballot | 2026-08-07 | Election Information (City of Fremont) | https://www.fremont.gov/government/election-information | 2026-10-12 |
| Council defers a possible half-cent sales tax measure | 2026-07-24 | Hoodline, July 24, 2026 | https://hoodline.com/2026/07/fremont-council-slams-brakes-on-half-cent-tax-hike-before-november-vote-6944803/ | 2026-10-12 |
| FY 2026/27 budget adopted with no room to restore earlier cuts | 2026-06-12 | FY 2026/27 Proposed Budget presentation, May 12, 2026 (City of Fremont) | https://www.fremont.gov/home/showpublisheddocument/20494/639142770931900000 | 2026-10-12 |
| City says 10 more Human Services positions will be eliminated | 2026-03-30 | City Manager letter to Sen. Wahab and Asm. Lee, March 30, 2026 | https://www.fremont.gov/home/showpublisheddocument/20676/639165034637630000 | 2026-10-12 |
| Budget rebalancing approved: reductions in every department | 2026-02-13 | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| About $3 million less for streets, parks and medians | 2025-06-10 | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |

## Council budget actions (`shared/data/votes.json`)

What the Council decided. No individual votes are shown; see `docs/DECISIONS.md`.

| Action | Source | Address | Retrieved |
| --- | --- | --- | --- |
| Deferred a possible half-cent sales tax ballot measure | Hoodline, July 24, 2026 | https://hoodline.com/2026/07/fremont-council-slams-brakes-on-half-cent-tax-hike-before-november-vote-6944803/ | 2026-10-12 |
| Adopted the FY 2026/27 Operating Budget | The Fremont Connection, June 12, 2026 (City of Fremont) | https://content.govdelivery.com/accounts/CAFREMONT/bulletins/41b9e82 | 2026-10-12 |
| Approved the FY 2025/26 budget rebalancing plan | City Council Approves Budget Rebalancing (City of Fremont, Feb 13, 2026) | https://www.fremont.gov/Home/Components/News/News/1665/1067 | 2026-10-12 |
| Adopted the FY 2025/26 Operating Budget | Community Message from the City Manager on the FY 2025/26 Operating Budget | https://www.fremont.gov/home/showpublisheddocument/18479/638868997000130000 | 2026-10-12 |

## Council roster (`shared/data/council.json`)

| Source | Address | Retrieved |
| --- | --- | --- |
| Mayor & City Council (City of Fremont) | https://www.fremont.gov/government/mayor-city-council | 2026-10-12 |
| District Locator (linked, not copied) | https://city.fremont.gov/locatedistrict | 2026-10-12 |

## ZIP code areas (`shared/data/zips.json`)

| Source | Address | Retrieved |
| --- | --- | --- |
| U.S. Census Bureau 2024 Gazetteer, ZIP Code Tabulation Areas | https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_zcta_national.zip | 2026-10-12 |

Latitude and longitude are the Census internal point of each ZIP Code Tabulation Area. Area names are a plain-language guide: ZIP boundaries do not follow neighborhood or council-district lines exactly. 94537 is a post-office-box ZIP (the City's own mailing address uses it) with no land area, so it maps to Fremont City Hall.

## Community Board starter posts (`shared/data/posts.json`)

3 posts written for this project so the board is not empty. They are not from residents. Each has `is_sample: true` and is labeled "Starter post by ReSource" in the app; they are left out of the post count on Home.

## Not from a public source

- **Map tiles**: OpenStreetMap, on the web only. Phones use Apple Maps or Google Maps.
- **Chat answers**: written by a model (or by the keyword lookup in basic mode) from the rows above only. The model is told to use nothing else.
- **Reports, posts, votes and feedback**: written by people using the app. Reports are counted publicly only after a moderator verifies them.

## Keeping it current

Sources change. Before a public launch, and every month after, open each address above, compare it with the row, and update `retrieved`. A source that has moved or changed should be fixed in `shared/data/` and in `backend/database/seed.sql` (regenerate it with `backend/scripts/build_seed.py`).
