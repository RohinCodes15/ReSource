# Interaction audit

Every screen, what each control is meant to do, and whether an automated test presses it. "Verified" means an end-to-end test in `app/e2e/` drives the control in the exported web build against the real API in local mode and checks the result. Last full run: October 13, 2026, 44 tests passing.

Nothing here was verified on a physical phone. The same components run on iOS and Android, but the tests run in a browser.

## By screen

| Screen | Controls and expected behavior | Verified by |
| --- | --- | --- |
| Home | "See my summary" opens What Changed for Me. Seven action cards open their screens. Stat tiles open Service Status, Resource Finder and Report. The latest-update card opens Alerts. Language button opens the language list. Footer links open the policy pages; "Storage settings" opens the storage dialog. | `routes.spec.ts` "home actions and the footer links", "home shows real counts". Not pressed by a test: the stat tiles and the latest-update card. |
| What Changed for Me | Location chip opens the location dialog. Interest chips toggle. "Show what changed" shows an error with no interest chosen, otherwise the summary. Source links open the City document. "See all matching resources" opens Resource Finder with those categories selected. "Print my impact card" opens the print dialog with the one-page card (shares text on phones). | `flows.spec.ts` "what changed for me"; `compliance.spec.ts` axe scan of the summary. Not pressed: "See all matching resources"; the print dialog itself (the test checks the card's contents). |
| Location dialog | "Use my location" asks permission once and reports each failure in words. ZIP field accepts a Fremont ZIP, rejects a bad format and a ZIP outside Fremont. "Use Fremont City Hall" and "Clear my location" reset it. Escape and the close button close it and return focus. | `flows.spec.ts` "location" (five tests), "keyboard". |
| Map | Search, status chips, Map/List switch, recenter, pins, the detail sheet with call, directions, "Find Alternative" and "Report an impact". | `flows.spec.ts` "map". Not pressed: directions and "Report an impact" inside the sheet. |
| Resource Finder | Search, category chips, Saved chip, sort, call, directions, website, share, save. | `flows.spec.ts` "resources". |
| Alerts | Topic and area chips, follow, save changes, stop following, All / For me, mark read, notification switch. | `flows.spec.ts` "alerts". Not pressed: "Add my area"; the email form (hidden: no email is sent, see `docs/PRIVACY.md`). |
| Ask ReSource | Suggestion chips, text field, send, stop, retry, clear, Privacy link. | `flows.spec.ts` three "chat" tests, "language"; `offline.spec.ts`. |
| Service Status | Count tiles filter by status; type and area chips filter; "Show on map" opens the map. | `flows.spec.ts` "status dashboard". Not pressed: the "All" chips and "Show on map" on a row. |
| Report an Impact | Three steps with validation, Back, optional photo with type and size checks, consent and age boxes, submit, receipt, "Report another", "Your reports". | `flows.spec.ts` three "report" tests; `offline.spec.ts`. Not pressed: the two retry buttons after a failed photo upload. |
| Rep Tracker | District Locator link, phone and email links, "Write a letter" dialog with subject, body, open in email, copy. | `flows.spec.ts` "reps". Not typed into: the subject field. |
| Community Board | Post form with validation and consent, sort, vote, report abuse with confirm, delete own post with confirm. | `flows.spec.ts` "community". |
| Budget Transparency | Each chart has "Show as table"; source links open the City document. | `routes.spec.ts` (renders at three widths); table toggle in `flows.spec.ts` "admin". Charts are not interacted with one by one. |
| Community Impact | Totals and charts are public; "Download CSV" appears after the admin passcode. | `flows.spec.ts` "admin". |
| Admin Tools | Passcode, lock, five tabs, verify and reject a report, view its photo, approve and reject a post, change a service status with confirmation, close a deletion request, read feedback. | `flows.spec.ts` "admin" covers passcode, verify, status change with confirmation, CSV, lock. Not pressed: reject, view photo, post approve and reject, cancel in the confirmation, the Feedback tab. |
| Settings | Text size, language, location, storage settings, download my data, delete my data, clear this device, feedback form. | `flows.spec.ts` "settings", "language". Not pressed: "Clear my location" here, the sign-in button (hidden unless accounts are configured). |
| Sign in | Email field, consent, send link, sign out. | Not verified: it needs a Supabase project. The screen's "sign-in is turned off" state renders in `routes.spec.ts`. |
| Data Deletion Request | Who is asking, email, details, consent, send, receipt. | `flows.spec.ts` "data deletion request form". |
| Storage banner and dialog | Accept all, Reject all, Manage preferences, save choice. | `compliance.spec.ts` "storage banner", "Reject all". |
| Under-13 mode | "I am under 13" replaces every form with a browse-only notice. | `flows.spec.ts` "under 13". |
| Tab bar, header, More | Six tabs, Back, every More row. | `routes.spec.ts` "tab bar", "every row on the More screen". |
| Offline banner | Appears when the API cannot be reached; screens show the saved copy. | `offline.spec.ts`. Not pressed: "Try again" in the banner. |
| Unknown address | Shows a not-found screen with a Home button. | `routes.spec.ts`. |

## Every test id

176 of the 264 test ids in the app appear in an end-to-end test. Many of the rest are containers (a screen's outer element), not controls. A few controls are reached through a pattern the check below cannot see, for example the footer links, which a test visits in a loop. The table is generated by searching the test files for each id.

| File | Test id | Exercised by an e2e test |
| --- | --- | --- |
| `app/(tabs)/_layout.tsx` | `header-back` | yes |
| `app/(tabs)/about.tsx` | `about-screen` | no |
| `app/(tabs)/about.tsx` | `about-independent` | no |
| `app/(tabs)/about.tsx` | `about-feedback` | no |
| `app/(tabs)/admin.tsx` | `photo-${id}` | no |
| `app/(tabs)/admin.tsx` | `view-photo-${id}` | no |
| `app/(tabs)/admin.tsx` | `admin-report-${report.id}` | yes |
| `app/(tabs)/admin.tsx` | `verify-${report.id}` | yes |
| `app/(tabs)/admin.tsx` | `reject-${report.id}` | no |
| `app/(tabs)/admin.tsx` | `admin-post-${post.id}` | no |
| `app/(tabs)/admin.tsx` | `approve-${post.id}` | no |
| `app/(tabs)/admin.tsx` | `reject-post-${post.id}` | no |
| `app/(tabs)/admin.tsx` | `confirm-status-sheet` | no |
| `app/(tabs)/admin.tsx` | `confirm-status` | yes |
| `app/(tabs)/admin.tsx` | `cancel-status` | no |
| `app/(tabs)/admin.tsx` | `admin-service-${service.id}` | yes |
| `app/(tabs)/admin.tsx` | `set-${service.id}-${status}` | yes |
| `app/(tabs)/admin.tsx` | `admin-feedback-${item.id}` | no |
| `app/(tabs)/admin.tsx` | `admin-screen` | no |
| `app/(tabs)/admin.tsx` | `admin-notice` | yes |
| `app/(tabs)/alerts.tsx` | `alerts-screen` | no |
| `app/(tabs)/alerts.tsx` | `alert-preferences` | yes |
| `app/(tabs)/alerts.tsx` | `topic-${category}` | yes |
| `app/(tabs)/alerts.tsx` | `area-${area}` | yes |
| `app/(tabs)/alerts.tsx` | `use-my-area` | no |
| `app/(tabs)/alerts.tsx` | `subscribe` | yes |
| `app/(tabs)/alerts.tsx` | `unsubscribe` | yes |
| `app/(tabs)/alerts.tsx` | `notify-toggle` | yes |
| `app/(tabs)/alerts.tsx` | `email-input` | no |
| `app/(tabs)/alerts.tsx` | `email-subscribe` | no |
| `app/(tabs)/alerts.tsx` | `alerts-notice` | yes |
| `app/(tabs)/alerts.tsx` | `mark-all-read` | yes |
| `app/(tabs)/alerts.tsx` | `unread-count` | yes |
| `app/(tabs)/alerts.tsx` | `alert-${alert.id}` | yes |
| `app/(tabs)/alerts.tsx` | `mark-read-${alert.id}` | yes |
| `app/(tabs)/budget.tsx` | `budget-screen` | no |
| `app/(tabs)/budget.tsx` | `headline-${item.id}` | yes |
| `app/(tabs)/budget.tsx` | `chart-reductions` | no |
| `app/(tabs)/budget.tsx` | `chart-positions` | no |
| `app/(tabs)/budget.tsx` | `chart-shares` | no |
| `app/(tabs)/budget.tsx` | `chart-reserves` | no |
| `app/(tabs)/chat.tsx` | `suggestion-${key.slice(-2)}` | yes |
| `app/(tabs)/chat.tsx` | `chat-error` | no |
| `app/(tabs)/chat.tsx` | `chat-input` | yes |
| `app/(tabs)/chat.tsx` | `chat-stop` | yes |
| `app/(tabs)/chat.tsx` | `chat-send` | yes |
| `app/(tabs)/chat.tsx` | `chat-screen` | no |
| `app/(tabs)/chat.tsx` | `chat-notice` | yes |
| `app/(tabs)/chat.tsx` | `chat-emergency` | yes |
| `app/(tabs)/chat.tsx` | `chat-clear` | yes |
| `app/(tabs)/chat.tsx` | `chat-failed` | yes |
| `app/(tabs)/chat.tsx` | `chat-retry` | yes |
| `app/(tabs)/chat.tsx` | `chat-sources` | yes |
| `app/(tabs)/community.tsx` | `community-screen` | no |
| `app/(tabs)/community.tsx` | `post-form` | no |
| `app/(tabs)/community.tsx` | `post-body` | yes |
| `app/(tabs)/community.tsx` | `post-area-${code}` | no |
| `app/(tabs)/community.tsx` | `post-submit` | yes |
| `app/(tabs)/community.tsx` | `community-notice` | yes |
| `app/(tabs)/community.tsx` | `post-${post.id}` | yes |
| `app/(tabs)/community.tsx` | `vote-${post.id}` | yes |
| `app/(tabs)/community.tsx` | `votes-${post.id}` | yes |
| `app/(tabs)/community.tsx` | `delete-${post.id}` | yes |
| `app/(tabs)/community.tsx` | `flag-${post.id}` | yes |
| `app/(tabs)/community.tsx` | `confirm-sheet` | no |
| `app/(tabs)/community.tsx` | `confirm-yes` | yes |
| `app/(tabs)/community.tsx` | `confirm-no` | yes |
| `app/(tabs)/cookies.tsx` | `cookies-screen` | no |
| `app/(tabs)/cookies.tsx` | `cookies-open-settings` | yes |
| `app/(tabs)/cookies.tsx` | `storage-${entry.i18n}` | yes |
| `app/(tabs)/credits.tsx` | `credits-screen` | no |
| `app/(tabs)/data-request.tsx` | `data-request-done` | yes |
| `app/(tabs)/data-request.tsx` | `data-request-screen` | no |
| `app/(tabs)/data-request.tsx` | `request-self` | no |
| `app/(tabs)/data-request.tsx` | `request-parent` | yes |
| `app/(tabs)/data-request.tsx` | `request-email` | yes |
| `app/(tabs)/data-request.tsx` | `request-details` | yes |
| `app/(tabs)/data-request.tsx` | `request-consent` | yes |
| `app/(tabs)/data-request.tsx` | `request-submit` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-screen` | yes |
| `app/(tabs)/for-me.tsx` | `interest-${interest}` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-error` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-show` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-results` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-section-${section.key}` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-nodata-${section.key}` | no |
| `app/(tabs)/for-me.tsx` | `for-me-nochange-${section.key}` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-${service.id}` | yes |
| `app/(tabs)/for-me.tsx` | `for-me-resources-${section.key}` | no |
| `app/(tabs)/for-me.tsx` | `for-me-card` | yes |
| `app/(tabs)/impact.tsx` | `impact-export` | yes |
| `app/(tabs)/impact.tsx` | `impact-offline` | no |
| `app/(tabs)/impact.tsx` | `impact-dashboard` | yes |
| `app/(tabs)/impact.tsx` | `impact-verified` | no |
| `app/(tabs)/impact.tsx` | `impact-pending` | no |
| `app/(tabs)/impact.tsx` | `impact-by-level` | no |
| `app/(tabs)/impact.tsx` | `impact-by-service` | yes |
| `app/(tabs)/impact.tsx` | `impact-by-area` | no |
| `app/(tabs)/impact.tsx` | `impact-screen` | no |
| `app/(tabs)/index.tsx` | `home-screen` | yes |
| `app/(tabs)/index.tsx` | `independent-notice` | yes |
| `app/(tabs)/index.tsx` | `home-for-me` | no |
| `app/(tabs)/index.tsx` | `home-action-forMe` | yes |
| `app/(tabs)/index.tsx` | `home-stats` | no |
| `app/(tabs)/index.tsx` | `stat-reduced` | no |
| `app/(tabs)/index.tsx` | `stat-tracked` | yes |
| `app/(tabs)/index.tsx` | `stat-resources` | yes |
| `app/(tabs)/index.tsx` | `stat-reports` | yes |
| `app/(tabs)/index.tsx` | `latest-alert` | no |
| `app/(tabs)/index.tsx` | `home-action-${action.key}` | yes |
| `app/(tabs)/map.tsx` | `service-detail` | yes |
| `app/(tabs)/map.tsx` | `find-alternative` | yes |
| `app/(tabs)/map.tsx` | `detail-call` | yes |
| `app/(tabs)/map.tsx` | `detail-directions` | no |
| `app/(tabs)/map.tsx` | `detail-report` | no |
| `app/(tabs)/map.tsx` | `map-search` | yes |
| `app/(tabs)/map.tsx` | `map-search-clear` | yes |
| `app/(tabs)/map.tsx` | `map-filter-${value}` | yes |
| `app/(tabs)/map.tsx` | `map-list-only` | no |
| `app/(tabs)/map.tsx` | `map-recenter` | yes |
| `app/(tabs)/map.tsx` | `map-count` | yes |
| `app/(tabs)/map.tsx` | `map-screen` | no |
| `app/(tabs)/map.tsx` | `service-${item.id}` | yes |
| `app/(tabs)/map.tsx` | `service-sheet` | no |
| `app/(tabs)/more.tsx` | `more-screen` | no |
| `app/(tabs)/more.tsx` | `more-${item.title}` | yes |
| `app/(tabs)/privacy.tsx` | `privacy-screen` | no |
| `app/(tabs)/report.tsx` | `my-reports` | yes |
| `app/(tabs)/report.tsx` | `report-success` | yes |
| `app/(tabs)/report.tsx` | `report-receipt` | yes |
| `app/(tabs)/report.tsx` | `photo-retry` | no |
| `app/(tabs)/report.tsx` | `report-another` | yes |
| `app/(tabs)/report.tsx` | `report-screen` | no |
| `app/(tabs)/report.tsx` | `report-step-title` | yes |
| `app/(tabs)/report.tsx` | `service-option-${option.id}` | yes |
| `app/(tabs)/report.tsx` | `other-service` | yes |
| `app/(tabs)/report.tsx` | `step-error` | yes |
| `app/(tabs)/report.tsx` | `report-area-${code}` | yes |
| `app/(tabs)/report.tsx` | `report-description` | yes |
| `app/(tabs)/report.tsx` | `remove-photo` | yes |
| `app/(tabs)/report.tsx` | `add-photo` | yes |
| `app/(tabs)/report.tsx` | `impact-${level}` | yes |
| `app/(tabs)/report.tsx` | `report-failure` | yes |
| `app/(tabs)/report.tsx` | `report-retry` | no |
| `app/(tabs)/report.tsx` | `report-back` | yes |
| `app/(tabs)/report.tsx` | `report-next` | yes |
| `app/(tabs)/report.tsx` | `report-submit` | yes |
| `app/(tabs)/reptracker.tsx` | `letter-sheet` | yes |
| `app/(tabs)/reptracker.tsx` | `letter-subject` | no |
| `app/(tabs)/reptracker.tsx` | `letter-body` | yes |
| `app/(tabs)/reptracker.tsx` | `letter-email` | yes |
| `app/(tabs)/reptracker.tsx` | `letter-copy` | yes |
| `app/(tabs)/reptracker.tsx` | `vote-${vote.id}` | yes |
| `app/(tabs)/reptracker.tsx` | `vote-record` | no |
| `app/(tabs)/reptracker.tsx` | `reps-screen` | no |
| `app/(tabs)/reptracker.tsx` | `district-locator` | yes |
| `app/(tabs)/reptracker.tsx` | `member-${member.id}` | yes |
| `app/(tabs)/reptracker.tsx` | `write-${member.id}` | yes |
| `app/(tabs)/reptracker.tsx` | `call-${member.id}` | yes |
| `app/(tabs)/reptracker.tsx` | `email-${member.id}` | yes |
| `app/(tabs)/resources.tsx` | `resource-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `call-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `directions-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `website-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `share-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `save-${item.id}` | yes |
| `app/(tabs)/resources.tsx` | `alternatives-banner` | yes |
| `app/(tabs)/resources.tsx` | `clear-alternatives` | yes |
| `app/(tabs)/resources.tsx` | `resource-search` | yes |
| `app/(tabs)/resources.tsx` | `resource-search-clear` | yes |
| `app/(tabs)/resources.tsx` | `chip-all` | yes |
| `app/(tabs)/resources.tsx` | `chip-saved` | yes |
| `app/(tabs)/resources.tsx` | `chip-${category}` | yes |
| `app/(tabs)/resources.tsx` | `resource-count` | yes |
| `app/(tabs)/resources.tsx` | `resource-notice` | yes |
| `app/(tabs)/resources.tsx` | `resources-screen` | no |
| `app/(tabs)/settings.tsx` | `settings-screen` | no |
| `app/(tabs)/settings.tsx` | `settings-notice` | yes |
| `app/(tabs)/settings.tsx` | `settings-clear-location` | no |
| `app/(tabs)/settings.tsx` | `storage-choice` | no |
| `app/(tabs)/settings.tsx` | `open-storage-settings` | no |
| `app/(tabs)/settings.tsx` | `download-data` | yes |
| `app/(tabs)/settings.tsx` | `delete-data` | yes |
| `app/(tabs)/settings.tsx` | `clear-device` | yes |
| `app/(tabs)/settings.tsx` | `go-sign-in` | no |
| `app/(tabs)/settings.tsx` | `feedback-form` | no |
| `app/(tabs)/settings.tsx` | `feedback-${value}` | yes |
| `app/(tabs)/settings.tsx` | `feedback-message` | yes |
| `app/(tabs)/settings.tsx` | `feedback-send` | yes |
| `app/(tabs)/settings.tsx` | `confirm-delete` | yes |
| `app/(tabs)/settings.tsx` | `confirm-delete-yes` | yes |
| `app/(tabs)/settings.tsx` | `confirm-delete-no` | yes |
| `app/(tabs)/sign-in.tsx` | `sign-in-screen` | no |
| `app/(tabs)/sign-in.tsx` | `sign-in-off` | no |
| `app/(tabs)/sign-in.tsx` | `sign-in-web-only` | no |
| `app/(tabs)/sign-in.tsx` | `sign-out` | no |
| `app/(tabs)/sign-in.tsx` | `sign-in-email` | no |
| `app/(tabs)/sign-in.tsx` | `sign-in-send` | no |
| `app/(tabs)/status.tsx` | `status-screen` | no |
| `app/(tabs)/status.tsx` | `status-counts` | no |
| `app/(tabs)/status.tsx` | `count-${s}` | yes |
| `app/(tabs)/status.tsx` | `status-chart` | no |
| `app/(tabs)/status.tsx` | `recent-${s.id}` | yes |
| `app/(tabs)/status.tsx` | `status-cat-all` | no |
| `app/(tabs)/status.tsx` | `status-cat-${key}` | yes |
| `app/(tabs)/status.tsx` | `status-area-all` | no |
| `app/(tabs)/status.tsx` | `status-area-${key}` | yes |
| `app/(tabs)/status.tsx` | `status-count` | yes |
| `app/(tabs)/status.tsx` | `status-row-${s.id}` | no |
| `app/(tabs)/terms.tsx` | `terms-screen` | no |
| `app/+not-found.tsx` | `not-found` | yes |
| `app/+not-found.tsx` | `go-home` | yes |
| `app/_layout.tsx` | `offline-banner` | yes |
| `app/_layout.tsx` | `offline-retry` | no |
| `components/AdminGate.tsx` | `admin-not-set-up` | no |
| `components/AdminGate.tsx` | `admin-gate` | yes |
| `components/AdminGate.tsx` | `admin-passcode` | yes |
| `components/AdminGate.tsx` | `admin-unlock` | yes |
| `components/AdminGate.tsx` | `admin-lock` | yes |
| `components/Charts.tsx` | `data-table` | yes |
| `components/Charts.tsx` | `toggle-table` | yes |
| `components/ConsentFields.tsx` | `browse-only` | yes |
| `components/ConsentFields.tsx` | `consent-fields` | yes |
| `components/ConsentFields.tsx` | `consent-checkbox` | yes |
| `components/ConsentFields.tsx` | `consent-privacy-link` | no |
| `components/ConsentFields.tsx` | `age-checkbox` | yes |
| `components/ConsentFields.tsx` | `under-13` | yes |
| `components/ConsentFields.tsx` | `honeypot` | no |
| `components/CookieBanner.tsx` | `cookie-banner` | yes |
| `components/CookieBanner.tsx` | `cookie-policy-link` | no |
| `components/CookieBanner.tsx` | `cookie-accept` | yes |
| `components/CookieBanner.tsx` | `cookie-reject` | yes |
| `components/CookieBanner.tsx` | `cookie-manage` | yes |
| `components/CookieBanner.tsx` | `cookie-preferences` | yes |
| `components/CookieBanner.tsx` | `cookie-optional-toggle` | yes |
| `components/CookieBanner.tsx` | `cookie-save` | yes |
| `components/LanguageSelector.tsx` | `language-${option.code}` | yes |
| `components/LanguageSelector.tsx` | `language-button` | yes |
| `components/LanguageSelector.tsx` | `language-sheet` | no |
| `components/LocationChip.tsx` | `location-sheet` | yes |
| `components/LocationChip.tsx` | `location-notice` | yes |
| `components/LocationChip.tsx` | `use-gps` | yes |
| `components/LocationChip.tsx` | `zip-input` | yes |
| `components/LocationChip.tsx` | `use-zip` | yes |
| `components/LocationChip.tsx` | `use-center-offer` | yes |
| `components/LocationChip.tsx` | `use-center` | yes |
| `components/LocationChip.tsx` | `clear-location` | yes |
| `components/LocationChip.tsx` | `location-chip` | yes |
| `components/LocationChip.tsx` | `location-label` | yes |
| `components/Page.tsx` | `footer` | yes |
| `components/Page.tsx` | `footer-about` | no |
| `components/Page.tsx` | `footer-privacy` | yes |
| `components/Page.tsx` | `footer-terms` | yes |
| `components/Page.tsx` | `footer-cookies` | no |
| `components/Page.tsx` | `footer-storage-settings` | yes |
| `components/Page.tsx` | `footer-credits` | no |
| `components/ServiceMap.tsx` | `service-map` | no |
| `components/Sheet.tsx` | `sheet-backdrop` | no |
| `components/Sheet.tsx` | `sheet-close` | yes |
| `components/ui.tsx` | `loading` | yes |
| `components/ui.tsx` | `empty-state` | yes |
| `components/ui.tsx` | `error-state` | yes |
| `components/ui.tsx` | `retry` | yes |
| `components/ui.tsx` | `segment-${option.value}` | yes |
