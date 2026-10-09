import { ZodError } from "zod";
import { currentMember, AccessError } from "@/src/access";
import { executeMutation, liveSnapshot, ConflictError } from "@/src/live";
import { Prisma } from "@prisma/client";
export const dynamic = "force-dynamic";
function responseFor(error:unknown) {
  if(error instanceof AccessError) return Response.json({error:error.message},{status:error.status});
  if(error instanceof ConflictError) return Response.json({error:error.message},{status:409});
  if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002")
    return Response.json({error:"This operation was already submitted or the value is already in use"},{status:409});
  if(error instanceof ZodError) return Response.json({error:"Invalid input",issues:error.issues},{status:400});
  if(error instanceof SyntaxError) return Response.json({error:"Malformed JSON"},{status:400});
  console.error("Live operation failed",error);
  return Response.json({error:"Database operation failed"},{status:503});
}
export async function GET() {
  try {return Response.json(await liveSnapshot(await currentMember()),{headers:{"Cache-Control":"no-store"}});}
  catch(error) {return responseFor(error);}
}
export async function POST(request:Request) {
  try {
    const actor=await currentMember();
    const data=await request.json();
    return Response.json({result:await executeMutation(actor,data)},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return responseFor(error);}
}
