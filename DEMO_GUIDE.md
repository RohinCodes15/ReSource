# ReSource judge demo guide

## Before presenting

Run `npm install`, then `npm run dev` and open the local URL printed by Next.js. No PostgreSQL database, sign-in, OAuth configuration, or external account is needed for the public demo. Use **Guided demo** or `/demo`. The rest of the public sample screens are reachable from the sidebar. All institutions, people, inventory, activity, and financial figures are fictional. Do not describe the sample scenario as a partnership with Fremont Unified or any real organization.

The guided flow changes component state in the browser only. It does not call the live transfer API, create records, or persist a result. The Reset demo button returns the walkthrough to step one.

## Three-minute storyboard and talk track

**0:00–0:20 — The problem.** “Schools may have useful supplies while other classrooms are trying to meet needs. ReSource is a concept for making those needs and compatible surplus easier to discover, with a transparent handoff.” Point out that the sample community is fictional.

**0:20–0:45 — The request.** Start the guided demo. “A fictional algebra teacher requests 25 scientific calculators in at least good condition. Resource types are exact: the matcher will not substitute a basic or graphing calculator just because the name sounds similar.”

**0:45–1:15 — The recommendation.** Advance to the provider plan. “The matching score explains compatibility, quantity, condition, location, urgency, and estimated benefit. Separately, the allocation planner maximizes coverage, then minimizes provider count. Here it uses all three lots: 12, 10, and 3 units. The score ranks options; it is not a probability, and the allocation is a heuristic with documented limits.”

**1:15–1:45 — Consent and handoff.** Show the separate proposals and fictional provider approvals. “Each provider decides independently. In this guided version, these are simulated clicks and inventory reservations only. The actual authenticated workspace is a separate PostgreSQL-backed route and has not been verified against a running database in this environment.”

**1:45–2:15 — Receipt and impact.** Continue through simulated receipt and verification. “The $375 is 25 units times a fictional $15 replacement estimate. ReSource keeps potential value, completed transfer value, and a coordinator-entered verified gross amount separate. This walkthrough does not establish that a purchase was avoided.” Optionally edit the demo verification input to show how clearly the figure is identified as a user-entered simulation value.

**2:15–2:40 — Dashboard and alternatives.** Finish the flow, point out its three separate figures, and browse sample requests or inventory. “Recommendations may compete for the same stock, so their values should not be added as if all transfers happened.”

**2:40–3:00 — Close.** “This is an MVP concept and an invitation to evaluate whether the workflow is useful. We have not yet conducted educator validation or demonstrated real savings. Feedback would shape which requirements and safeguards to build next.”

## Known demo boundaries

- `/demo` is browser-only, fictional, deterministic and resettable; it does not persist.
- Public request, inventory and match pages use separate static fixtures.
- `/live` requires correctly configured Auth.js and PostgreSQL. It is not required for the judge walkthrough.
- Recommendations rank candidates; detailed product/model suitability requires human review.
- Distances use fictional coordinates. Do not interpret them as verified school locations.
- The live PostgreSQL workflows and OAuth callback have not been end-to-end tested here.
