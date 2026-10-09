import { Workspace } from "../components/workspace";
import { inventory, organizations } from "@/src/demo";
export default function Inventory() {
  return <Workspace page="Inventory"><h1>Put spare supplies to work.</h1><p className="subtitle">Available stock across the fictional school community.</p>
    <div className="inventory-grid">{inventory.map(item=><article className="card" key={item.id}>
      <span className="score">{item.condition}</span><h2 style={{marginTop:20}}>{item.title}</h2>
      <p>{organizations.find(o=>o.id===item.organizationId)?.name}</p>
      <div className="metric-value">{item.quantity-item.quantityReserved} available</div>
      <p className="match-meta">{item.quantity} in stock · {item.quantityReserved} reserved in the fictional scenario</p>
    </article>)}</div>
  </Workspace>;
}
