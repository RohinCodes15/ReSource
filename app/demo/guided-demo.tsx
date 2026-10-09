"use client";

import { useMemo, useState } from "react";
import { guidedInventory, guidedOrganizations, guidedPlan, guidedSteps } from "@/src/guided-demo";
import { money } from "@/src/domain";

export function GuidedDemo() {
  const [step, setStep] = useState(0);
  const [verifiedCents, setVerifiedCents] = useState(guidedPlan.financial.matchedValueCents);
  const [resetMessage, setResetMessage] = useState("");
  const current = guidedSteps[Math.min(step, guidedSteps.length - 1)];
  const proposals = useMemo(() => guidedPlan.lines.map(line => ({...line,
    organization: guidedOrganizations.find(org => org.id === line.providerId)?.name ?? "Fictional partner",
  })), []);
  const reset = () => {
    setStep(0); setVerifiedCents(guidedPlan.financial.matchedValueCents);
    setResetMessage("Simulation reset. No saved data was changed.");
  };
  return <section className="guided-demo" aria-label="Interactive fictional resource transfer simulation">
    <div className="demo-progress-row"><span className="scenario-status">{step === 10 ? "Walkthrough complete" : `Step ${step + 1} of 10`}</span>
      <button type="button" className="reset-button" onClick={reset}>Reset demo</button></div>
    <div className="progress-track" role="progressbar" aria-label="Demo progress" aria-valuemin={0} aria-valuemax={10} aria-valuenow={step}><span style={{width:`${step * 10}%`}} /></div>
    {step < 10 ? <article className="card demo-step-card" aria-live="polite">
      <p className="eyebrow">Step {step + 1}</p><h2>{current.title}</h2><p>{current.detail}</p>
      {step === 2 && <div className="demo-lines"><h3>Recommended provider plan</h3>{proposals.map(line=><div className="demo-line" key={line.inventoryId}><span>{line.organization}</span><strong>{line.quantity} units</strong></div>)}<p className="match-meta">{guidedPlan.explanation}</p></div>}
      {step === 3 && <div className="metric-value">{money(guidedPlan.financial.potentialAvoidedCostCents)} potential estimate</div>}
      {step === 4 && <div className="demo-lines">{proposals.map(line=><div className="demo-line" key={line.inventoryId}><span>{line.organization}</span><strong>Proposal · {line.quantity} units</strong></div>)}</div>}
      {step === 5 && <div className="demo-lines">{proposals.map(line=><div className="demo-line" key={line.inventoryId}><span>{line.organization}</span><strong>Approved · simulated</strong></div>)}</div>}
      {step === 6 && <div className="demo-lines">{guidedInventory.map(item=><div className="demo-line" key={item.id}><span>{item.title}</span><strong>{proposals.find(line=>line.inventoryId===item.id)?.quantity ?? 0} reserved · simulated</strong></div>)}</div>}
      {step === 7 && <div className="demo-result"><strong>Receipt confirmed · simulated</strong><span>25 units received in the fictional scenario.</span></div>}
      {step === 8 && <label className="demo-cost-field">Fictional verified gross purchasing cost avoided
        <span><span aria-hidden="true">$</span><input type="number" min="0" max={guidedPlan.financial.matchedValueCents / 100} step="0.01" value={(verifiedCents / 100).toFixed(2)} onChange={event=>setVerifiedCents(Math.round(Number(event.target.value || 0) * 100))} /></span>
        <small>Editable for the simulation; it is not evidence of a real-world saving.</small>
      </label>}
      <div className="demo-step-actions"><span className="match-meta">Fictional data · browser-only simulation</span>
        <button type="button" className="action-button" onClick={()=>{setStep(value=>Math.min(10,value+1));setResetMessage("");}}>{step === 9 ? "Complete walkthrough" : "Continue"} <span aria-hidden="true">→</span></button>
      </div>
    </article> : <article className="card demo-complete" aria-live="polite">
      <p className="eyebrow">Scenario summary · simulated, not persisted</p><h2>{guidedSteps[9].title}</h2>
      <div className="grid demo-metrics">
        <div><div className="metric-label">Potential value</div><div className="metric-value">{money(guidedPlan.financial.potentialAvoidedCostCents)}</div><small>Recommendation estimate</small></div>
        <div><div className="metric-label">Completed transfer value</div><div className="metric-value">{money(guidedPlan.financial.matchedValueCents)}</div><small>Simulated receipt</small></div>
        <div><div className="metric-label">Verified gross value</div><div className="metric-value">{money(verifiedCents)}</div><small>Simulated coordinator entry</small></div>
      </div>
      <p className="notice">All three amounts describe this fictional walkthrough. No completed real transfers, purchasing records, or verified savings are claimed.</p>
      <button type="button" className="action-button" onClick={reset}>Run the demo again</button>
    </article>}
    {resetMessage && <p className="match-meta" role="status">{resetMessage}</p>}
  </section>;
}
