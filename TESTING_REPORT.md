# Phase 8 testing and audit report

Date: October 8, 2026. This report records checks run in this environment; it is not a product certification.

## Audit findings and work completed

- The root route previously opened on a demo dashboard and did not present the requested project introduction. Added the requested headline and a public landing page, and moved the metrics dashboard to `/dashboard`.
- There was no cohesive no-account end-to-end walkthrough. Added `/demo`, a 10-step guided simulation built on the typed allocator with a separate fictional 25-calculator scenario, per-provider proposal display, reset, progress state, and explicit browser-only/no-persistence notices.
- Potential estimate, completed transfer value, and verified gross value are labeled separately in the simulated final summary. The default calculation is 25 × $15 = $375. This remains fictional and does not claim actual savings.
- Added demo test coverage, feedback questionnaire/plan, three-minute story, submission checklist, deployment checklist, and this report.
- Hardened the integration runner with an explicit local-test opt-in, strict PostgreSQL URL/host/database-name validation, and exact environment URL matching. Expanded the integration suite with the requested 20/15/10 workflow and five repeated 8+7 concurrent approvals against 10 units.
- Added the standard `npm start` production server command and aligned local demo sign-in visibility with Auth.js's exact localhost database check.
- The first real database run exposed an order-dependent assertion: its impact snapshot included a transfer completed by an earlier test. The test now checks before/after impact deltas. The complete PostgreSQL suite subsequently passed against the isolated local database.

## Checks actually run

Before Phase 5 implementation, the following baseline passed: 29 unit tests across four test files; TypeScript; ESLint; Prisma schema validation. Three PostgreSQL integration tests were skipped because no isolated local PostgreSQL test server was configured. A temporary embedded PostgreSQL attempt was blocked by this environment's shared-memory restriction. These baseline results predate the Phase 5 code and do not certify it.

Phase 8: the user ran the guarded `npm run test:integration` from regular Mac Terminal against PostgreSQL 16.15 and the new `resource_phase8_test_20261008` database, owned by the dedicated non-superuser test role. The first run applied the migration and passed 4/5 tests; the only failure was the test-order-dependent cumulative impact assertion described above. After changing assertions to compare per-test deltas, a second guarded run reported **5/5 integration tests passed**. It verified persisted request/inventory writes and ownership rejection; atomic approval and idempotency; cancellation releasing reservations; 20-request/15-stock/10-unit approval, receipt and decrement; unauthorized approval/completion rejection; repeated completion/cancellation guards; request fulfillment bounds; multi-lot completion and separately verified savings; and five repeated concurrent 8+7 proposals against 10 units without overbooking. The pasted Terminal transcript confirms these results.

After the fix, local checks passed: `npm test` (32 passed; 5 DB tests skipped there because the dedicated suite is run separately), `npm run typecheck`, `npm run lint`, `DATABASE_URL='postgresql://localhost:5432/resource_phase8_test_20261008' npm run db:validate`, and `npm run build`. Combined successful test executions: **37** (32 non-DB + 5 PostgreSQL integration). The integration migration ran only in the new test database. A production-server browser smoke test with `DATABASE_URL`, `TEST_DATABASE_URL`, and the opt-in unset returned `/demo` successfully and visibly included its first step plus the no-database simulation notice.

OAuth sign-in/sign-out and the authenticated live UI were not exercised. No hosted deployment was attempted.

## Limitations and risk

- OAuth provider credentials and an authenticated browser session are still unavailable; successful OAuth and browser-driven `/live` workflows remain unverified.
- The browser-only walkthrough simulates proposal approval, reservation, receipt and verification; it must not be confused with the `/live` database workflow.
- No real educator/user feedback has been collected. The feedback document is a proposed method, not user validation.
- No verified real-world inventory, organization coordinates, transfers, purchasing records, or savings are present.
- The current sample pages are desktop-first app screens; mobile and assistive-technology checks remain manual follow-up work.

## Release recommendation

The no-account fictional walkthrough passed a production-server smoke check without database environment variables. The PostgreSQL transfer domain and concurrency integration suite passed against the isolated local test database. Do not claim OAuth or authenticated browser E2E is verified, and do not deploy until those checks and deployment release gates in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) are addressed. Keep all public sample and simulated values labeled as fictional.
