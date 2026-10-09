import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { resourcePrisma?: PrismaClient };
export const db = globalForPrisma.resourcePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.resourcePrisma = db;
