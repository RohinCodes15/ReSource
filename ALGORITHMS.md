# Matching, allocation and financial projections

## Phase 4 stateful constraints

The pure Phase 3 allocator still proposes lines without writing inventory. In /live,
the same algorithm receives current database stock with approved reservations removed
from availability. The proposal is tentative until each provider approves its own
transfer. Approval checks global stock and request commitments in a serializable
transaction. Thus a visually valid proposal can be refused if another approval wins
first; the user should refresh and replan.

For 10 units on hand, A's 8-unit approval and B's 7-unit approval both read a snapshot.
Conditional version/quantity filters plus Serializable isolation allow at most one
to commit. The other is retried, sees insufficient stock, and stays PROPOSED.
This is a database invariant rather than a button-disable rule.

Potential savings sums currently feasible proposed quantities once per request and
inventory lot. It is estimated units × snapshotted replacement price. Completed
value uses only received units. A coordinator's separate verification record is the
only source of confirmed gross purchasing cost avoided. These three values must never
be combined into a single total.

## Compatibility before score

The catalog maps exact resource types to categories. A scientific calculator, basic calculator and graphing calculator share a category but are never interchangeable.
We retain the six-factor normalized scoring formula documented in README.md.
Eligibility also requires sufficient condition, active stock, open/nonexpired request, positive free quantity and distinct provider/recipient.
Names are display text, never evidence of compatibility. Detailed model specifications remain a human approval check.
Scores are reproducible for an explicit evaluation time. Demo evaluation uses October 8, 2026.
Distance is Haversine straight-line distance from explicitly fictional demo coordinates.
Missing coordinates fail validation; no guessed distance is substituted. Real deployments must supply verified organization locations or implement an explicit verified city/district fallback.

## Allocation objective

For one request, in priority order:

1. Maximize allocated units, capped at the remaining need.
2. Minimize the number of distinct providers required to supply those units.
3. Use condition and proximity to break equal-capacity provider ties and order lots within a provider.

One provider is treated as one transfer, potentially with multiple inventory lines.
This assumes divisible integer units, compatible stock with no bundle restrictions, and no provider quotas, travel-cost limits or scheduling constraints.

The algorithm validates input and rejects duplicate inventory or organization IDs to prevent double counting.
It filters excluded/ineligible stock, groups lots by provider, and sorts providers by descending compatible free capacity.
Equal-capacity ties use capacity-weighted condition+distance points, then ID.
Within each provider, lots sort by condition+distance points then ID.
Take min(available, remaining target) from each lot until the target is reached.
All sorting happens on new arrays; source records are never changed.

### Why provider count is optimal under this objective

Let capacities be c1 >= c2 >= ... >= cp and T = min(total supply, remaining need).
Choose the smallest k whose first-k capacity sum reaches T.
No other set of k-1 providers can have more capacity than the largest k-1 capacities, which are insufficient.
The first k suffice, so k is the minimum provider count. Partial fulfillment uses the same argument.
This proof does not establish optimal quality, travel expense, delivery schedule or fairness.
For example, a far-away provider with capacity 100 may outrank a nearby provider with capacity 24 for a need of 24.
That is a disclosed limitation of capacity-first selection, not a claimed global quality optimum.

### Worked example

Need: 25 compatible calculators at an estimated $15 each.
Provider capacities: A=10, B=12, C=8. Sorted order: B, A, C.
Allocate B=12, A=10, C=3. Total=25; no inventory is exceeded.
Two largest providers supply only 22, so three providers are necessary.
Requested value = 25 × 1,500 cents = 37,500 cents.
Projected avoided cost is $375. If C is excluded, allocate 22 with 3 unmet:
projected avoided cost $330, unmet replacement value $45, coverage 88%.

The app's default calculator fixture has capacities 18, 10 and 6 with a need of 24.
It allocates 18+6 from the two largest-capacity providers, for a $2,040 estimate at $85/unit.
Changing minimum condition to NEW leaves only 6 eligible units.

## Financial projection and simulation

All amounts use checked safe integer USD cents. Each allocation line is counted once.
The financial denominator is remaining need, excluding units already fulfilled.
Matched replacement value and potential avoided purchasing cost are the same estimate, not additive metrics.
Unfulfilled value = remaining-request value minus matched value; coverage = allocated / remaining × 100.
Zero remaining need reports 100% coverage with zero projected value.
Known handling costs and evidence of actually avoided purchases belong to future confirmed accounting.

Simulation overlays total requested quantity, minimum condition and excluded providers onto a validated copy.
Quantity cannot be below already fulfilled units. Invalid input produces an error rather than stale results.
The exact same matcher, allocator and financial function run again. No database write or reservation occurs.
Several independently evaluated requests may compete for stock; do not sum their projections.

## Complexity and tests

For N lots and O organizations, matching currently searches organization arrays per lot: O(N×O).
Grouping currently copies growing provider arrays, with worst-case O(N²) work; sorting costs O(N log N).
Total worst-case time O(N×O + N² + N log N), space O(N+O).
This bounded demo has only four inventory lots. An indexed organization map and append-based grouping
would reduce scaling costs when real inventories grow.
Tests include exact subtype compatibility, empty supply, condition/provider restrictions, duplicate rejection,
partial/full coverage, finance and no mutation. A deterministic sweep checks 210 quantity/condition combinations.
An exhaustive subset oracle verifies the minimum-provider objective for the demo capacities.
