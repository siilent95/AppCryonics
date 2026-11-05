"use client";
import { useEffect, useRef, useState } from "react";
import { offlineEngine } from "@/features/offline/engine";
import { canSaveWithShare, isAppleTouchDevice, pdfFile, sharePdf } from "../pdf-transfer";
export function PdfDownloadButton({ id, completed, requiresSignatures = true }: { id: string; completed: boolean; requiresSignatures?: boolean }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [prepared,setPrepared]=useState<File|null>(null);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  function browserDownload(file:File) {
    const url=URL.createObjectURL(file),anchor=document.createElement("a");
    anchor.href=url;anchor.download=file.name;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60_000);
  }
  async function download() {
    setBusy(true);setError("");
    try {
      // Do not leave for Safari's viewer until the protected return point is durable.
      await offlineEngine.rememberReport(id);
      request.current=new AbortController();
      const file=await pdfFile(await fetch(`/api/pm-records/${id}/pdf`,{cache:"no-store",headers:{Accept:"application/pdf"},signal:request.current.signal}));
      if(request.current.signal.aborted)return;
      if(isAppleTouchDevice(navigator)&&canSaveWithShare(file,navigator))setPrepared(file);
      else browserDownload(file);
    }catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Unable to download the PDF.");}
    finally{setBusy(false);}
  }
  async function save() {
    if(!prepared)return;
    setBusy(true);setError("");
    try{await sharePdf(prepared,navigator);}
    catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setError("The save menu could not open. Try Save PDF again, or use the browser download.");}
    finally{setBusy(false);}
  }
  return <div className="pdfDownload"><button className="primaryAction" type="button" disabled={!completed||busy} onClick={()=>void(prepared?save():download())}>{busy?(prepared?"Opening save menu…":"Preparing PDF…"):prepared?"Save PDF":"Download PDF"}</button>{prepared&&<><small role="status">PDF ready. Tap Save PDF, then choose Save to Files in the system menu.</small><button type="button" className="ghostButton" disabled={busy} onClick={()=>browserDownload(prepared)}>Use browser download</button></>}{!completed&&<small>{requiresSignatures?"Available after completion and signatures.":"Available after finalizing the correction."}</small>}{error&&<small role="alert">{error}</small>}</div>;
}
