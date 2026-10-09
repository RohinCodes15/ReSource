import { PrismaClient } from "@prisma/client";
import { inventory, organizations, requests } from "../src/demo";

const db = new PrismaClient();
async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("Set ALLOW_DEMO_SEED=true only for a dedicated demo database.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost","127.0.0.1"].includes(url.hostname) || !url.pathname.includes("demo"))
    throw new Error("Demo seed requires a local database with 'demo' in its name.");
  await db.$transaction(async tx => {
    for (const org of organizations) await tx.organization.upsert({where:{id:org.id},create:org,update:{}});
    for (const [id, organizationId, name, role] of [
      ["demo-user-1","demo-school-1","Alex Example","TEACHER"],
      ["demo-user-2","demo-school-2","Jamie Example","TEACHER"],
      ["demo-provider-1","demo-school-2","Casey Example","PROVIDER"],
      ["demo-coordinator-1","demo-school-1","Taylor Example","COORDINATOR"],
    ] as const) await tx.user.upsert({where:{id},create:{id,organizationId,name,email:id+"@example.invalid",role},update:{}});
    for (const item of inventory) await tx.inventoryItem.upsert({where:{id:item.id},create:item,update:{}});
    for (const request of requests) await tx.resourceRequest.upsert({
      where:{id:request.id},create:{...request,neededBy:new Date(request.neededBy)},update:{},
    });
  });
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
