import { describe, expect, it } from "vitest";
import { guidedFinancials, guidedInventory, guidedOrganizations, guidedPlan, guidedRequest, guidedSteps } from "../src/guided-demo";

describe("guided browser-only demo fixture", () => {
  it("contains ten steps and keeps a 25-unit request within fictional stock", () => {
    expect(guidedSteps).toHaveLength(10);
    expect(guidedPlan.allocated).toBe(25);
    expect(guidedPlan.unmet).toBe(0);
    expect(guidedPlan.lines.reduce((sum,line)=>sum+line.quantity,0)).toBe(25);
    expect(new Set(guidedPlan.lines.map(line=>line.providerId)).size).toBe(3);
  });
  it("shows explainable matches without mutating the fixture", () => {
    const before = structuredClone({guidedInventory,guidedRequest,guidedOrganizations});
    expect(guidedPlan.matches.length).toBeGreaterThan(0);
    expect(guidedPlan.matches.every(match=>match.explanation.length>0 && match.factors.length===6)).toBe(true);
    expect({guidedInventory,guidedRequest,guidedOrganizations}).toEqual(before);
  });
  it("separates the $375 estimate from evidence-backed savings", () => {
    expect(guidedFinancials.potentialAvoidedCostCents).toBe(37_500);
    expect(guidedPlan.financial.matchedValueCents).toBe(37_500);
  });
});
