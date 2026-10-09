import { Workspace } from "../components/workspace";
import { GuidedDemo } from "./guided-demo";

export default function DemoPage() {
  return <Workspace page="Guided demo"><p className="eyebrow">10-step interactive walkthrough</p>
    <h1>From classroom need to shared resources.</h1>
    <p className="subtitle">Follow one fictional request through matching, provider decisions, delivery, and impact reporting.</p>
    <div className="notice"><strong>Simulation only — no database or accounts required.</strong> Every step runs in this browser session. Reset clears the simulation; nothing is saved or sent.</div>
    <GuidedDemo />
  </Workspace>;
}
