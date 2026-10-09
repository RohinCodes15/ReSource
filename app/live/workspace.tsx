"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/src/domain";
import { signOut } from "next-auth/react";
import { allocate } from "@/src/allocation";

type Snapshot = Awaited<ReturnType<typeof import("@/src/live").liveSnapshot>>;
const resourceTypes=["GRAPHING_CALCULATOR","SCIENTIFIC_CALCULATOR","BASIC_CALCULATOR","NOTEBOOK","SCIENCE_POSTER"];
const conditions=["FAIR","GOOD","NEW"];
function human(value:string) {return value.replaceAll("_"," ").toLowerCase().replace(/^./,s=>s.toUpperCase());}
export function LiveWorkspace() {
  const [data,setData]=useState<Snapshot|null>(null);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [view,setView]=useState<"overview"|"requests"|"inventory"|"matches"|"transfers"|"admin">("overview");
  const refresh=useCallback(async()=>{
    const response=await fetch("/api/live",{cache:"no-store"});
    const body=await response.json();
    if(!response.ok) throw new Error(body.error??"Unable to load workspace");
    setData(body);
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
  async function mutate(command:Record<string,unknown>,confirmation?:string) {
    if(confirmation && !window.confirm(confirmation)) return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/live",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(command)});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error??"Action failed");
      await refresh();
      setNotice("Saved successfully.");
    } catch(e) {setError(e instanceof Error?e.message:"Action failed");}
    finally {setBusy(false);}
  }
  if(!data) return <main className="content"><h1>Live workspace</h1><p role={error?"alert":"status"}>{error||"Loading..."}</p><Link href="/">Return to fictional demo</Link></main>;
  const {actor,requests,inventory,transfers,impact}=data;
  const canRequest=["TEACHER","MANAGER","COORDINATOR","ADMIN"].includes(actor.role);
  const canInventory=["PROVIDER","MANAGER","ADMIN"].includes(actor.role);
  const canVerify=["COORDINATOR","MANAGER","ADMIN"].includes(actor.role);
  const org=data.organizations.find(o=>o.id===actor.organizationId);
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">↗</div><span>ReSource</span></div>
    <nav aria-label="Live workspace">{(["overview","requests","inventory","matches","transfers",...(actor.role==="ADMIN"?["admin" as const]:[])] as const).map(name=>
      <button key={name} className={"nav-item "+(view===name?"active":"")} aria-current={view===name?"page":undefined} onClick={()=>setView(name)}>{human(name)}</button>)}</nav>
    <p className="match-meta"><Link href="/">Fictional read-only demo</Link></p>
    <button className="nav-item" onClick={()=>void signOut({callbackUrl:"/"})}>Sign out</button></aside>
    <div className="main"><header className="topbar"><span>{org?.name} · {actor.name} ({human(actor.role)})</span>
      <span className="score">{process.env.NODE_ENV==="development"?"Local workspace":"Authorized workspace"}</span></header>
    <main className="content">
      <h1>{human(view)}</h1>
      <p className="subtitle">Persistent organization workspace. Actions update PostgreSQL.</p>
      {error && <p className="notice" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      {view==="overview" && <div className="grid">{[
        ["Active requests",impact.activeRequests],["Fulfilled requests",impact.fulfilledRequests],
        ["Reserved units",impact.reservedUnits],["Completed transfers",impact.completedTransfers],
        ["Proposed value",money(impact.potentialCents)],["Completed transfer value",money(impact.completedValueCents)],
        ["Verified purchasing cost avoided",money(impact.verifiedAvoidedCostCents)],
      ].map(([label,value])=><div className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}
        <p className="notice">Proposed value, completed transfer value, and verified avoided purchasing cost are separate measures. Verified values are gross; handling costs are not deducted here.</p>
      </div>}
      {view==="requests" && <>
        {canRequest && <form className="card live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate({
          action:"request.create",title:String(f.get("title")),resourceType:String(f.get("resourceType")),
          quantity:Number(f.get("quantity")),minimumCondition:String(f.get("condition")),
          replacementCostCents:Math.round(Number(f.get("cost"))*100),urgency:Number(f.get("urgency")),
          neededBy:new Date(String(f.get("neededBy"))).toISOString(),
        });e.currentTarget.reset();}}><h2>New request</h2>
          <label>Title<input name="title" required minLength={3}/></label><label>Resource type<select name="resourceType">{resourceTypes.map(t=><option value={t} key={t}>{human(t)}</option>)}</select></label>
          <label>Quantity<input name="quantity" type="number" min="1" max="100000" required/></label>
          <label>Minimum condition<select name="condition">{conditions.map(c=><option value={c} key={c}>{human(c)}</option>)}</select></label>
          <label>Replacement cost per unit ($)<input name="cost" type="number" min="0" step=".01" required/></label>
          <label>Priority (1–5)<input name="urgency" type="number" min="1" max="5" defaultValue="3" required/></label>
          <label>Needed by<input name="neededBy" type="datetime-local" required/></label>
          <button disabled={busy}>Create request</button></form>}
        {requests.map(r=><article className="card request-card" key={r.id}><h2>{r.title}</h2><p>{human(r.resourceType)} · {r.quantityFulfilled}/{r.quantity} fulfilled · {r.quantityReserved} reserved · {r.status}</p>
          {canRequest && (r.requesterId===actor.id || actor.role==="ADMIN") && <div>
            {r.status==="OPEN" && r.quantityReserved===0 && r.quantityFulfilled===0 && <details><summary>Edit request</summary>
              <form className="live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate({
                action:"request.edit",id:r.id,title:String(f.get("title")),quantity:Number(f.get("quantity")),
                minimumCondition:String(f.get("condition")),replacementCostCents:Math.round(Number(f.get("cost"))*100),
                urgency:Number(f.get("urgency")),neededBy:new Date(String(f.get("neededBy"))).toISOString(),
              });}}>
                <label>Title<input name="title" defaultValue={r.title} minLength={3} required/></label>
                <label>Quantity<input name="quantity" type="number" min="1" defaultValue={r.quantity} required/></label>
                <label>Minimum condition<select name="condition" defaultValue={r.minimumCondition}>{conditions.map(c=><option value={c} key={c}>{human(c)}</option>)}</select></label>
                <label>Replacement cost per unit ($)<input name="cost" type="number" min="0" step=".01" defaultValue={(r.replacementCostCents/100).toFixed(2)} required/></label>
                <label>Priority<input name="urgency" type="number" min="1" max="5" defaultValue={r.urgency} required/></label>
                <label>Needed by<input name="neededBy" type="datetime-local" defaultValue={new Date(r.neededBy).toISOString().slice(0,16)} required/></label>
                <button disabled={busy}>Save request</button>
              </form></details>}
            <div className="live-actions">
            <button disabled={busy||r.quantityReserved>0||r.status!=="OPEN"} onClick={()=>void mutate({action:"request.close",id:r.id},"Cancel this open request?")}>Cancel request</button>
            </div></div>}</article>)}
      </>}
      {view==="inventory" && <>
        {canInventory && <form className="card live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate({
          action:"inventory.create",title:String(f.get("title")),resourceType:String(f.get("resourceType")),
          quantity:Number(f.get("quantity")),condition:String(f.get("condition")),
        });e.currentTarget.reset();}}><h2>Add inventory</h2>
          <label>Title<input name="title" required minLength={3}/></label><label>Resource type<select name="resourceType">{resourceTypes.map(t=><option value={t} key={t}>{human(t)}</option>)}</select></label>
          <label>Quantity<input name="quantity" type="number" min="1" required/></label>
          <label>Condition<select name="condition">{conditions.map(c=><option value={c} key={c}>{human(c)}</option>)}</select></label>
          <button disabled={busy}>Add inventory</button></form>}
        {inventory.map(i=><article className="card request-card" key={i.id}><h2>{i.title}</h2><p>{human(i.resourceType)} · {i.quantity-i.quantityReserved} available · {i.quantityReserved} reserved · {i.status}</p>
          <p className="match-meta">{transfers.filter(t=>t.status==="COMPLETED").flatMap(t=>t.items).filter(line=>line.inventoryId===i.id).reduce((sum,line)=>sum+line.quantity,0)} units completed through transfers</p>
          {canInventory && <div>
            {i.status==="ACTIVE" && <details><summary>Edit listing</summary>
              <form className="live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void mutate({
                action:"inventory.edit",id:i.id,title:String(f.get("title")),quantity:Number(f.get("quantity")),
                condition:String(f.get("condition")??i.condition),
              });}}>
                <label>Title<input name="title" defaultValue={i.title} minLength={3} required/></label>
                <label>Total units on hand<input name="quantity" type="number" min={i.quantityReserved} defaultValue={i.quantity} required/></label>
                <label>Condition<select name="condition" defaultValue={i.condition} disabled={i.quantityReserved>0}>{conditions.map(c=><option value={c} key={c}>{human(c)}</option>)}</select></label>
                <button disabled={busy}>Save listing</button>
              </form></details>}
            <div className="live-actions">
            <button disabled={busy||i.quantityReserved>0||i.status!=="ACTIVE"} onClick={()=>void mutate({action:"inventory.retire",id:i.id},"Retire this listing?")}>Retire</button>
            </div></div>}</article>)}
      </>}
      {view==="matches" && <><p className="subtitle">Recommendations use current database inventory and reservations. Each proposal needs provider approval.</p>
        {requests.filter(r=>r.status==="OPEN").map(r=>{
          const projection=allocate({
            id:r.id,organizationId:r.organizationId,requesterId:r.requesterId,title:r.title,
            resourceType:r.resourceType as typeof resourceTypes[number] & "GRAPHING_CALCULATOR",
            quantity:r.quantity,quantityFulfilled:r.quantityFulfilled+r.quantityReserved,
            minimumCondition:r.minimumCondition,replacementCostCents:r.replacementCostCents,urgency:r.urgency,
            neededBy:r.neededBy.toISOString(),status:r.status,
          },data.availableInventory.map(i=>({id:i.id,organizationId:i.organizationId,title:i.title,
            resourceType:i.resourceType as "GRAPHING_CALCULATOR",quantity:i.quantity,quantityReserved:i.quantityReserved,
            condition:i.condition,status:i.status})),data.organizations,new Date());
          return <article className="card request-card" key={r.id}><h2>{r.title}</h2><p>{projection.allocated} suggested units · {projection.unmet} unmet · {money(projection.financial.potentialAvoidedCostCents)} potential gross purchasing cost avoided</p>
            {projection.lines.map(line=><div className="match" key={line.inventoryId}><span>{line.provider} · {line.quantity} {line.title}</span>
              {canRequest && r.requesterId===actor.id && <button disabled={busy} onClick={()=>void mutate({action:"transfer.propose",
                requestId:r.id,inventoryId:line.inventoryId,quantity:line.quantity,idempotencyKey:crypto.randomUUID()})}>Propose transfer</button>}</div>)}
            {projection.matches.map(m=><details key={m.inventoryId}><summary>{m.title} · {m.score}/100</summary>
              <ul>{m.factors.map(f=><li key={f.key}>{f.explanation}</li>)}</ul></details>)}
          </article>;
        })}</>}
      {view==="transfers" && <>{transfers.length===0 && <p>No transfers yet. Propose one from Matches.</p>}
        {transfers.map(t=>{const line=t.items[0];if(!line)return null;
          const provider=t.senderId===actor.organizationId;
          const recipient=t.receiverId===actor.organizationId;
          return <article className="card request-card" key={t.id}><h2>{line.inventory.title}</h2>
            <p>{line.quantity} units · {t.sender.name} → {t.receiver.name} · {t.status}</p>
            <p>Estimated replacement value: {money(line.quantity*line.replacementCostCents)}</p>
            <p className="match-meta">Proposed {new Date(t.createdAt).toLocaleString()} {t.approvedAt&&" · Approved "+new Date(t.approvedAt).toLocaleString()} {t.completedAt&&" · Completed "+new Date(t.completedAt).toLocaleString()}</p>
            <div className="live-actions">
              {provider&&canInventory&&t.status==="PROPOSED"&&<><button disabled={busy} onClick={()=>void mutate({action:"transfer.approve",id:t.id},"Approve and reserve this inventory?")}>Approve & reserve</button>
                <button disabled={busy} onClick={()=>void mutate({action:"transfer.decline",id:t.id},"Decline this proposal?")}>Decline</button></>}
              {(provider&&canInventory||t.proposerId===actor.id)&&["PROPOSED","APPROVED"].includes(t.status)&&
                <button disabled={busy} onClick={()=>void mutate({action:"transfer.cancel",id:t.id},"Cancel this transfer? Approved reservations will be released.")}>Cancel</button>}
              {recipient&&canRequest&&t.status==="APPROVED"&&<button disabled={busy} onClick={()=>void mutate({action:"transfer.complete",id:t.id},"Confirm these items were received?")}>Confirm receipt</button>}
            </div>
            {t.status==="COMPLETED"&&recipient&&canVerify&&!t.verification&&<form className="live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);
              void mutate({action:"savings.verify",transferId:t.id,verifiedQuantity:Number(f.get("quantity")),
                avoidedCostCents:Math.round(Number(f.get("cost"))*100),explanation:String(f.get("explanation"))},"Verify these avoided purchasing costs?");}}>
              <h2>Verify avoided purchasing costs</h2><label>Verified units<input name="quantity" type="number" min="1" max={line.quantity} required/></label>
              <label>Gross purchase cost avoided ($)<input name="cost" type="number" min="0" step=".01" required/></label>
              <label>Evidence / explanation<input name="explanation" maxLength={1000}/></label><button disabled={busy}>Record verification</button>
            </form>}
            {t.verification&&<p className="notice">Verified gross purchasing cost avoided: {money(t.verification.avoidedCostCents)} for {t.verification.verifiedQuantity} units.</p>}
          </article>;
        })}</>}
      {view==="admin" && actor.role==="ADMIN" && <>
        <div className="two-col">
          <form className="card live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);
            void mutate({action:"admin.organization.create",name:String(f.get("name")),
              latitude:Number(f.get("latitude")),longitude:Number(f.get("longitude"))});e.currentTarget.reset();}}>
            <h2>Add organization</h2><label>Name<input name="name" required minLength={3}/></label>
            <label>Verified school latitude<input name="latitude" type="number" step="any" min="-90" max="90" required/></label>
            <label>Verified school longitude<input name="longitude" type="number" step="any" min="-180" max="180" required/></label>
            <button disabled={busy}>Add organization</button>
          </form>
          <form className="card live-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);
            void mutate({action:"admin.user.create",name:String(f.get("name")),email:String(f.get("email")),
              role:String(f.get("role")),organizationId:String(f.get("organizationId")),
              githubAccountId:String(f.get("githubAccountId"))});e.currentTarget.reset();}}>
            <h2>Authorize member</h2><label>Name<input name="name" required/></label><label>Email<input type="email" name="email" required/></label>
            <label>GitHub numeric account ID<input name="githubAccountId" required/></label>
            <label>Organization<select name="organizationId">{data.organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></label>
            <label>Role<select name="role">{["TEACHER","PROVIDER","COORDINATOR","MANAGER","ADMIN"].map(r=><option value={r} key={r}>{human(r)}</option>)}</select></label>
            <button disabled={busy}>Authorize member</button>
          </form>
        </div>
        <div className="card request-card"><h2>Authorized members</h2>
          {data.members.map(member=><p key={member.id}>{member.name} · {member.email} · {human(member.role)} · {data.organizations.find(o=>o.id===member.organizationId)?.name}</p>)}
        </div>
        <div className="card request-card"><h2>Recent activity</h2>
          {data.activity.map(event=><p key={event.id}>{new Date(event.createdAt).toLocaleString()} · {human(event.action)} · {event.transferId}</p>)}
        </div>
      </>}
    </main></div></div>;
}
