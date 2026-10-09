import { signIn } from "@/auth";
import { Workspace } from "../components/workspace";
const demoDatabaseIsLocal = (() => {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.toLowerCase().includes("demo");
  } catch { return false; }
})();
const demoEnabled = process.env.NODE_ENV !== "production" && process.env.DEMO_MODE==="true" &&
  process.env.DEMO_DATABASE==="true" && demoDatabaseIsLocal;
export default async function SignIn({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const error=(await searchParams).error;
  return <Workspace page="Sign in"><h1>Sign in to ReSource</h1>
    <p className="subtitle">Only invited organization members can access the live workspace.</p>
    {error && <p role="alert" className="notice">Sign-in was not completed. Check that your account has been invited, then try again.</p>}
    <form action={async()=>{"use server"; await signIn("github",{redirectTo:"/live"});}}>
      <button className="action-button" type="submit">Sign in with GitHub</button>
    </form>
    {demoEnabled && <div className="card request-card"><h2>Demonstration environment — fictional data.</h2>
      <p>This local mode uses a dedicated demo database. Select a fictional account:</p>
      {[
        ["demo-user-1","Teacher, Cedar High"],["demo-user-2","Teacher, Orchard High"],
        ["demo-provider-1","Provider, Orchard High"],["demo-coordinator-1","Coordinator, Cedar High"],
      ].map(([id,label])=><form key={id} action={async()=>{"use server"; await signIn("fictional-demo",{identity:id,redirectTo:"/live"});}}>
        <button className="action-button" type="submit">{label}</button>
      </form>)}
    </div>}
  </Workspace>;
}
