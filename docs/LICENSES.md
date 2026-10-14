# Licenses

ReSource's own code is released under the MIT License (`LICENSE`), copyright 2026 Rohin Pidathala.

Everything below was read from the installed packages on October 13, 2026 (`package.json` of each npm package, and the package metadata of each Python package). Only direct dependencies are listed; each brings its own dependencies, which were not audited one by one.

## App (npm)

| Package | Version | License |
| --- | --- | --- |
| **dependencies** |  |  |
| @expo-google-fonts/inter | 0.4.2 | MIT AND OFL-1.1 |
| @expo/metro-runtime | 57.0.16 | MIT |
| @expo/vector-icons | 15.1.1 | MIT |
| @react-native-async-storage/async-storage | 2.2.0 | MIT |
| @supabase/supabase-js | 2.117.3 | MIT |
| expo | 57.0.27 | MIT |
| expo-clipboard | 57.0.2 | MIT |
| expo-constants | 57.0.21 | MIT |
| expo-crypto | 57.0.3 | MIT |
| expo-font | 57.0.4 | MIT |
| expo-image-picker | 57.0.20 | MIT |
| expo-linear-gradient | 57.0.2 | MIT |
| expo-linking | 57.0.12 | MIT |
| expo-localization | 57.0.2 | MIT |
| expo-location | 57.0.20 | MIT |
| expo-notifications | 57.0.22 | MIT |
| expo-router | 57.0.25 | MIT |
| expo-status-bar | 57.0.1 | MIT |
| leaflet | 1.9.4 | BSD-2-Clause |
| react | 19.2.3 | MIT |
| react-dom | 19.2.3 | MIT |
| react-native | 0.86.3 | MIT |
| react-native-maps | 1.27.2 | MIT |
| react-native-safe-area-context | 5.7.0 | MIT |
| react-native-screens | 4.26.2 | MIT |
| react-native-web | 0.21.4 | MIT |
| **devDependencies** |  |  |
| @axe-core/playwright | 4.13.0 | MPL-2.0 |
| @playwright/test | 1.64.0 | Apache-2.0 |
| @testing-library/react-native | 14.1.0 | MIT |
| @types/jest | 29.5.14 | MIT |
| @types/leaflet | 1.9.22 | MIT |
| @types/node | 22.20.5 | MIT |
| @types/react | 19.2.18 | MIT |
| eslint | 9.39.5 | MIT |
| eslint-config-expo | 57.0.2 | MIT |
| jest | 29.7.0 | MIT |
| jest-expo | 57.0.5 | MIT |
| serve | 14.2.6 | MIT |
| typescript | 6.0.3 | Apache-2.0 |

`@axe-core/playwright` (MPL-2.0) is a test tool. It is not part of the app that ships.

## API (Python)

| Package | Version installed | License |
| --- | --- | --- |
| fastapi | 0.143.0 | MIT |
| uvicorn | 0.54.0 | BSD-3-Clause |
| anthropic | 1.13.0 | MIT |
| supabase | 2.32.0 | MIT |
| pydantic | 2.14.1 | MIT |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| python-multipart | 0.0.32 | Apache-2.0 |
| pillow | 12.3.0 | MIT-CMU |

## Fonts and icons

| Asset | License | Notes |
| --- | --- | --- |
| Inter (four weights) | SIL Open Font License 1.1 | From `@expo-google-fonts/inter`. The web build uses WOFF2 copies in `app/assets/fonts/`, made with `pyftsubset` (fontTools) and limited to Latin and Vietnamese letters. The OFL allows modified copies. Whether a modified copy may keep the name "Inter" depends on whether the license reserves that name: read the license text in the package before public launch (`docs/HUMAN_TODO.md`). |
| Material Community Icons | Published by the Pictogrammers project; bundled by `@expo/vector-icons` (MIT). The icon set's own license was not read for this audit. | Used for every icon in the app. |
| App icon and splash | Made for this project | Navy `#1B3A6B` and gold `#F5A623`. |

## Maps and data

| Source | License or terms | How ReSource complies |
| --- | --- | --- |
| OpenStreetMap map tiles (web) | Data © OpenStreetMap contributors, Open Database License. The public tile server has a usage policy for light use. | The map shows the attribution. For real traffic set `EXPO_PUBLIC_MAP_TILE_URL` to a hosted tile provider. |
| Leaflet | BSD-2-Clause | Used to draw the web map. |
| Apple Maps and Google Maps (phones) | Each platform's own terms | Through `react-native-maps`. Android needs a Google Maps key (`docs/HUMAN_TODO.md`). |
| City of Fremont documents | Public records | Cited with a link on every figure. Citing them does not imply endorsement. |
| U.S. Census Bureau Gazetteer | Public domain (U.S. government work) | Source of the ZIP code area centers. |
| Organization websites | Facts (names, addresses, phone numbers, hours) | Each listing links to the page it was read from. No text or images were copied. |

## Services

Anthropic (chat answers, when a key is set) and Supabase (database and sign-in, when configured) are used under their own terms of service. Neither is needed to run the app.

## Not checked

- The full dependency tree. Run `npx license-checker --summary` in `app/` and `pip-licenses` in `backend/` for the complete list.
- Whether any dependency's license changed after the versions above.
