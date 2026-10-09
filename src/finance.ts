import { estimatedSavings } from "./matching";

/** Remaining request basis; proposed quantities are never confirmed savings. */
export function financialProjection(requested: number, allocated: number, unitCostCents: number) {
  const requestedValueCents = estimatedSavings(requested, unitCostCents);
  const matchedValueCents = estimatedSavings(allocated, unitCostCents);
  if (allocated > requested) throw new Error("Allocation exceeds remaining request");
  return {
    requestedValueCents, matchedValueCents, potentialAvoidedCostCents: matchedValueCents,
    unfulfilledValueCents: requestedValueCents - matchedValueCents,
    coveragePercent: requested === 0 ? 100 : allocated / requested * 100,
  };
}
