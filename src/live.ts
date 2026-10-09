import { Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { AccessError, requireCapability, requireOrganization } from "./permissions";
import { inventorySchema, requestSchema, type Organization } from "./domain";
import { matchRequest } from "./matching";
import { CATEGORY } from "./catalog";

export class ConflictError extends Error { constructor(message:string) { super(message); } }
const id = z.string().min(1).max(100);
const positive = z.number().int().min(1).max(100000);
const cents = z.number().int().min(0).max(100000000);
export const mutationSchema = z.discriminatedUnion("action",[
  z.object({action:z.literal("request.create"),title:z.string().trim().min(3).max(120),
    resourceType:z.enum(Object.keys(CATEGORY) as [keyof typeof CATEGORY,...(keyof typeof CATEGORY)[]]),
    quantity:positive,minimumCondition:z.enum(["FAIR","GOOD","NEW"]),replacementCostCents:cents,
    urgency:z.number().int().min(1).max(5),neededBy:z.iso.datetime()}),
  z.object({action:z.literal("request.edit"),id,title:z.string().trim().min(3).max(120),
    quantity:positive,minimumCondition:z.enum(["FAIR","GOOD","NEW"]),replacementCostCents:cents,
    urgency:z.number().int().min(1).max(5),neededBy:z.iso.datetime()}),
  z.object({action:z.literal("request.close"),id}),
  z.object({action:z.literal("inventory.create"),title:z.string().trim().min(3).max(120),
    resourceType:z.enum(Object.keys(CATEGORY) as [keyof typeof CATEGORY,...(keyof typeof CATEGORY)[]]),
    quantity:positive,condition:z.enum(["FAIR","GOOD","NEW"])}),
  z.object({action:z.literal("inventory.edit"),id,title:z.string().trim().min(3).max(120),
    quantity:z.number().int().min(0).max(100000),condition:z.enum(["FAIR","GOOD","NEW"])}),
  z.object({action:z.literal("inventory.retire"),id}),
  z.object({action:z.literal("transfer.propose"),requestId:id,inventoryId:id,quantity:positive,
    idempotencyKey:z.string().uuid()}),
  z.object({action:z.literal("transfer.approve"),id}),
  z.object({action:z.literal("transfer.decline"),id}),
  z.object({action:z.literal("transfer.cancel"),id}),
  z.object({action:z.literal("transfer.complete"),id}),
  z.object({action:z.literal("savings.verify"),transferId:id,verifiedQuantity:positive,
    avoidedCostCents:cents,explanation:z.string().trim().max(1000).optional()}),
  z.object({action:z.literal("admin.organization.create"),name:z.string().trim().min(3).max(120),
    latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}),
  z.object({action:z.literal("admin.user.create"),name:z.string().trim().min(2).max(120),
    email:z.email(),organizationId:id,githubAccountId:z.string().trim().min(1).max(100),
    role:z.enum(["TEACHER","PROVIDER","COORDINATOR","MANAGER","ADMIN"])}),
]);
export type Mutation = z.infer<typeof mutationSchema>;
const txOptions = {isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:5000,timeout:10000};
async function serializable<T>(work:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T> {
  for(let attempt=0;attempt<3;attempt++) {
    try { return await db.$transaction(work,txOptions); }
    catch(error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2034" && attempt<2) continue;
      throw error;
    }
  }
  throw new ConflictError("Concurrent change; retry");
}
function must(condition:unknown,message:string):asserts condition {
  if (!condition) throw new ConflictError(message);
}
function audit(tx:Prisma.TransactionClient,actor:User,action:string,transferId:string|null,details:Prisma.InputJsonValue) {
  return tx.auditEvent.create({data:{actorId:actor.id,action,transferId,details}});
}
async function assertMatch(tx:Prisma.TransactionClient,requestId:string,inventoryId:string,quantity:number) {
  const [request,item,organizations] = await Promise.all([
    tx.resourceRequest.findUnique({where:{id:requestId}}),tx.inventoryItem.findUnique({where:{id:inventoryId}}),
    tx.organization.findMany(),
  ]);
  must(request && item,"Request or inventory no longer exists");
  const orgs:Organization[] = organizations;
  const match = matchRequest({
    id:request.id,organizationId:request.organizationId,requesterId:request.requesterId,
    title:request.title,resourceType:request.resourceType as ReturnType<typeof requestSchema.parse>["resourceType"],
    quantity:request.quantity,quantityFulfilled:request.quantityFulfilled,
    minimumCondition:request.minimumCondition,replacementCostCents:request.replacementCostCents,
    urgency:request.urgency,neededBy:request.neededBy.toISOString(),status:request.status,
  },{
    id:item.id,organizationId:item.organizationId,title:item.title,
    resourceType:item.resourceType as ReturnType<typeof inventorySchema.parse>["resourceType"],
    quantity:item.quantity,quantityReserved:item.quantityReserved,condition:item.condition,status:item.status,
  },orgs,new Date());
  must(match && quantity<=match.units,"Stock or request is no longer compatible");
  must(quantity<=request.quantity-request.quantityFulfilled-request.quantityReserved,"Request demand is already committed");
  return {request,item};
}
async function getTransfer(tx:Prisma.TransactionClient,id:string) {
  const transfer = await tx.transfer.findUnique({where:{id},include:{items:true}});
  must(transfer && transfer.items.length===1,"Transfer not found");
  return transfer;
}
export async function executeMutation(actor:User,input:unknown) {
  const command = mutationSchema.parse(input);
  switch(command.action) {
    case "request.create": {
      requireCapability(actor,"request");
      const {action:_,...values}=command; void _;
      return db.resourceRequest.create({data:{...values,organizationId:actor.organizationId,requesterId:actor.id,
        neededBy:new Date(values.neededBy)}});
    }
    case "request.edit": {
      requireCapability(actor,"request");
      return serializable(async tx=>{
        const existing=await tx.resourceRequest.findUnique({where:{id:command.id}});
        must(existing,"Request not found");
        if(existing.requesterId!==actor.id && actor.role!=="ADMIN") throw new AccessError();
        must(existing.status==="OPEN" && existing.quantityReserved===0 && existing.quantityFulfilled===0,"Request has commitments");
        const {action:_,id:__,...values}=command; void _; void __;
        const result=await tx.resourceRequest.updateMany({where:{id:command.id,version:existing.version,status:"OPEN",
          quantityReserved:0,quantityFulfilled:0},data:{...values,neededBy:new Date(values.neededBy),version:{increment:1}}});
        must(result.count===1,"Request changed; retry");
        return tx.resourceRequest.findUniqueOrThrow({where:{id:command.id}});
      });
    }
    case "request.close": {
      requireCapability(actor,"request");
      return serializable(async tx=>{
        const existing=await tx.resourceRequest.findUnique({where:{id:command.id}});
        must(existing,"Request not found");
        if(existing.requesterId!==actor.id && actor.role!=="ADMIN") throw new AccessError();
        must(existing.quantityReserved===0,"Cancel approved transfers first");
        return tx.resourceRequest.update({where:{id:command.id},data:{status:"CLOSED",version:{increment:1}}});
      });
    }
    case "inventory.create": {
      requireCapability(actor,"inventory");
      const {action:_,...values}=command; void _;
      return db.inventoryItem.create({data:{...values,organizationId:actor.organizationId}});
    }
    case "inventory.edit": {
      requireCapability(actor,"inventory");
      return serializable(async tx=>{
        const existing=await tx.inventoryItem.findUnique({where:{id:command.id}});
        must(existing,"Inventory not found"); requireOrganization(actor,existing.organizationId);
        must(existing.status==="ACTIVE","Listing is retired");
        must(command.quantity>=existing.quantityReserved,"Quantity is below reserved units");
        must(existing.quantityReserved===0 || command.condition===existing.condition,
          "Condition cannot change while units are reserved");
        const result=await tx.inventoryItem.updateMany({where:{id:command.id,version:existing.version,
          quantity:existing.quantity,quantityReserved:existing.quantityReserved},data:{
          title:command.title,quantity:command.quantity,condition:command.condition,version:{increment:1}}});
        must(result.count===1,"Inventory changed; retry");
        return tx.inventoryItem.findUniqueOrThrow({where:{id:command.id}});
      });
    }
    case "inventory.retire": {
      requireCapability(actor,"inventory");
      return serializable(async tx=>{
        const existing=await tx.inventoryItem.findUnique({where:{id:command.id}});
        must(existing,"Inventory not found"); requireOrganization(actor,existing.organizationId);
        must(existing.quantityReserved===0,"Cancel approved transfers first");
        return tx.inventoryItem.update({where:{id:command.id},data:{status:"WITHDRAWN",version:{increment:1}}});
      });
    }
    case "transfer.propose": {
      requireCapability(actor,"request");
      return serializable(async tx=>{
        const previous=await tx.transfer.findUnique({where:{idempotencyKey:command.idempotencyKey},include:{items:true}});
        if(previous) {
          must(previous.proposerId===actor.id && previous.items[0]?.requestId===command.requestId &&
            previous.items[0]?.inventoryId===command.inventoryId && previous.items[0]?.quantity===command.quantity,
            "Idempotency key used for another proposal");
          return previous;
        }
        const {request,item}=await assertMatch(tx,command.requestId,command.inventoryId,command.quantity);
        if(request.requesterId!==actor.id && actor.role!=="ADMIN") throw new AccessError();
        const transfer=await tx.transfer.create({data:{status:"PROPOSED",proposerId:actor.id,
          idempotencyKey:command.idempotencyKey,senderId:item.organizationId,receiverId:request.organizationId,
          items:{create:{requestId:request.id,inventoryId:item.id,quantity:command.quantity,
            replacementCostCents:request.replacementCostCents}}}});
        await audit(tx,actor,"TRANSFER_PROPOSED",transfer.id,{quantity:command.quantity});
        return transfer;
      });
    }
    case "transfer.approve": {
      requireCapability(actor,"inventory");
      return serializable(async tx=>{
        const transfer=await getTransfer(tx,command.id); requireOrganization(actor,transfer.senderId);
        if(transfer.status==="APPROVED") return transfer;
        must(transfer.status==="PROPOSED","Only proposals can be approved");
        const line=transfer.items[0];
        const {request,item}=await assertMatch(tx,line.requestId,line.inventoryId,line.quantity);
        must(item.organizationId===transfer.senderId && request.organizationId===transfer.receiverId,"Transfer organizations changed");
        const reserved=await tx.inventoryItem.updateMany({where:{id:item.id,version:item.version,
          quantity:item.quantity,quantityReserved:item.quantityReserved,status:"ACTIVE"},
          data:{quantityReserved:{increment:line.quantity},version:{increment:1}}});
        must(reserved.count===1,"Inventory changed; retry");
        const demand=await tx.resourceRequest.updateMany({where:{id:request.id,version:request.version,
          quantity:request.quantity,quantityFulfilled:request.quantityFulfilled,
          quantityReserved:request.quantityReserved,status:"OPEN"},
          data:{quantityReserved:{increment:line.quantity},version:{increment:1}}});
        must(demand.count===1,"Request demand changed; retry");
        const status=await tx.transfer.updateMany({where:{id:transfer.id,status:"PROPOSED"},
          data:{status:"APPROVED",approvedAt:new Date()}});
        must(status.count===1,"Transfer changed; retry");
        await audit(tx,actor,"TRANSFER_APPROVED",transfer.id,{quantity:line.quantity});
        return tx.transfer.findUniqueOrThrow({where:{id:transfer.id}});
      });
    }
    case "transfer.decline":
    case "transfer.cancel": {
      return serializable(async tx=>{
        const transfer=await getTransfer(tx,command.id);
        const isProvider=actor.organizationId===transfer.senderId && ["PROVIDER","MANAGER","ADMIN"].includes(actor.role);
        const isRecipient=actor.id===transfer.proposerId || actor.role==="ADMIN";
        if(command.action==="transfer.decline" ? !isProvider : !isProvider && !isRecipient) throw new AccessError();
        const target=command.action==="transfer.decline"?"DECLINED":"CANCELLED";
        if(transfer.status===target) return transfer;
        must(command.action==="transfer.decline" ? transfer.status==="PROPOSED" :
          ["PROPOSED","APPROVED"].includes(transfer.status),"Transition not allowed");
        const line=transfer.items[0];
        if(transfer.status==="APPROVED") {
          const item=await tx.inventoryItem.findUniqueOrThrow({where:{id:line.inventoryId}});
          const request=await tx.resourceRequest.findUniqueOrThrow({where:{id:line.requestId}});
          must(item.quantityReserved>=line.quantity && request.quantityReserved>=line.quantity,"Reservation accounting mismatch");
          await tx.inventoryItem.update({where:{id:item.id},data:{quantityReserved:{decrement:line.quantity},version:{increment:1}}});
          await tx.resourceRequest.update({where:{id:request.id},data:{quantityReserved:{decrement:line.quantity},version:{increment:1}}});
        }
        const status=await tx.transfer.updateMany({where:{id:transfer.id,status:transfer.status},data:{status:target}});
        must(status.count===1,"Transfer changed; retry");
        await audit(tx,actor,"TRANSFER_"+target,transfer.id,{});
        return tx.transfer.findUniqueOrThrow({where:{id:transfer.id}});
      });
    }
    case "transfer.complete": {
      requireCapability(actor,"request");
      return serializable(async tx=>{
        const transfer=await getTransfer(tx,command.id);
        if(transfer.status==="COMPLETED") return transfer;
        must(transfer.status==="APPROVED","Approved reservation required");
        const line=transfer.items[0];
        const request=await tx.resourceRequest.findUniqueOrThrow({where:{id:line.requestId}});
        if(actor.id!==request.requesterId && actor.role!=="ADMIN" &&
          !(actor.organizationId===request.organizationId && actor.role==="COORDINATOR")) throw new AccessError();
        const item=await tx.inventoryItem.findUniqueOrThrow({where:{id:line.inventoryId}});
        must(item.quantityReserved>=line.quantity && item.quantity>=line.quantity &&
          request.quantityReserved>=line.quantity && request.quantityFulfilled+line.quantity<=request.quantity,
          "Reservation accounting mismatch");
        await tx.inventoryItem.update({where:{id:item.id},data:{quantity:{decrement:line.quantity},
          quantityReserved:{decrement:line.quantity},version:{increment:1}}});
        await tx.resourceRequest.update({where:{id:request.id},data:{quantityFulfilled:{increment:line.quantity},
          quantityReserved:{decrement:line.quantity},version:{increment:1},
          status:request.quantityFulfilled+line.quantity===request.quantity?"FULFILLED":"OPEN"}});
        const status=await tx.transfer.updateMany({where:{id:transfer.id,status:"APPROVED"},
          data:{status:"COMPLETED",completedAt:new Date()}});
        must(status.count===1,"Transfer changed; retry");
        await audit(tx,actor,"TRANSFER_COMPLETED",transfer.id,{quantity:line.quantity});
        return tx.transfer.findUniqueOrThrow({where:{id:transfer.id}});
      });
    }
    case "savings.verify": {
      requireCapability(actor,"coordinate");
      return serializable(async tx=>{
        const transfer=await getTransfer(tx,command.transferId);
        requireOrganization(actor,transfer.receiverId);
        must(transfer.status==="COMPLETED","Transfer must be completed");
        must(command.verifiedQuantity<=transfer.items.reduce((sum,i)=>sum+i.quantity,0),"Verified units exceed delivered units");
        const prior=await tx.savingsVerification.findUnique({where:{transferId:transfer.id}});
        must(!prior,"Transfer already verified");
        const verification=await tx.savingsVerification.create({data:{transferId:transfer.id,
          verifierId:actor.id,verifiedQuantity:command.verifiedQuantity,
          avoidedCostCents:command.avoidedCostCents,explanation:command.explanation}});
        await audit(tx,actor,"SAVINGS_VERIFIED",transfer.id,{quantity:command.verifiedQuantity,
          avoidedCostCents:command.avoidedCostCents});
        return verification;
      });
    }
    case "admin.organization.create": {
      requireCapability(actor,"admin");
      const {action:_,...values}=command; void _;
      return db.organization.create({data:values});
    }
    case "admin.user.create": {
      requireCapability(actor,"admin");
      const organization=await db.organization.findUnique({where:{id:command.organizationId}});
      must(organization,"Organization not found");
      return db.user.create({data:{name:command.name,email:command.email.toLowerCase(),
        authSubject:"github:"+command.githubAccountId,organizationId:command.organizationId,role:command.role}});
    }
  }
}

export async function liveSnapshot(actor:User) {
  const organizationId=actor.organizationId;
  const [requests,inventory,availableInventory,transfers,organizations,members,activity]=await Promise.all([
    db.resourceRequest.findMany({where:{organizationId},orderBy:{createdAt:"desc"}}),
    db.inventoryItem.findMany({where:{organizationId},orderBy:{updatedAt:"desc"}}),
    db.inventoryItem.findMany({where:{status:"ACTIVE",organizationId:{not:organizationId}},
      orderBy:{updatedAt:"desc"}}),
    db.transfer.findMany({where:{OR:[{senderId:organizationId},{receiverId:organizationId}]},
      include:{items:{include:{request:true,inventory:true}},sender:true,receiver:true,verification:true},
      orderBy:{createdAt:"desc"}}),
    db.organization.findMany(),
    actor.role==="ADMIN"?db.user.findMany({select:{id:true,name:true,email:true,role:true,organizationId:true}}):Promise.resolve([]),
    actor.role==="ADMIN"?db.auditEvent.findMany({take:50,orderBy:{createdAt:"desc"}}):Promise.resolve([]),
  ]);
  const completed=transfers.filter(t=>t.status==="COMPLETED");
  const stockAvailable=new Map(availableInventory.map(i=>[i.id,i.quantity-i.quantityReserved]));
  const demandAvailable=new Map(requests.map(r=>[r.id,r.quantity-r.quantityFulfilled-r.quantityReserved]));
  const activeRequests=new Map(requests.filter(r=>r.status==="OPEN" && r.neededBy>=new Date()).map(r=>[r.id,r]));
  let potentialCents=0;
  for(const transfer of transfers.filter(t=>t.status==="PROPOSED").sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime()||a.id.localeCompare(b.id))) {
    for(const line of transfer.items) {
      if(!activeRequests.has(line.requestId)) continue;
      const available=stockAvailable.get(line.inventoryId)??0;
      const demand=demandAvailable.get(line.requestId)??0;
      const units=Math.min(line.quantity,available,demand);
      if(units<=0) continue;
      stockAvailable.set(line.inventoryId,available-units);
      demandAvailable.set(line.requestId,demand-units);
      potentialCents+=units*line.replacementCostCents;
    }
  }
  return {actor:{id:actor.id,name:actor.name,role:actor.role,organizationId},requests,inventory,availableInventory,transfers,
    organizations,members,activity,impact:{
      activeRequests:requests.filter(r=>r.status==="OPEN").length,
      fulfilledRequests:requests.filter(r=>r.status==="FULFILLED").length,
      reservedUnits:inventory.reduce((sum,i)=>sum+i.quantityReserved,0),
      completedTransfers:completed.length,
      completedValueCents:completed.reduce((sum,t)=>sum+t.items.reduce((n,i)=>n+i.quantity*i.replacementCostCents,0),0),
      verifiedAvoidedCostCents:completed.reduce((sum,t)=>sum+(t.verification?.avoidedCostCents??0),0),
      potentialCents,
    }};
}
