import {describe,it,expect} from "vitest";
import type {User} from "@prisma/client";
import {allowed,requireOrganization} from "../src/permissions";
import {mutationSchema} from "../src/live";
const member=(role:User["role"],organizationId="a")=>({id:"u",name:"Test",email:"test@example.invalid",
  authSubject:null,role,organizationId}) as User;
describe("role permissions",()=>{
  it("grants teacher and provider only their own capabilities",()=>{
    expect(allowed(member("TEACHER"),"request")).toBe(true);
    expect(allowed(member("TEACHER"),"inventory")).toBe(false);
    expect(allowed(member("PROVIDER"),"inventory")).toBe(true);
    expect(allowed(member("PROVIDER"),"request")).toBe(false);
    expect(allowed(member("PROVIDER"),"coordinate")).toBe(false);
  });
  it("reserves verification and administration for authorized roles",()=>{
    expect(allowed(member("COORDINATOR"),"coordinate")).toBe(true);
    expect(allowed(member("COORDINATOR"),"admin")).toBe(false);
    expect(allowed(member("ADMIN"),"admin")).toBe(true);
  });
  it("enforces organization boundary",()=>{
    expect(()=>requireOrganization(member("PROVIDER","a"),"b")).toThrow();
    expect(()=>requireOrganization(member("PROVIDER","a"),"a")).not.toThrow();
  });
  it("rejects invalid transfer input before database access",()=>{
    expect(mutationSchema.safeParse({action:"transfer.propose",requestId:"a",inventoryId:"b",quantity:0,
      idempotencyKey:"not-a-uuid"}).success).toBe(false);
  });
});
