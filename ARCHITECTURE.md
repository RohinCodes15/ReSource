# Phase 3 architecture

## Phase 4 persistence and security

The read-only Phase 3 demo remains separate from /live. /live and /api/live resolve an
Auth.js session on the server and look up the current user by a pre-provisioned GitHub
provider subject. Email is never used as proof of role. An administrator authorizes
members and organizations; public self-registration cannot grant access.
Auth.js manages signed, HTTP-only session cookies and GitHub OAuth. No application
passwords or persistent credentials are stored.

The dedicated local fictional mode uses Auth.js Credentials only when development mode,
DEMO_MODE=true, DEMO_DATABASE=true and a localhost database name containing "demo" all hold.
Its selectable identities map to seeded fictional users. It cannot run in production mode.
Real organization data must not be copied into that database.

All live writes pass through /api/live, which validates a discriminated command with Zod,
loads the current member from PostgreSQL, checks capability and ownership, then calls
src/live.ts. The UI cannot supply a role or organization ID for normal creation.
Admin provisioning is separately authorized. The live response includes only the
current organization's requests, inventory and transfers; available external stock
exposes resource details but not user contact information.

### Reservation transaction

Inventory.quantity is units still physically on hand; quantityReserved is the part
committed to approved transfers. Available = quantity − quantityReserved.
Request.quantityFulfilled is received units; quantityReserved is approved but not
received. Open demand = quantity − quantityFulfilled − quantityReserved.

Approval uses Prisma's PostgreSQL Serializable transaction. It rereads request, stock
and proposal, checks exact type/condition, deadline, positive free stock and uncommitted
demand. Conditional updateMany filters compare id, version and previously read quantities.
Both counters and transfer status change in the same transaction. A concurrent change
causes one attempt to abort or update zero rows; serialization conflicts are retried.
For 10 available units, concurrent approvals for 8 and 7 cannot both commit:
the second attempt sees at most 2 free units and remains proposed.
The database migration adds CHECK constraints for nonnegative quantities and upper bounds.
Only a real PostgreSQL concurrency test can establish runtime behavior.

Cancellation of APPROVED decrements both reservations. Completion decrements physical
stock and its reservation, increments fulfilled quantity, and marks COMPLETED once.
PROPOSED → DECLINED/CANCELLED does not change counters. Status checks make repeated
approval/completion/cancellation safe when the status already reached the same target;
other transitions fail. Each transition writes an audit event.
Unique proposal idempotency keys and unique per-transfer verification records add
duplicate protection.

SavingsVerification is a separate record referencing a completed transfer, verified
quantity, gross avoided purchase cost, verifier and date. The coordinator must belong
to the recipient organization and cannot verify more units than arrived.
Potential dashboard value de-duplicates proposals against currently available stock
and demand in creation order. It is still a projection, and it can change before approval.
Completed value uses transfer-line price snapshots. Verified gross value uses explicit
verification records; no net-savings claim is made.

The existing Next.js pages, Prisma schema, read-only APIs and shared Workspace shell remain in use.
The new /matches page hosts a client-side MatchExplorer for immediate what-if feedback using fictional fixtures.

Data flow: validated fixture + request selection + hypothetical overrides → allocate → eligible ranked matches,
provider-grouped proposal lines and financial projection → accessible controls and result cards.

- src/domain.ts: Zod input contracts and inferred types.
- src/catalog.ts: exact type/category relationship; category never authorizes substitution.
- src/matching.ts: existing hard eligibility filters, normalized score and explanations.
- src/allocation.ts: validated hypothetical overrides, duplicate rejection and provider allocation.
- src/finance.ts: checked integer-cent projections based on remaining need.
- src/demo.ts: clearly fictional fixtures and fixed evaluation date.
- app/matches/explorer.tsx: input state, errors, exclusions, reset and calculated output.

There are no writes in the simulation. No authentication or private data is involved in the demo.
Prisma remains a persistence foundation; the UI reads fixtures and the seed is optional.
The allocator is independently callable from a future server endpoint without React or browser dependencies.
Do not expose real/private inventories in a client bundle: future authenticated endpoints must enforce organization access.

Phase 4: authentication, scoped CRUD, PostgreSQL migrations/check constraints, atomic reservations,
approval/cancellation/completion transitions, audit events, concurrent-request tests and evidence-based confirmed savings.
Proposal generation cannot guarantee stock will remain available until reservation.
Real location data and detailed resource specifications need verification before deployment.
