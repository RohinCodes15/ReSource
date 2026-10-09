import { inventorySchema, locationSchema, requestSchema, money, type InventoryItem, type Organization, type ResourceRequest } from "./domain";
import { CATEGORY } from "./catalog";

export const WEIGHTS = { type: 35, quantity: 20, condition: 15, distance: 10, urgency: 10, benefit: 10 } as const;
const rank = { FAIR: 1, GOOD: 2, NEW: 3 };
export function distanceMiles(a: Organization, b: Organization) {
  locationSchema.parse(a); locationSchema.parse(b);
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(b.latitude-a.latitude)/2)**2 +
    Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function estimatedSavings(quantity: number, unitCostCents: number) {
  if (![quantity, unitCostCents].every(n => Number.isSafeInteger(n) && n >= 0) ||
      !Number.isSafeInteger(quantity * unitCostCents)) throw new Error("Invalid monetary calculation");
  return quantity * unitCostCents;
}
export function matchRequest(request: ResourceRequest, item: InventoryItem, organizations: Organization[], asOf: Date) {
  requestSchema.parse(request); inventorySchema.parse(item);
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid evaluation date");
  const remaining = request.quantity - request.quantityFulfilled;
  const available = item.quantity - item.quantityReserved;
  if (request.status !== "OPEN" || item.status !== "ACTIVE" || remaining <= 0 || available <= 0 ||
      CATEGORY[request.resourceType] !== CATEGORY[item.resourceType] ||
      request.resourceType !== item.resourceType || rank[item.condition] < rank[request.minimumCondition] ||
      request.organizationId === item.organizationId || new Date(request.neededBy) < asOf) return null;
  const receiver = organizations.find(o => o.id === request.organizationId);
  const provider = organizations.find(o => o.id === item.organizationId);
  if (!receiver || !provider) throw new Error("Missing organization location");
  const units = Math.min(remaining, available);
  const miles = distanceMiles(receiver, provider);
  const savingsCents = estimatedSavings(units, request.replacementCostCents);
  const days = (new Date(request.neededBy).getTime() - asOf.getTime()) / 86400000;
  const values = {
    type: 1, quantity: units / remaining, condition: rank[item.condition] / 3,
    distance: Math.max(0, 1 - miles / 25),
    urgency: .7 * request.urgency / 5 + .3 * Math.max(0, 1 - days / 30),
    benefit: Math.min(1, savingsCents / 100000),
  };
  const explanations = {
    type: "Exact resource type and category match; model-specific requirements still need human confirmation.",
    quantity: units + " of " + remaining + " remaining units available.",
    condition: item.condition + " meets minimum " + request.minimumCondition + ".",
    distance: miles.toFixed(1) + " straight-line miles; this is not a driving distance.",
    urgency: "Priority " + request.urgency + "/5; " + Math.ceil(days) + " days until needed.",
    benefit: money(savingsCents) + " estimated gross purchase cost avoided, capped at $1,000 for scoring.",
  };
  const factors = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map(key => ({
    key, weight: WEIGHTS[key], value: values[key], points: values[key] * WEIGHTS[key], explanation: explanations[key],
  }));
  const score = Math.round(factors.reduce((sum, f) => sum + f.points, 0));
  return { inventoryId: item.id, provider: provider.name, title: item.title, units, score, savingsCents, factors,
    explanation: units + " units from " + provider.name + "; " + money(savingsCents) + " estimated cost avoided." };
}
