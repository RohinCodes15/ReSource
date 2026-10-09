import Link from "next/link";
export function Workspace({page, children}:{page:string;children:React.ReactNode}) {
  return <div className="shell">
    <aside className="sidebar"><Link className="brand" href="/"><div className="brand-mark" aria-hidden="true">↗</div><span>ReSource</span></Link>
      <nav aria-label="Workspace">{[["Overview","/dashboard"],["Guided demo","/demo"],["Requests","/requests"],["Matches","/matches"],["Inventory","/inventory"],["Live workspace","/live"]].map(([label,href]) =>
        <Link className={"nav-item "+(page===label?"active":"")} aria-current={page===label?"page":undefined} href={href} key={href}>{label}</Link>)}</nav>
    </aside>
    <div className="main"><header className="topbar"><span className="crumb">Demo workspace / {page}</span><span className="score">Fictional data</span></header>
      <main className="content"><p className="eyebrow">Fremont-area school sharing scenario</p>{children}
        <div className="notice"><strong>Demonstration environment — fictional data.</strong> All organizations, people, locations, and activity are fictional. No affiliation with Fremont Unified School District is claimed. Demo evaluated as of October 8, 2026. Estimates are not verified savings.</div>
      </main>
    </div>
  </div>;
}
