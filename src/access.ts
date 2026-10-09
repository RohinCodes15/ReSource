import { auth } from "@/auth";
import type { User } from "@prisma/client";
import { db } from "./db";
import { AccessError } from "./permissions";
export { AccessError } from "./permissions";
export async function currentMember(): Promise<User> {
  const session = await auth();
  if (!session?.user) throw new AccessError("Sign in required",401);
  const member = session.user.id ? await db.user.findUnique({where:{id:session.user.id}}) : null;
  if (!member) throw new AccessError("Account is not an authorized organization member",403);
  return member;
}
