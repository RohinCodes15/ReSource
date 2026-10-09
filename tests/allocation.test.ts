import { describe,it,expect } from "vitest";
import { allocate } from "../src/allocation";
import { financialProjection } from "../src/finance";
import { matchRequest } from "../src/matching";
import { DEMO_DATE,requests,inventory,organizations } from "../src/demo";
const r=requests[0];
const run=(options={})=>allocate(r,inventory,organizations,DEMO_DATE,options);
describe("allocation and simulations",()=>{
  it("fully fulfills from multiple providers without exceeding need",()=>{
    const result=run();
    expect(result.allocated).toBe(24); expect(result.unmet).toBe(0);
    expect(result.providerCount).toBe(2); expect(result.totalSupply).toBe(34);
    expect(result.lines.map(l=>l.quantity)).toEqual([18,6]);
  });
  it("supports larger requests, partial fulfillment and zero supply",()=>{
    expect(run({quantity:40}).unmet).toBe(6);
    expect(allocate(r,[],organizations,DEMO_DATE).allocated).toBe(0);
    expect(allocate(r,inventory.map(i=>({...i,quantity:0,quantityReserved:0})),organizations,DEMO_DATE).allocated).toBe(0);
  });
  it("rejects invalid quantities and duplicate inventory IDs",()=>{
    for(const quantity of [0,-1,1.5,NaN,100001]) expect(()=>run({quantity})).toThrow();
    expect(()=>allocate(r,[...inventory,inventory[0]],organizations,DEMO_DATE)).toThrow("Duplicate");
  });
  it("enforces calculator subtype, even in the same category",()=>{
    const scientific={...r,resourceType:"SCIENTIFIC_CALCULATOR" as const};
    expect(matchRequest(scientific,{...inventory[0],resourceType:"BASIC_CALCULATOR"},organizations,DEMO_DATE)).toBeNull();
    expect(allocate(scientific,inventory,organizations,DEMO_DATE).allocated).toBe(0);
    expect(allocate(scientific,[{...inventory[0],resourceType:"SCIENTIFIC_CALCULATOR"}],organizations,DEMO_DATE).allocated).toBe(18);
  });
  it("respects condition and provider exclusions",()=>{
    expect(run({minimumCondition:"NEW"}).allocated).toBe(6);
    const result=run({excludedProviders:["demo-school-2"]});
    expect(result.allocated).toBe(16);
    expect(result.lines.every(l=>l.providerId!=="demo-school-2")).toBe(true);
    expect(()=>run({excludedProviders:["missing"]})).toThrow();
  });
  it("groups several inventory lots at one provider into one transfer",()=>{
    const stock=[{...inventory[0],quantity:10},{...inventory[0],id:"second-lot",quantity:20}];
    expect(allocate(r,stock,organizations,DEMO_DATE).providerCount).toBe(1);
  });
  it("has stable output under shuffled inventory and never mutates inputs",()=>{
    const snapshot=JSON.stringify({r,inventory,organizations});
    expect(allocate(r,[...inventory].reverse(),organizations,DEMO_DATE)).toEqual(run());
    run({quantity:40,minimumCondition:"NEW"});
    expect(JSON.stringify({r,inventory,organizations})).toBe(snapshot);
  });
  it("accounts only for remaining need",()=>{
    const result=allocate({...r,quantityFulfilled:20},inventory,organizations,DEMO_DATE);
    expect(result.allocated).toBe(4);
    expect(result.financial.requestedValueCents).toBe(34000);
    expect(()=>allocate({...r,quantityFulfilled:20},inventory,organizations,DEMO_DATE,{quantity:10})).toThrow();
  });
  it("satisfies allocation invariants across a deterministic range of scenarios",()=>{
    for(let q=1;q<=70;q++) for(const minimumCondition of ["FAIR","GOOD","NEW"] as const) {
      const result=run({quantity:q,minimumCondition});
      expect(result.allocated).toBeLessThanOrEqual(q);
      expect(result.lines.reduce((s,l)=>s+l.quantity,0)).toBe(result.allocated);
      for(const line of result.lines) {
        const item=inventory.find(i=>i.id===line.inventoryId)!;
        expect(line.quantity).toBeLessThanOrEqual(item.quantity-item.quantityReserved);
        expect(matchRequest(result.request,item,organizations,DEMO_DATE)).not.toBeNull();
      }
      expect(result.financial.matchedValueCents+result.financial.unfulfilledValueCents).toBe(result.financial.requestedValueCents);
      expect(result).toEqual(run({quantity:q,minimumCondition}));
    }
  });
  it("achieves the minimum provider count compared with exhaustive subsets",()=>{
    const capacities=[18,6,10];
    for(let q=1;q<=40;q++) {
      const target=Math.min(q,34);
      let minimum=Infinity;
      for(let mask=0;mask<8;mask++) {
        let sum=0,count=0;
        capacities.forEach((c,i)=>{if(mask & (1<<i)){sum+=c;count++;}});
        if(sum>=target) minimum=Math.min(minimum,count);
      }
      expect(run({quantity:q}).providerCount).toBe(minimum);
    }
  });
});
describe("financial projection",()=>{
  it("projects exact cents and coverage for the worked example",()=>{
    expect(financialProjection(25,20,1500)).toEqual({
      requestedValueCents:37500,matchedValueCents:30000,potentialAvoidedCostCents:30000,
      unfulfilledValueCents:7500,coveragePercent:80,
    });
  });
  it("handles zero remaining need and rejects over-allocation",()=>{
    expect(financialProjection(0,0,1500).coveragePercent).toBe(100);
    expect(()=>financialProjection(10,11,1500)).toThrow();
    expect(()=>financialProjection(-1,0,1500)).toThrow();
  });
});
