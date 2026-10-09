import { PrismaClient } from "@prisma/client";
import { z } from "zod";
const env=z.object({
  DATABASE_URL:z.string().url(),BOOTSTRAP_ADMIN_NAME:z.string().min(2),
  BOOTSTRAP_ADMIN_EMAIL:z.email(),BOOTSTRAP_GITHUB_ACCOUNT_ID:z.string().min(1),
  BOOTSTRAP_ORGANIZATION_NAME:z.string().min(3),BOOTSTRAP_LATITUDE:z.coerce.number().min(-90).max(90),
  BOOTSTRAP_LONGITUDE:z.coerce.number().min(-180).max(180),
}).parse(process.env);
const db=new PrismaClient();
async function main() {
  await db.$transaction(async tx=>{
    if(await tx.user.count()) throw new Error("Bootstrap is allowed only before any users exist.");
    const organization=await tx.organization.create({data:{name:env.BOOTSTRAP_ORGANIZATION_NAME,
      latitude:env.BOOTSTRAP_LATITUDE,longitude:env.BOOTSTRAP_LONGITUDE}});
    await tx.user.create({data:{name:env.BOOTSTRAP_ADMIN_NAME,email:env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
      authSubject:"github:"+env.BOOTSTRAP_GITHUB_ACCOUNT_ID,role:"ADMIN",organizationId:organization.id}});
  });
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
