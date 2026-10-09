import { redirect } from "next/navigation";
import { currentMember } from "@/src/access";
import { AccessError } from "@/src/permissions";
import { LiveWorkspace } from "./workspace";
export const dynamic = "force-dynamic";
export default async function LivePage() {
  try {await currentMember();}
  catch(error) {if(error instanceof AccessError) redirect("/signin"); throw error;}
  return <LiveWorkspace />;
}
