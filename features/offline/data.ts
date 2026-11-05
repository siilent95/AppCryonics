import { offlineEngine } from "./engine";
import { entries, readEntry, writeEntry } from "./vault";
import { localDetail, filterReports } from "./reports";
import { offlineAnalytics } from "./analytics";
import type { PmRecordSummary, ReportDetail } from "../pm/types";
import type { EquipmentCatalog } from "../equipment/types";
import type { LocalDraft, Preparation } from "./types";

export class OfflineRequestError extends Error { constructor(message:string, readonly status:number) { super(message); } }
const parse=(url:string)=>new URL(url,"https://cryopm.local");
export async function preparedDetails() {
  const owner=offlineEngine.user?.id; if(!owner)return [];
  const index=await readEntry<PmRecordSummary[]>(owner,"report-index") || [];
  const details:ReportDetail[]=[];
  for (const record of index) { const d=await readEntry<ReportDetail>(owner,`report:${record.id}`); if(d)details.push(d); }
  for(const draft of await offlineEngine.drafts()) {
    if(!draft.formal)continue;
    const idx=details.findIndex(d=>d.record.id===draft.server?.id);
    if(idx>=0 && draft.sequence===draft.syncedSequence && (draft.server?.revision||0)<=details[idx].record.revision)continue;
    const d=localDetail(draft,idx>=0?details[idx]:undefined);
    if(idx>=0)details[idx]=d; else details.push(d);
  }
  return details;
}
async function cached(url:string):Promise<unknown> {
  const owner=offlineEngine.user?.id; if(!owner)throw new Error("No prepared technician is available on this device.");
  const u=parse(url);
  if(u.pathname==="/api/equipment") {
    const c=await readEntry<EquipmentCatalog>(owner,"catalog"); if(c)return c;
  }
  if(u.pathname==="/api/pm-records") {
    if(!await readEntry(owner,"report-index"))throw new Error("Prepare reports with a connection before using them offline.");
    return filterReports((await preparedDetails()).map(d=>d.record),u.searchParams);
  }
  const match=/^\/api\/pm-records\/([^/]+)$/.exec(u.pathname);
  if(match) {
    const drafts=await offlineEngine.drafts(); const local=drafts.find(d=>d.server?.id===match[1]||`local:${d.id}`===match[1]);
    const d=await readEntry<ReportDetail>(owner,`report:${match[1]}`);
    if(local && (!d || local.sequence>local.syncedSequence || (local.server?.revision||0)>d.record.revision))return localDetail(local,d); if(d)return d;
  }
  if(u.pathname.startsWith("/api/pm-analytics")) {
    if(!await readEntry(owner,"report-index"))throw new Error("Prepare reports to view statistics offline.");
    const days=Number(u.searchParams.get("days")||90); if(![7,30,90].includes(days))throw new Error("Invalid period.");
    const end=u.searchParams.get("end")||new Date().toISOString().slice(0,10);
    return offlineAnalytics(await preparedDetails(),{days:days as 7|30|90,brand:u.searchParams.get("brand")||"all",end},u.pathname.endsWith("/records")?u.searchParams:undefined);
  }
  if(u.pathname==="/api/pm-sync") {
    const d=await readEntry(owner,`capture:${u.searchParams.get("recordId")}`); if(d)return d;
  }
  throw new Error("This information has not been downloaded. Connect and prepare this tablet first.");
}
export async function offlineJson<T>(url:string, signal?:AbortSignal, strict=false):Promise<T> {
  if(url.includes("/local:")) return cached(url) as Promise<T>;
  let result: T;
  try {
    if(!offlineEngine.getState().online || (typeof navigator!=="undefined"&&!navigator.onLine))throw new TypeError("Offline");
    const response=await fetch(url,{cache:"no-store",headers:{Accept:"application/json"},signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(6000)]) : AbortSignal.timeout(6000)});
    if(response.status>=500)throw new TypeError("Server unavailable");
    const data=await response.json();
    if(!response.ok)throw new OfflineRequestError(data.error||"Unable to retrieve this information.",response.status);
    if(response.headers.get("X-CryoPM-Actor")!==offlineEngine.user?.id) {
      offlineEngine.publish({blocked:true,error:"The server session changed. Sign in as the technician who owns this device's pending work."});
      throw new OfflineRequestError("The server session belongs to a different technician.",403);
    }
    result=data;
    if(!offlineEngine.getState().online)offlineEngine.publish({online:true});
  } catch(error) {
    if(strict || signal?.aborted || (error instanceof OfflineRequestError && error.status!==401))throw error;
    if(error instanceof OfflineRequestError)offlineEngine.publish({error:"Sign in again as the current technician to synchronize. Your device copy is preserved."});
    else offlineEngine.publish({online:false});
    return cached(url) as Promise<T>;
  }
  // Storage failures must surface as storage failures, never as a successful offline save.
  const owner=offlineEngine.user?.id;
  if(owner) {
    const u=parse(url), data=result as Record<string,unknown>;
    if(u.pathname==="/api/equipment")await writeEntry(owner,"catalog",result);
    if(/^\/api\/pm-records\/[^/]+$/.test(u.pathname)&&data.record)await writeEntry(owner,`report:${(data.record as {id:string}).id}`,result);
    if(u.pathname==="/api/pm-sync")await writeEntry(owner,`capture:${u.searchParams.get("recordId")}`,result);
  }
  return result;
}
export function encodeBytes(bytes:Uint8Array) { let text="";for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text); }
async function resource(url:string, expected:"image/"|"application/pdf", expiresAt?:string|null) {
  const owner=offlineEngine.user!.id; const u=parse(url); if(u.origin!=="https://cryopm.local"&&u.origin!==location.origin)throw new Error("Only application assets can be prepared.");
  const response=await fetch(u.pathname+u.search,{cache:"no-store",signal:AbortSignal.timeout(20000)});
  const type=response.headers.get("content-type")||"";
  if(!response.ok||!type.startsWith(expected))throw new Error("The document or image could not be downloaded.");
  const declared=Number(response.headers.get("content-length"));if(declared>20_000_000)throw new Error("Document exceeds the device preparation limit.");
  const blob=await response.blob();if(blob.size>20_000_000)throw new Error("Document exceeds the device preparation limit.");
  await writeEntry(owner,`resource:${u.pathname+u.search}`,{type,bytes:encodeBytes(new Uint8Array(await blob.arrayBuffer())),expiresAt:expiresAt||null});
}
async function prepareShell() {
  if(!("serviceWorker" in navigator))return false;
  const registration=await navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"});
  const worker=registration.active||registration.waiting||registration.installing;
  if(!worker)throw new Error("Offline interface installation has not started.");
  if(worker.state!=="activated")await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("Offline interface installation timed out.")),20000);
    worker.addEventListener("statechange",()=>{if(worker.state==="activated"){clearTimeout(timeout);resolve();}if(worker.state==="redundant"){clearTimeout(timeout);reject(new Error("Offline interface installation failed."));}});
  });
  const cache=await caches.open("cryopm-shell-v1"); const response=await fetch("/offline",{cache:"reload",signal:AbortSignal.timeout(20000)});
  if(!response.ok||response.redirected)throw new Error("Offline interface could not be downloaded.");
  const html=await response.clone().text(); if(!html.includes("cryopm-offline-entry"))throw new Error("Invalid offline interface.");
  const urls=new Set<string>(["/brand/logo-light.png","/brand/logo-primary.png","/brand/icon.png","/brand/pwa-192.png","/brand/pwa-512.png","/brand/apple-touch-icon.png"]);
  const doc=new DOMParser().parseFromString(html,"text/html");
  doc.querySelectorAll("script[src],link[href]").forEach(el=>{const p=el.getAttribute("src")||el.getAttribute("href");if(p?.startsWith("/_next/static/")||p?.startsWith("/brand/"))urls.add(p);});
  // Save the shell only after its dependencies are verified; a failed refresh keeps the old shell.
  for(const url of urls) {
    const r=await fetch(url,{cache:"reload",signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error("An offline interface resource is unavailable.");
    if(url.includes(".css")) {
      const css=await r.clone().text();for(const m of css.matchAll(/url\(["']?([^\s)"']+)/g)){const u=new URL(m[1],new URL(url,location.origin));if(u.origin===location.origin&&u.pathname.startsWith("/_next/static/"))urls.add(u.pathname);}
    }
    await cache.put(url,r);
  }
  await cache.put("/offline",response);return true;
}
let preparing=false;
export async function prepareDevice(includeDocuments=false) {
  if(preparing||!offlineEngine.user)return;
  preparing=true; const owner=offlineEngine.user.id; const errors:string[]=[];
  const prepared:Preparation={at:new Date().toISOString(),reports:0,images:0,totalImages:0,documents:0,totalDocuments:0,complete:false,errors,shell:false};
  offlineEngine.publish({preparing:true,progress:"Checking technician and device storage…",error:""});
  try {
    await offlineEngine.sync();
    if(!offlineEngine.getState().online||offlineEngine.getState().blocked)throw new Error("Connect with the current technician before preparing this tablet.");
    const session=await fetch("/api/offline/session",{cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!session.ok||(await session.json()).user.id!==owner)throw new Error("Sign in again as the current technician before preparing.");
    await navigator.storage?.persist?.();
    const estimate=await navigator.storage?.estimate?.();
    if(estimate?.quota&&estimate.quota-(estimate.usage||0)<10_000_000)throw new Error("Not enough free device storage. Pending PMs have been preserved.");
    prepared.shell=await prepareShell();
    if(includeDocuments) {
      offlineEngine.publish({progress:"Preparing the offline document viewer…"});
      const manifest=await fetch("/api/pdfjs/offline-assets",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!manifest.ok)throw new Error("The offline document viewer manifest is unavailable.");
      const assets=(await manifest.json()).assets as string[];
      const cache=await caches.open("cryopm-shell-v1");
      for(const url of assets) {
        if(!/^\/api\/pdfjs\/(build|cmaps|standard_fonts|wasm)\/[a-zA-Z0-9_.-]+$/.test(url))throw new Error("Invalid document runtime resource.");
        if(await cache.match(url))continue;
        const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error("The offline document viewer is incomplete.");await cache.put(url,r);
      }
    }
    const catalogue=await offlineJson<EquipmentCatalog>("/api/equipment",undefined,true);
    prepared.totalImages=catalogue.models.filter(m=>m.imageUrl).length;
    prepared.totalDocuments=catalogue.models.filter(m=>m.datasheetUrl).length;
    for(const model of catalogue.models) {
      offlineEngine.publish({progress:`Preparing equipment images ${prepared.images}/${prepared.totalImages}…`});
      if(model.imageUrl)try {await resource(model.imageUrl,"image/");prepared.images++;}catch{errors.push(`Image: ${model.family} ${model.model}`);}
      if(includeDocuments&&model.datasheetUrl)try{await resource(model.datasheetUrl,"application/pdf");prepared.documents++;}catch{errors.push(`Datasheet: ${model.model}`);}
    }
    const index:PmRecordSummary[]=[];const seen=new Set<string>();let pages=1,total=0;
    for(let page=1;page<=pages;page++) {
      offlineEngine.publish({progress:`Preparing reports · page ${page}/${pages}…`});
      const r=await fetch(`/api/pm-records?view=active&page=${page}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});
      if(!r.ok||r.headers.get("X-CryoPM-Actor")!==owner)throw new Error("Reports could not be downloaded. The previous prepared copy was retained.");
      const data=await r.json();pages=data.pagination.pages;total=data.pagination.total;
      for(const row of data.records as PmRecordSummary[]) {
        if(seen.has(row.id))continue;seen.add(row.id);index.push(row);
        const detail=await offlineJson<ReportDetail>(`/api/pm-records/${row.id}`,undefined,true);await writeEntry(owner,`report:${row.id}`,detail);
        const versions=[detail];
        for(const version of detail.versions||[]) if(version.id!==row.id)versions.push(await offlineJson<ReportDetail>(`/api/pm-records/${version.id}`,undefined,true));
        if(row.canEdit)await offlineJson(`/api/pm-sync?recordId=${row.id}`,undefined,true);
        for(const version of versions) {
          const source=version.record.signatureReference||version.record;
          for(const role of ["technician","recipient"] as const) {
            if(source[`${role}SignatureCapturedAt`]&&!source[`${role}SignatureDeletedAt`]) {
              const expires=source[`${role}SignatureRetentionUntil`];
              if(expires&&Date.parse(expires)<=Date.now())continue;
              try{await resource(`/api/pm-records/${version.record.id}/signature?role=${role}`,"image/",expires);}catch{errors.push(`Signature image: ${version.record.recordNumber}`);}
            }
          }
        }
        prepared.reports++;
      }
    }
    if(index.length!==total)throw new Error("The report collection changed during preparation. Retry to complete the device copy.");
    await writeEntry(owner,"report-index",index);
    prepared.complete=prepared.shell&&prepared.images===prepared.totalImages&&errors.length===0;
    await writeEntry(owner,"prepared",prepared);offlineEngine.publish({prepared,online:true,progress:prepared.complete?"Ready for offline visits":"Partially prepared — review missing resources"});
  } catch(error) { const message=error instanceof Error?error.message:"Device preparation failed.";prepared.complete=false;errors.push(message);await writeEntry(owner,"prepared",prepared).catch(()=>{});offlineEngine.publish({prepared,error:message,progress:"Preparation incomplete. Existing device work was preserved."}); }
  finally {preparing=false;offlineEngine.publish({preparing:false});}
}
export async function readLocal(id:string) { const drafts=await entries<LocalDraft>(offlineEngine.user!.id,"draft:");return drafts.find(d=>d.id===id||d.server?.id===id); }
