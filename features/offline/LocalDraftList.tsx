"use client";
import { useEffect, useState } from "react";
import { offlineEngine } from "./engine";
import { useOffline } from "./useOffline";
import type { LocalDraft } from "./types";
import type { ReportDetail } from "../pm/types";
import { ReportPreview } from "../pm/components/ReportPreview";
import { entries } from "./vault";
import { localDetail } from "./reports";

export function LocalDraftList({onResume,onPreview}:{onResume:(id:string)=>void;onPreview:(id:string)=>void}) {
  const state=useOffline();
  const [drafts,setDrafts]=useState<LocalDraft[]>([]);
  const [recoveries,setRecoveries]=useState<LocalDraft[]>([]),[recovery,setRecovery]=useState<LocalDraft|null>(null);
  const [review,setReview]=useState<{local:LocalDraft;server:ReportDetail}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    offlineEngine.drafts().then(rows=>{if(active)setDrafts(rows.filter(d=>d.sequence>d.syncedSequence||!d.formal).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));}).catch(e=>setError(e.message));
    if(offlineEngine.user)entries<LocalDraft>(offlineEngine.user.id,"recovery:").then(rows=>{if(active)setRecoveries(rows);}).catch(e=>setError(e.message));
    return()=>{active=false;};
  },[state.revision]);
  async function compare(draft:LocalDraft) {
    setBusy(true);setError("");
    try {
      const response=await fetch(`/api/pm-records/${draft.server?.id}`,{cache:"no-store",signal:AbortSignal.timeout(10000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||"Reconnect with access to this PM to review the conflict.");
      setReview({local:draft,server:result});
    }catch(e){setError(e instanceof Error?e.message:"Unable to review this PM.");}finally{setBusy(false);}
  }
  async function resolve(keepLocal:boolean) {
    if(!review)return;setBusy(true);setError("");
    try {await offlineEngine.resolve(review.local.id,review.server,keepLocal);setReview(null);if(keepLocal)onResume(review.local.id);}
    catch(e){setError(e instanceof Error?e.message:"Unable to resolve the conflict.");}finally{setBusy(false);}
  }
  if(!drafts.length&&!recoveries.length&&!error&&!review)return null;
  return <section className="deviceDrafts dataPanel" aria-label="PMs stored on this tablet"><h2>Device drafts</h2><p>These PMs have device changes awaiting server confirmation. Keep this technician signed in until synchronization finishes.</p>
    {error&&<p role="alert">{error}</p>}
    <div className="deviceDraftList">{drafts.map(d=><article key={d.id}><div><strong>{d.server?.recordNumber||`LOCAL-${d.id.slice(0,8).toUpperCase()}`}</strong><span>{d.snapshot.catalogBrandName} · {d.snapshot.body.model} · {d.snapshot.body.freezerSerial||"Serial pending"}</span><small>{d.status==="blocked"?"Needs attention":d.closing?"Completion pending confirmation":d.formal?"Pending synchronization":"Saved on this tablet"} · {new Date(d.updatedAt).toLocaleString()}</small>{d.error&&<p role="alert">{d.error}</p>}</div><div className="offlineButtons">
      <button type="button" className="ghostButton" disabled={busy} onClick={()=>onPreview(d.id)}>Preview</button>
      {!d.closing&&<button type="button" className="ghostButton" disabled={busy} onClick={()=>onResume(d.id)}>Continue</button>}
      {d.errorCode===409&&<button type="button" className="ghostButton" disabled={!state.online||busy} onClick={()=>void compare(d)}>Review versions</button>}
      {d.status==="blocked"&&![403,404,409].includes(d.errorCode||0)&&<button type="button" className="ghostButton" disabled={busy} onClick={()=>{setBusy(true);offlineEngine.reopen(d.id).then(()=>onResume(d.id)).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Return to editing</button>}
    </div></article>)}</div>
    {recoveries.length>0&&<details className="conflictReview"><summary>Recovery copies ({recoveries.length})</summary><p>Read-only copies retained when resolving a conflict. They are removed from this tablet after a synchronized sign out.</p><div className="offlineButtons">{recoveries.map((d,i)=><button type="button" className="ghostButton" key={i} onClick={()=>setRecovery(d)}>{d.server?.recordNumber||"Local PM"} · {new Date(d.updatedAt).toLocaleString()}</button>)}</div>{recovery&&<><button className="ghostButton" type="button" onClick={()=>setRecovery(null)}>Close recovery preview</button><ReportPreview detail={localDetail(recovery)} loading={false} error="" /></>}</details>}
    {review&&<div className="conflictReview"><h3>Resolve {review.server.record.recordNumber}</h3><p>This PM changed on the server. Compare both copies before choosing. A protected recovery copy of your device work will be retained until sign out. Other PMs continue synchronizing.</p><div className="conflictCopies"><div><h4>Device copy</h4><ReportPreview detail={localDetail(review.local)} loading={false} error="" /></div><div><h4>Current server copy · revision {review.server.record.revision}</h4><ReportPreview detail={review.server} loading={false} error="" /></div></div><div className="offlineButtons"><button type="button" className="ghostButton" disabled={busy} onClick={()=>setReview(null)}>Decide later</button><button type="button" className="ghostButton" disabled={busy} onClick={()=>void resolve(false)}>Use server copy</button>{review.server.record.canEdit&&review.server.record.status==="draft"&&<button type="button" className="primaryAction" disabled={busy} onClick={()=>void resolve(true)}>Apply device copy to current draft</button>}</div></div>}
  </section>;
}
