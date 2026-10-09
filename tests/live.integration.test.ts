import { describe,it,expect,beforeAll,afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient, type User } from "@prisma/client";
import { executeMutation } from "../src/live";
import { liveSnapshot } from "../src/live";

const testUrl=process.env.TEST_DATABASE_URL;
const safe=(()=>{
  try {
    const url=new URL(testUrl??"");
    return ["localhost","127.0.0.1"].includes(url.hostname) && url.pathname.includes("test");
  } catch {return false;}
})();
describe.runIf(safe)("PostgreSQL transfer integration",()=>{
  const db=new PrismaClient({datasources:{db:{url:testUrl??"postgresql://localhost:5432/resource_test"}}});
  const suffix=randomUUID();
  const schoolA="integration-a-"+suffix,schoolB="integration-b-"+suffix,schoolC="integration-c-"+suffix;
  const teacherId="teacher-"+suffix,providerId="provider-"+suffix,coordinatorId="coordinator-"+suffix;
  let teacher:User,provider:User,coordinator:User;
  let requestId:string,itemId:string,otherItemId:string;
  beforeAll(async()=>{
    if(process.env.DATABASE_URL!==testUrl) throw new Error("Set DATABASE_URL and TEST_DATABASE_URL to the same isolated local test database.");
    await db.organization.createMany({data:[
      {id:schoolA,name:"Integration A",latitude:37.55,longitude:-121.98},
      {id:schoolB,name:"Integration B",latitude:37.56,longitude:-121.99},
      {id:schoolC,name:"Integration C",latitude:37.57,longitude:-121.97},
    ]});
    teacher=await db.user.create({data:{id:teacherId,email:teacherId+"@example.invalid",name:"Test teacher",role:"TEACHER",organizationId:schoolA}});
    provider=await db.user.create({data:{id:providerId,email:providerId+"@example.invalid",name:"Test provider",role:"PROVIDER",organizationId:schoolB}});
    coordinator=await db.user.create({data:{id:coordinatorId,email:coordinatorId+"@example.invalid",name:"Test coordinator",role:"COORDINATOR",organizationId:schoolA}});
    const request=await db.resourceRequest.create({data:{organizationId:schoolA,requesterId:teacher.id,title:"Scientific calculators",
      resourceType:"SCIENTIFIC_CALCULATOR",quantity:20,minimumCondition:"GOOD",replacementCostCents:1500,
      urgency:4,neededBy:new Date("2035-01-01")}});
    const item=await db.inventoryItem.create({data:{organizationId:schoolB,title:"Scientific calculators",
      resourceType:"SCIENTIFIC_CALCULATOR",quantity:10,condition:"GOOD"}});
    const other=await db.inventoryItem.create({data:{organizationId:schoolB,title:"Second scientific calculator lot",
      resourceType:"SCIENTIFIC_CALCULATOR",quantity:10,condition:"NEW"}});
    requestId=request.id;itemId=item.id;otherItemId=other.id;
  });
  afterAll(async()=>{
    const transfers=await db.transfer.findMany({where:{proposerId:teacherId},select:{id:true}});
    const ids=transfers.map(t=>t.id);
    await db.savingsVerification.deleteMany({where:{transferId:{in:ids}}});
    await db.auditEvent.deleteMany({where:{transferId:{in:ids}}});
    await db.transferItem.deleteMany({where:{transferId:{in:ids}}});
    await db.transfer.deleteMany({where:{id:{in:ids}}});
    await db.inventoryItem.deleteMany({where:{organizationId:{in:[schoolB,schoolC]}}});
    await db.resourceRequest.deleteMany({where:{organizationId:schoolA}});
    await db.user.deleteMany({where:{id:{in:[teacherId,providerId,coordinatorId]}}});
    await db.organization.deleteMany({where:{id:{in:[schoolA,schoolB,schoolC]}}});
    await db.$disconnect();
  });
  it("persists requests and inventory and enforces ownership",async()=>{
    const request=await executeMutation(teacher,{action:"request.create",title:"Lab journals",resourceType:"NOTEBOOK",
      quantity:8,minimumCondition:"NEW",replacementCostCents:200,urgency:2,neededBy:"2035-01-01T00:00:00.000Z"});
    expect((await db.resourceRequest.findUnique({where:{id:request.id}}))?.title).toBe("Lab journals");
    await expect(executeMutation(provider,{action:"request.edit",id:request.id,title:"Tampered",quantity:8,
      minimumCondition:"NEW",replacementCostCents:200,urgency:2,neededBy:"2035-01-01T00:00:00.000Z"})).rejects.toThrow();
    const item=await executeMutation(provider,{action:"inventory.create",title:"Lab notebooks",resourceType:"NOTEBOOK",quantity:8,condition:"NEW"});
    expect((await db.inventoryItem.findUnique({where:{id:item.id}}))?.quantity).toBe(8);
    await expect(executeMutation(teacher,{action:"inventory.edit",id:item.id,title:"Tampered",quantity:8,condition:"NEW"})).rejects.toThrow();
  });
  it("prevents competing approvals and duplicate reservations",async()=>{
    const a=await executeMutation(teacher,{action:"transfer.propose",requestId,inventoryId:itemId,quantity:8,idempotencyKey:randomUUID()});
    const b=await executeMutation(teacher,{action:"transfer.propose",requestId,inventoryId:itemId,quantity:7,idempotencyKey:randomUUID()});
    const outcomes=await Promise.allSettled([
      executeMutation(provider,{action:"transfer.approve",id:a.id}),
      executeMutation(provider,{action:"transfer.approve",id:b.id}),
    ]);
    expect(outcomes.filter(o=>o.status==="fulfilled")).toHaveLength(1);
    const stock=await db.inventoryItem.findUniqueOrThrow({where:{id:itemId}});
    expect(stock.quantityReserved).toBeLessThanOrEqual(stock.quantity);
    expect(stock.quantityReserved).toBeGreaterThan(0);
    const winner=outcomes[0].status==="fulfilled"?a:b;
    const loser=outcomes[0].status==="fulfilled"?b:a;
    expect((await db.transfer.findUniqueOrThrow({where:{id:loser.id}})).status).toBe("PROPOSED");
    await executeMutation(provider,{action:"transfer.approve",id:winner.id});
    expect((await db.inventoryItem.findUniqueOrThrow({where:{id:itemId}})).quantityReserved).toBe(stock.quantityReserved);
    await executeMutation(provider,{action:"transfer.decline",id:loser.id});
    await expect(executeMutation(provider,{action:"transfer.approve",id:loser.id})).rejects.toThrow();
    await executeMutation(teacher,{action:"transfer.cancel",id:winner.id});
    expect((await db.inventoryItem.findUniqueOrThrow({where:{id:itemId}})).quantityReserved).toBe(0);
    await expect(executeMutation(teacher,{action:"transfer.complete",id:winner.id})).rejects.toThrow();
  });
  it("runs the 20-request, 15-stock, 10-unit end-to-end lifecycle",async()=>{
    const request=await db.resourceRequest.create({data:{organizationId:schoolA,requesterId:teacher.id,
      title:"Workflow scientific calculators",resourceType:"SCIENTIFIC_CALCULATOR",quantity:20,
      minimumCondition:"GOOD",replacementCostCents:1500,urgency:5,neededBy:new Date("2035-01-01")}});
    const item=await db.inventoryItem.create({data:{organizationId:schoolB,title:"Workflow calculators",
      resourceType:"SCIENTIFIC_CALCULATOR",quantity:15,condition:"GOOD"}});
    const transfer=await executeMutation(teacher,{action:"transfer.propose",requestId:request.id,inventoryId:item.id,
      quantity:10,idempotencyKey:randomUUID()});
    await executeMutation(provider,{action:"transfer.approve",id:transfer.id});
    expect((await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}})).quantityReserved).toBe(10);
    expect((await db.resourceRequest.findUniqueOrThrow({where:{id:request.id}})).quantityReserved).toBe(10);
    await expect(executeMutation(teacher,{action:"transfer.approve",id:transfer.id})).rejects.toThrow();
    await expect(executeMutation(provider,{action:"transfer.complete",id:transfer.id})).rejects.toThrow();
    await executeMutation(teacher,{action:"transfer.complete",id:transfer.id});
    await executeMutation(teacher,{action:"transfer.complete",id:transfer.id});
    expect((await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}})).quantity).toBe(5);
    expect((await db.resourceRequest.findUniqueOrThrow({where:{id:request.id}})).quantityFulfilled).toBe(10);
    const snapshot=await liveSnapshot(teacher);
    expect(snapshot.impact.completedTransfers).toBeGreaterThan(0);
    expect(snapshot.impact.completedValueCents).toBeGreaterThanOrEqual(15000);
    await expect(executeMutation(teacher,{action:"transfer.cancel",id:transfer.id})).rejects.toThrow();
    await expect(executeMutation(teacher,{action:"request.edit",id:request.id,title:"Over-demand",
      quantity:9,minimumCondition:"GOOD",replacementCostCents:1500,urgency:5,neededBy:"2035-01-01T00:00:00.000Z"})).rejects.toThrow();
  });
  it("repeats concurrent 8+7 approvals against ten units without overbooking",async()=>{
    for(let round=0;round<5;round++) {
      const request=await db.resourceRequest.create({data:{organizationId:schoolA,requesterId:teacher.id,
        title:`Concurrency round ${round}`,resourceType:"SCIENTIFIC_CALCULATOR",quantity:20,
        minimumCondition:"GOOD",replacementCostCents:1500,urgency:4,neededBy:new Date("2035-01-01")}});
      const item=await db.inventoryItem.create({data:{organizationId:schoolB,title:`Concurrent stock ${round}`,
        resourceType:"SCIENTIFIC_CALCULATOR",quantity:10,condition:"GOOD"}});
      const [a,b]=await Promise.all([8,7].map(quantity=>executeMutation(teacher,{action:"transfer.propose",
        requestId:request.id,inventoryId:item.id,quantity,idempotencyKey:randomUUID()})));
      const results=await Promise.allSettled([
        executeMutation(provider,{action:"transfer.approve",id:a.id}),
        executeMutation(provider,{action:"transfer.approve",id:b.id}),
      ]);
      expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
      const finalItem=await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}});
      const finalRequest=await db.resourceRequest.findUniqueOrThrow({where:{id:request.id}});
      expect(finalItem.quantityReserved).toBeLessThanOrEqual(finalItem.quantity);
      expect(finalItem.quantityReserved).toBe(finalRequest.quantityReserved);
      const accepted=await db.transfer.findMany({where:{id:{in:[a.id,b.id]},status:"APPROVED"}});
      expect(accepted).toHaveLength(1);
      await executeMutation(teacher,{action:"transfer.cancel",id:accepted[0].id});
      expect((await db.inventoryItem.findUniqueOrThrow({where:{id:item.id}})).quantityReserved).toBe(0);
    }
  });
  it("completes one provider, verifies separately, and supports a second provider lot",async()=>{
    const impactBefore=await liveSnapshot(teacher);
    const a=await executeMutation(teacher,{action:"transfer.propose",requestId,inventoryId:itemId,quantity:8,idempotencyKey:randomUUID()});
    const b=await executeMutation(teacher,{action:"transfer.propose",requestId,inventoryId:otherItemId,quantity:10,idempotencyKey:randomUUID()});
    await expect(executeMutation(teacher,{action:"transfer.approve",id:a.id})).rejects.toThrow();
    await executeMutation(provider,{action:"transfer.approve",id:a.id});
    await executeMutation(provider,{action:"transfer.approve",id:b.id});
    expect((await db.resourceRequest.findUniqueOrThrow({where:{id:requestId}})).quantityReserved).toBe(18);
    await executeMutation(teacher,{action:"transfer.complete",id:a.id});
    await executeMutation(teacher,{action:"transfer.complete",id:a.id});
    expect((await db.inventoryItem.findUniqueOrThrow({where:{id:itemId}})).quantity).toBe(2);
    await executeMutation(teacher,{action:"transfer.complete",id:b.id});
    const request=await db.resourceRequest.findUniqueOrThrow({where:{id:requestId}});
    expect(request.quantityFulfilled).toBe(18);
    expect(request.quantityReserved).toBe(0);
    await expect(executeMutation(teacher,{action:"savings.verify",transferId:a.id,verifiedQuantity:8,
      avoidedCostCents:12000})).rejects.toThrow();
    await expect(executeMutation(coordinator,{action:"savings.verify",transferId:a.id,verifiedQuantity:9,
      avoidedCostCents:12000})).rejects.toThrow();
    await executeMutation(coordinator,{action:"savings.verify",transferId:a.id,verifiedQuantity:8,
      avoidedCostCents:12000,explanation:"Replacement purchase was approved but cancelled."});
    await expect(executeMutation(coordinator,{action:"savings.verify",transferId:a.id,verifiedQuantity:8,
      avoidedCostCents:12000})).rejects.toThrow();
    const snapshot=await liveSnapshot(teacher);
    expect(snapshot.impact.completedTransfers-impactBefore.impact.completedTransfers).toBe(2);
    expect(snapshot.impact.completedValueCents-impactBefore.impact.completedValueCents).toBe(27000);
    expect(snapshot.impact.verifiedAvoidedCostCents-impactBefore.impact.verifiedAvoidedCostCents).toBe(12000);
  });
});
