import { Workspace } from "../components/workspace";
import { demoResults, organizations } from "@/src/demo";
import { money } from "@/src/domain";
export default function Requests() {
  return <Workspace page="Requests"><h1>Find what your classroom needs.</h1><p className="subtitle">Open requests, ranked recommendations, and the reasoning behind each match.</p>
    {demoResults().map(({request,matches}) => <section className="card request-card" key={request.id}>
      <h2>{request.title}</h2><p>{organizations.find(o=>o.id===request.organizationId)?.name}</p>
      <p className="subtitle">{request.quantity-request.quantityFulfilled} units needed · Priority {request.urgency}/5 · Due {request.neededBy.slice(0,10)}</p>
      {matches.length === 0 && <p>No eligible inventory yet. Check back as partners add resources.</p>}
      {matches.map(match => <details key={match.inventoryId}>
        <summary>{match.title} — {match.score}/100 ranking score</summary>
        <p>{match.explanation}</p><p>Potential gross benefit: {money(match.savingsCents)}. Recommendations may compete for the same inventory; they are not reservations.</p>
        <ul>{match.factors.map(f=><li key={f.key}><strong>{f.key}: {f.points.toFixed(1)}/{f.weight} points.</strong> {f.explanation}</li>)}</ul>
      </details>)}
    </section>)}
  </Workspace>;
}
