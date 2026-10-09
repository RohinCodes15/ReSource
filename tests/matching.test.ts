import { describe, expect, it } from "vitest";
import { DEMO_DATE, inventory, organizations, requests } from "../src/demo";
import { distanceMiles, estimatedSavings, matchRequest, WEIGHTS } from "../src/matching";
import { inventorySchema, requestSchema } from "../src/domain";
const request = requests[0], item = inventory[0];
const match = (r = request, i = item) => matchRequest(r,i,organizations,DEMO_DATE);
describe("matching", () => {
  it("scores from six explained contributions", () => {
    expect(Object.values(WEIGHTS).reduce((a,b)=>a+b,0)).toBe(100);
    const result = match()!;
    expect(result.factors).toHaveLength(6);
    expect(result.score).toBe(Math.round(result.factors.reduce((sum,f)=>sum+f.points,0)));
    expect(result.score).toBeGreaterThan(0); expect(result.score).toBeLessThanOrEqual(100);
  });
  it("rejects incompatible type and condition", () => {
    expect(match(request,inventory[2])).toBeNull();
    expect(match(request,{...item,condition:"FAIR"})).toBeNull();
  });
  it("caps partial matches at available and remaining quantities", () => {
    expect(match()!.units).toBe(18);
    expect(match(request,{...item,quantityReserved:3})!.units).toBe(15);
    expect(match({...request,quantityFulfilled:20})!.units).toBe(4);
  });
  it("rejects exhausted, closed, fulfilled, withdrawn and expired records", () => {
    expect(match(request,{...item,quantityReserved:item.quantity})).toBeNull();
    expect(match({...request,status:"CLOSED"})).toBeNull();
    expect(match({...request,quantityFulfilled:24})).toBeNull();
    expect(match(request,{...item,status:"WITHDRAWN"})).toBeNull();
    expect(match({...request,neededBy:"2026-10-01T12:00:00Z"})).toBeNull();
  });
  it("rejects same-organization transfers", () => {
    expect(match(request,{...item,organizationId:request.organizationId})).toBeNull();
  });
  it("increases scores with urgency and near deadlines", () => {
    expect(match({...request,urgency:5})!.score).toBeGreaterThan(match({...request,urgency:1})!.score);
    expect(match({...request,neededBy:"2026-10-09T12:00:00Z"})!.score).toBeGreaterThan(match({...request,neededBy:"2026-11-30T12:00:00Z"})!.score);
  });
  it("is deterministic", () => { expect(match()).toEqual(match()); });
  it("requires organization locations", () => {
    expect(()=>matchRequest(request,item,[],DEMO_DATE)).toThrow("Missing organization");
  });
});
describe("money and validation", () => {
  it("uses exact integer cents", () => {
    expect(match()!.savingsCents).toBe(153000); expect(estimatedSavings(3,199)).toBe(597); expect(estimatedSavings(0,199)).toBe(0);
  });
  it("rejects negative, fractional and unsafe monetary values", () => {
    for (const n of [-1,.5,NaN,Infinity]) expect(()=>estimatedSavings(n,100)).toThrow();
    expect(()=>estimatedSavings(Number.MAX_SAFE_INTEGER,2)).toThrow();
  });
  it("rejects invalid quantities, cost, priority and dates", () => {
    expect(inventorySchema.safeParse({...item,quantityReserved:100}).success).toBe(false);
    for (const change of [{quantityFulfilled:100},{replacementCostCents:-1},{urgency:6},{neededBy:"invalid"}])
      expect(requestSchema.safeParse({...request,...change}).success).toBe(false);
  });
  it("uses great-circle distance", () => {
    expect(distanceMiles(organizations[0],organizations[0])).toBe(0);
    expect(distanceMiles({...organizations[0],latitude:0,longitude:0},{...organizations[1],latitude:0,longitude:1})).toBeCloseTo(69.09,1);
  });
});
