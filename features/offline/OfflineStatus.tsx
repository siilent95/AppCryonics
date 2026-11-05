"use client";
import { useState } from "react";
import { useOffline } from "./useOffline";
import { offlineEngine } from "./engine";
import { prepareDevice } from "./data";
export function OfflineStatus() {
  const s=useOffline();const [expanded,setExpanded]=useState(false);
  return <section className="offlineStatus" aria-label="Device storage and synchronization">
    <div className="offlineStatusLine"><span>{s.online?"Connected":"Offline"} · {s.pending?`${s.pending} device PM${s.pending===1?"":"s"} pending`:"No pending device changes"}</span><button type="button" className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>Device status</button></div>
    {s.error&&<p role="alert">{s.error} {s.error.includes("Sign in")&&<a href="/login">Sign in</a>}</p>}
    {s.preparing&&<p role="status">{s.progress}</p>}
    {!s.online&&s.prepared&&<p>Prepared data as of {new Date(s.prepared.at).toLocaleString()}. Other devices may have newer changes.</p>}
    {expanded&&<div className="offlineStatusDetails"><p>{s.prepared?`${s.prepared.complete?"Prepared for offline visits":"Partially prepared"}: ${s.prepared.reports} reports · ${s.prepared.images}/${s.prepared.totalImages} model images · ${s.prepared.documents}/${s.prepared.totalDocuments} datasheets` : "Prepare this tablet with a connection before visiting an area without signal."}</p><div className="offlineButtons"><button type="button" className="ghostButton" onClick={()=>void offlineEngine.sync()}>Synchronize now</button><button type="button" className="ghostButton" disabled={!s.online||s.preparing} onClick={()=>void prepareDevice()}>Prepare / update device</button><button type="button" className="ghostButton" disabled={!s.online||s.preparing} onClick={()=>void prepareDevice(true)}>Include datasheets</button></div>{process.env.NODE_ENV!=="production"&&<p>Offline app reopening is tested with a production build; development reload tools require a connection.</p>}{s.prepared?.errors.length? <ul>{s.prepared.errors.map((e,i)=><li key={i}>{e}</li>)}</ul>:null}</div>}
  </section>;
}
