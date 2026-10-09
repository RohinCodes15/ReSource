import Link from "next/link";
import { Workspace } from "../components/workspace";
import { demoResults, inventory, organizations, requests } from "@/src/demo";
export default function Dashboard() {
  const available = inventory.reduce((n,item)=>n+item.quantity-item.quantityReserved,0);
  const recommended = demoResults().filter(result=>result.matches.length>0).length;
  return <Workspace page="Overview"><h1>Resource sharing, at a glance.</h1><p className="subtitle">A snapshot of the fictional Fremont-area demo community. No live district data.</p>
    <div className="grid">{[["Open requests",requests.length],["Requests with matches",recommended],["Available units",available],["Demo organizations",organizations.length]].map(([label,value])=><div className="card" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">Fictional demo data</div></div>)}</div>
    <div className="section-row"><h2>Start exploring</h2></div><div className="two-col"><article className="card"><h2>Find what classrooms need</h2><p>Review requests alongside explainable recommendations.</p><Link href="/requests">Browse requests →</Link></article><article className="card"><h2>Follow a complete scenario</h2><p>See proposal, approval, delivery, and impact steps in a safe browser-only simulation.</p><Link href="/demo">Start guided demo →</Link></article></div>
    <p className="notice">No completed transfers or confirmed savings have been recorded in this dashboard. Recommendation scores rank options; they are not probabilities.</p>
  </Workspace>;
}
