"use client";
import { useState } from "react";
import { allocate } from "@/src/allocation";
import { DEMO_DATE, inventory, organizations, requests } from "@/src/demo";
import { money, type ResourceRequest } from "@/src/domain";

export function MatchExplorer() {
  const [requestId,setRequestId] = useState(requests[0].id);
  const request = requests.find(r=>r.id===requestId)!;
  const [quantity,setQuantity] = useState(String(request.quantity));
  const [condition,setCondition] = useState<ResourceRequest["minimumCondition"]>(request.minimumCondition);
  const [excluded,setExcluded] = useState<string[]>([]);
  const reset = (r = request) => { setQuantity(String(r.quantity)); setCondition(r.minimumCondition); setExcluded([]); };
  const hypothetical = quantity!==String(request.quantity) || condition!==request.minimumCondition || excluded.length>0;
  let result: ReturnType<typeof allocate> | undefined;
  let error = "";
  try {
    if (!/^\d+$/.test(quantity) || Number(quantity)<1 || Number(quantity)>100000 || Number(quantity)<request.quantityFulfilled)
      throw new Error("Enter a whole quantity from 1 to 100,000, at least as large as the already fulfilled quantity.");
    result = allocate(request,inventory,organizations,DEMO_DATE,{quantity:Number(quantity),minimumCondition:condition,excludedProviders:excluded});
  } catch (e) { error = e instanceof Error ? e.message : "Unable to calculate this scenario."; }
  return <div className="explorer">
    <section className="card scenario-controls" aria-label="Scenario controls">
      <label htmlFor="request-select">Resource request</label>
      <select id="request-select" value={requestId} onChange={e=>{ const next=requests.find(r=>r.id===e.target.value)!; setRequestId(next.id); reset(next); }}>
        {requests.map(r=><option value={r.id} key={r.id}>{r.title}</option>)}
      </select>
      <p className="match-meta">Original request: {request.quantity} units · {request.minimumCondition} minimum · Due {request.neededBy.slice(0,10)}</p>
      <div className="section-row"><h2>What-if simulation</h2><button className="reset-button" onClick={()=>reset()} disabled={!hypothetical}>Reset</button></div>
      <label htmlFor="quantity">Total requested quantity</label>
      <input id="quantity" inputMode="numeric" value={quantity} aria-invalid={!!error} aria-describedby={error?"scenario-error":undefined} onChange={e=>setQuantity(e.target.value)} />
      <label htmlFor="condition">Minimum condition</label>
      <select id="condition" value={condition} onChange={e=>setCondition(e.target.value as ResourceRequest["minimumCondition"])}>
        <option value="FAIR">Fair or better</option><option value="GOOD">Good or better</option><option value="NEW">New only</option>
      </select>
      <fieldset><legend>Exclude providers</legend>{organizations.filter(o=>o.id!==request.organizationId).map(o=>
        <label className="checkbox-label" key={o.id}><input type="checkbox" checked={excluded.includes(o.id)} onChange={e=>setExcluded(e.target.checked?[...excluded,o.id]:excluded.filter(id=>id!==o.id))} />{o.name}</label>
      )}</fieldset>
      <p className="match-meta">Changes are hypothetical. Stored requests and inventory stay unchanged.</p>
    </section>
    <section aria-label="Allocation results">
      <div className="scenario-status">{hypothetical?"Hypothetical scenario":"Original request"} · Proposal only</div>
      {error && <p id="scenario-error" role="alert" className="notice">{error}</p>}
      {result && <>
        <p role="status" className="coverage-summary">{result.allocated} of {result.remaining} remaining units covered · {result.unmet} unmet · {result.providerCount} providers</p>
        <div className="allocation-metrics">{[
          ["Compatible supply",String(result.totalSupply)],
          ["Suggested units",String(result.allocated)],
          ["Request coverage",result.financial.coveragePercent.toFixed(1)+"%"],
          ["Potential cost avoided",money(result.financial.potentialAvoidedCostCents)],
        ].map(([label,value])=><div className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>)}</div>
        <div className="card request-card">
          <h2>Recommended allocation</h2><p>{result.explanation}</p>
          {result.lines.length===0 ? <p>No eligible supply for this scenario. Try relaxing condition requirements or including more providers.</p> :
            <ol className="allocation-list">{result.lines.map(line=><li key={line.inventoryId}><div><strong>{line.provider}</strong><p>{line.title}</p><small>{line.reason}</small></div><span className="score">{line.quantity} units</span></li>)}</ol>}
          <dl className="financial-breakdown"><div><dt>Remaining request replacement estimate</dt><dd>{money(result.financial.requestedValueCents)}</dd></div>
            <div><dt>Matched replacement estimate / potential cost avoided</dt><dd>{money(result.financial.matchedValueCents)}</dd></div>
            <div><dt>Unfulfilled replacement estimate</dt><dd>{money(result.financial.unfulfilledValueCents)}</dd></div></dl>
          <p className="match-meta">All financial values are estimates using the requester’s replacement price. Handling costs are excluded. Proposed quantities are not reserved or confirmed savings.</p>
        </div>
        <h2>Compatible inventory, ranked</h2>
        <p className="subtitle">Ranking scores explain suitability; the allocation groups providers to reduce transfers.</p>
        {result.matches.map(match=><details className="card match-detail" key={match.inventoryId}>
          <summary>{match.title} · {match.score}/100</summary><p>{match.provider} · {match.available} available units</p>
          <ul>{match.factors.map(f=><li key={f.key}><strong>{f.points.toFixed(1)}/{f.weight} points.</strong> {f.explanation}</li>)}</ul>
        </details>)}
        <p className="match-meta">Each request is evaluated independently. Do not add proposals across requests: they may compete for the same stock.</p>
      </>}
    </section>
  </div>;
}
