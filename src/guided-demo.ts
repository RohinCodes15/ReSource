import { allocate } from "./allocation";
import { financialProjection } from "./finance";
import { inventorySchema, organizationSchema, requestSchema } from "./domain";

// This fixture is deliberately separate from the database and cannot persist changes.
export const guidedRequest = requestSchema.parse({
  id: "guided-request", organizationId: "guided-school", requesterId: "guided-teacher",
  title: "Scientific calculators for a fictional algebra class", resourceType: "SCIENTIFIC_CALCULATOR",
  quantity: 25, quantityFulfilled: 0, minimumCondition: "GOOD", replacementCostCents: 1500,
  urgency: 5, neededBy: "2026-10-18T12:00:00Z", status: "OPEN",
});
export const guidedOrganizations = organizationSchema.array().parse([
  {id:"guided-school",name:"Cedar Learning Center (fictional)",latitude:37.56,longitude:-122.00},
  {id:"guided-a",name:"Orchard School (fictional)",latitude:37.53,longitude:-121.95},
  {id:"guided-b",name:"Maple Community Hub (fictional)",latitude:37.58,longitude:-121.97},
  {id:"guided-c",name:"Learning Commons (fictional)",latitude:37.55,longitude:-121.98},
]);
export const guidedInventory = inventorySchema.array().parse([
  {id:"guided-stock-a",organizationId:"guided-a",title:"Scientific calculators · Lot A",resourceType:"SCIENTIFIC_CALCULATOR",quantity:10,quantityReserved:0,condition:"GOOD",status:"ACTIVE"},
  {id:"guided-stock-b",organizationId:"guided-b",title:"Scientific calculators · Lot B",resourceType:"SCIENTIFIC_CALCULATOR",quantity:12,quantityReserved:0,condition:"NEW",status:"ACTIVE"},
  {id:"guided-stock-c",organizationId:"guided-c",title:"Scientific calculators · Lot C",resourceType:"SCIENTIFIC_CALCULATOR",quantity:8,quantityReserved:0,condition:"GOOD",status:"ACTIVE"},
]);
export const guidedPlan = allocate(guidedRequest, guidedInventory, guidedOrganizations, new Date("2026-10-08T12:00:00Z"));
export const guidedFinancials = financialProjection(25, 25, guidedRequest.replacementCostCents);

export const guidedSteps = [
  {title:"A teacher submits a request",detail:"A fictional algebra teacher requests 25 scientific calculators in at least good condition."},
  {title:"The catalog checks compatibility",detail:"Only scientific calculators qualify. Graphing and basic calculators are not silently substituted."},
  {title:"The planner builds a coverage-first allocation",detail:"The deterministic planner covers the need while minimizing the number of providers; quality and proximity break ties."},
  {title:"A coordinator reviews the estimate",detail:"25 units × $15 estimated replacement cost = $375 potential gross avoided purchasing cost—not a confirmed saving."},
  {title:"Separate proposals are prepared",detail:"The plan creates one local proposal per provider so each partner can decide independently."},
  {title:"Providers approve their proposals",detail:"In this simulation, each fictional provider approves its proposed quantity. No database or real inventory is changed."},
  {title:"Approved quantities are reserved",detail:"Reservations are shown as local demo state only; the live workspace uses a separate authenticated PostgreSQL flow."},
  {title:"The recipient confirms delivery",detail:"The fictional recipient confirms all proposed units arrived. This simulated receipt changes no persistent records."},
  {title:"A coordinator verifies avoided cost",detail:"The fictional coordinator records the scenario's $375 estimate as verified for demonstration purposes only."},
  {title:"The impact dashboard updates",detail:"The demo distinguishes potential value, simulated completed transfer value, and simulated verified gross value."},
];
