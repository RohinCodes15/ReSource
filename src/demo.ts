import { inventorySchema, organizationSchema, requestSchema } from "./domain";
import { matchRequest } from "./matching";

export const DEMO_DATE = new Date("2026-10-08T12:00:00Z");
export const organizations = organizationSchema.array().parse([
  {id:"demo-school-3",name:"Maple Academy (fictional)",latitude:37.58,longitude:-121.97},
  {id:"demo-school-1",name:"Cedar High (fictional)",latitude:37.56,longitude:-122.00},
  {id:"demo-school-2",name:"Orchard High (fictional)",latitude:37.53,longitude:-121.95},
  {id:"demo-partner",name:"Learning Commons (fictional)",latitude:37.55,longitude:-121.98},
]);
export const requests = requestSchema.array().parse([
  {id:"demo-request-1",organizationId:"demo-school-1",requesterId:"demo-user-1",title:"Graphing calculators for algebra",resourceType:"GRAPHING_CALCULATOR",quantity:24,quantityFulfilled:0,minimumCondition:"GOOD",replacementCostCents:8500,urgency:5,neededBy:"2026-10-18T12:00:00Z",status:"OPEN"},
  {id:"demo-request-2",organizationId:"demo-school-2",requesterId:"demo-user-2",title:"Notebooks for student journals",resourceType:"NOTEBOOK",quantity:80,quantityFulfilled:0,minimumCondition:"NEW",replacementCostCents:350,urgency:3,neededBy:"2026-11-02T12:00:00Z",status:"OPEN"},
  {id:"demo-request-3",organizationId:"demo-school-1",requesterId:"demo-user-1",title:"Science posters",resourceType:"SCIENCE_POSTER",quantity:12,quantityFulfilled:0,minimumCondition:"GOOD",replacementCostCents:1200,urgency:2,neededBy:"2026-10-25T12:00:00Z",status:"OPEN"},
]);
export const inventory = inventorySchema.array().parse([
  {id:"demo-item-1",organizationId:"demo-school-2",title:"TI-84 calculators",resourceType:"GRAPHING_CALCULATOR",quantity:18,quantityReserved:0,condition:"GOOD",status:"ACTIVE"},
  {id:"demo-item-2",organizationId:"demo-partner",title:"TI-84 calculators in original boxes",resourceType:"GRAPHING_CALCULATOR",quantity:8,quantityReserved:2,condition:"NEW",status:"ACTIVE"},
  {id:"demo-item-3",organizationId:"demo-partner",title:"Unused spiral notebooks",resourceType:"NOTEBOOK",quantity:100,quantityReserved:20,condition:"NEW",status:"ACTIVE"},
  {id:"demo-item-4",organizationId:"demo-school-3",title:"Additional graphing calculators",resourceType:"GRAPHING_CALCULATOR",quantity:10,quantityReserved:0,condition:"GOOD",status:"ACTIVE"},
]);
export function demoResults() {
  return requests.map(request => ({request, matches: inventory.flatMap(item => {
    const match = matchRequest(request, item, organizations, DEMO_DATE);
    return match ? [match] : [];
  }).sort((a,b) => b.score-a.score || a.inventoryId.localeCompare(b.inventoryId))}));
}
