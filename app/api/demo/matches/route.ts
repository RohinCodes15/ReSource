import { demoResults, DEMO_DATE } from "@/src/demo";
export function GET() {
  return Response.json({demo:true, disclaimer:"Fictional data; estimates are not verified savings.",asOf:DEMO_DATE.toISOString(),results:demoResults()});
}
