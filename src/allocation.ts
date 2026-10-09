import { z } from "zod";
import { inventorySchema, organizationSchema, requestSchema, type InventoryItem, type Organization, type ResourceRequest } from "./domain";
import { matchRequest } from "./matching";
import { financialProjection } from "./finance";

const simulationSchema = z.object({
  quantity: z.number().int().min(1).max(100000).optional(),
  minimumCondition: z.enum(["FAIR","GOOD","NEW"]).optional(),
  excludedProviders: z.array(z.string().min(1)).default([]),
});
export type Simulation = z.input<typeof simulationSchema>;
const stableId = (a: string,b: string) => a < b ? -1 : a > b ? 1 : 0;
function uniqueIds(records: {id:string}[], label: string) {
  if (new Set(records.map(r=>r.id)).size !== records.length) throw new Error("Duplicate "+label+" ID");
}

/** Proposals only. Each call allocates stock to one request independently. */
export function allocate(request: ResourceRequest, inventory: InventoryItem[], organizations: Organization[], asOf: Date, simulation: Simulation = {}) {
  const options = simulationSchema.parse(simulation);
  const input = requestSchema.parse(request);
  const scenario = requestSchema.parse({...input,
    quantity:options.quantity ?? input.quantity,
    minimumCondition:options.minimumCondition ?? input.minimumCondition,
  });
  const stock = inventorySchema.array().parse(inventory);
  const partners = organizationSchema.array().parse(organizations);
  uniqueIds(stock,"inventory"); uniqueIds(partners,"organization");
  if (!Number.isFinite(asOf.getTime())) throw new Error("Invalid evaluation date");
  if (options.excludedProviders.some(id=>!partners.some(p=>p.id===id))) throw new Error("Unknown excluded provider");
  const excluded = new Set(options.excludedProviders);
  const matches = stock.flatMap(item => {
    if (excluded.has(item.organizationId)) return [];
    const match = matchRequest(scenario,item,partners,asOf);
    return match ? [{...match,providerId:item.organizationId,available:item.quantity-item.quantityReserved,
      quality:match.factors.filter(f=>f.key==="condition" || f.key==="distance").reduce((s,f)=>s+f.points,0)}] : [];
  }).sort((a,b)=>b.score-a.score || stableId(a.inventoryId,b.inventoryId));
  const groups = new Map<string,typeof matches>();
  for (const match of matches) groups.set(match.providerId,[...(groups.get(match.providerId) ?? []),match]);
  const providers = [...groups.entries()].map(([id,items])=>({
    id, items:items.sort((a,b)=>b.quality-a.quality || stableId(a.inventoryId,b.inventoryId)),
    capacity:items.reduce((s,i)=>s+i.available,0),
    quality:items.reduce((s,i)=>s+i.quality*i.available,0)/items.reduce((s,i)=>s+i.available,0),
  })).sort((a,b)=>b.capacity-a.capacity || b.quality-a.quality || stableId(a.id,b.id));
  const remaining = scenario.quantity-scenario.quantityFulfilled;
  const totalSupply = providers.reduce((s,p)=>s+p.capacity,0);
  const target = Math.min(remaining,totalSupply);
  let needed = target;
  const lines: {inventoryId:string;providerId:string;provider:string;title:string;quantity:number;reason:string}[] = [];
  for (const provider of providers) {
    if (!needed) break;
    for (const item of provider.items) {
      const quantity = Math.min(needed,item.available);
      if (quantity) lines.push({inventoryId:item.inventoryId,providerId:provider.id,provider:item.provider,
        title:item.title,quantity,reason:"Selected by provider capacity; within a provider, better condition and proximity rank first."});
      needed -= quantity;
      if (!needed) break;
    }
  }
  return {request:scenario, matches,lines,totalSupply,remaining,allocated:target,unmet:remaining-target,
    providerCount:new Set(lines.map(l=>l.providerId)).size,
    financial:financialProjection(remaining,target,scenario.replacementCostCents),
    explanation:"Maximize coverage, then minimize provider count by taking the largest compatible provider capacities first. Quality breaks equal-capacity ties. This does not minimize travel cost or globally maximize quality.",
  };
}
