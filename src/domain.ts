import { z } from "zod";

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
const quantity = z.number().int().min(0).max(100000);
const cents = z.number().int().min(0).max(100000000);
const condition = z.enum(["FAIR", "GOOD", "NEW"]);
const resourceType = z.enum(["GRAPHING_CALCULATOR", "SCIENTIFIC_CALCULATOR", "BASIC_CALCULATOR", "NOTEBOOK", "SCIENCE_POSTER"]);
export const organizationSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(3).max(120),
  ...locationSchema.shape,
});
export const requestSchema = z.object({
  id: z.string().min(1), organizationId: z.string().min(1),
  requesterId: z.string().min(1), title: z.string().trim().min(3).max(120),
  resourceType, quantity: quantity.min(1), quantityFulfilled: quantity,
  minimumCondition: condition, replacementCostCents: cents,
  urgency: z.number().int().min(1).max(5), neededBy: z.iso.datetime(),
  status: z.enum(["OPEN", "CLOSED", "FULFILLED"]),
}).refine(r => r.quantityFulfilled <= r.quantity, "Fulfilled quantity exceeds request");
export const inventorySchema = z.object({
  id: z.string().min(1), organizationId: z.string().min(1),
  title: z.string().trim().min(3).max(120), resourceType,
  quantity, quantityReserved: quantity,
  condition, status: z.enum(["ACTIVE", "WITHDRAWN"]),
}).refine(i => i.quantityReserved <= i.quantity, "Reserved quantity exceeds stock");
export type Organization = z.infer<typeof organizationSchema>;
export type ResourceRequest = z.infer<typeof requestSchema>;
export type InventoryItem = z.infer<typeof inventorySchema>;
export const money = (cents: number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(cents / 100);
