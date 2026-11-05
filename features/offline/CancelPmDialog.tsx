"use client";
import { useEffect, useRef, useState } from "react";
import { useDialogDismiss } from "../shared/useDialogDismiss";

export function CancelPmDialog({ label, onConfirm, onClose }: { label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const dialog=useRef<HTMLDialogElement>(null),keep=useRef<HTMLButtonElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const dismiss=useDialogDismiss(busy);
  useEffect(()=>{dialog.current?.showModal();keep.current?.focus();},[]);
  return <dialog {...dismiss} ref={dialog} className="catalogDialog correctionDialog deleteReportDialog" aria-labelledby="cancel-pm-title" aria-describedby="cancel-pm-description" onClose={onClose}>
    <header><div><p>{label}</p><h2 id="cancel-pm-title">Cancel this PM?</h2></div></header>
    <p id="cancel-pm-description">Discard this new PM and its information from this device. It will not be uploaded or moved to Trash. This cannot be undone.</p>
    {error&&<p className="accountError" role="alert">{error}</p>}
    <div className="deleteReportActions"><button ref={keep} type="button" className="ghostButton" disabled={busy} onClick={()=>dialog.current?.close()}>Keep working</button><button type="button" className="dangerButton" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await onConfirm();onClose();}catch(e){setError(e instanceof Error?e.message:"Unable to cancel this PM. Your work is preserved.");}finally{setBusy(false);}}}>{busy?"Cancelling…":"Discard PM"}</button></div>
  </dialog>;
}
