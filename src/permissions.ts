import type { User } from "@prisma/client";

export class AccessError extends Error {
  constructor(message = "Access denied", public status = 403) { super(message); }
}
export function allowed(member: User, capability: "request"|"inventory"|"coordinate"|"admin") {
  const role = member.role;
  return role === "ADMIN" || (capability==="request" && ["TEACHER","MANAGER","COORDINATOR"].includes(role)) ||
    (capability==="inventory" && ["PROVIDER","MANAGER"].includes(role)) ||
    (capability==="coordinate" && ["COORDINATOR","MANAGER"].includes(role));
}
export function requireCapability(member: User, capability: Parameters<typeof allowed>[1]) {
  if (!allowed(member,capability)) throw new AccessError();
}
export function requireOrganization(member: User, organizationId: string) {
  if (member.role!=="ADMIN" && member.organizationId!==organizationId) throw new AccessError("Wrong organization");
}
