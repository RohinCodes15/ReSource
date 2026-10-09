import { Workspace } from "../components/workspace";
import { MatchExplorer } from "./explorer";
export default function Matches() {
  return <Workspace page="Matches"><h1>More possibilities. Fewer purchases.</h1>
    <p className="subtitle">Combine compatible resources and explore the difference a shared supply can make.</p>
    <MatchExplorer />
  </Workspace>;
}
