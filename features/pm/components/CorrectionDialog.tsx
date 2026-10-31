"use client";
import { useDialogDismiss } from "@/features/shared/useDialogDismiss";
import { useEffect, useRef, useState } from "react";
import type { PmRecordSummary } from "../types";
export function CorrectionDialog({ record, onClose, onCreated }: { record: PmRecordSummary; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  const dismiss = useDialogDismiss(busy);
  return <dialog {...dismiss} ref={dialog} className="catalogDialog correctionDialog" aria-labelledby="correction-title" onClose={onClose}>
    <header><div><p>{record.recordNumber}</p><h2 id="correction-title">Create a correction</h2></div><button className="ghostButton" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button></header>
    <p>The signed version stays in Version history. The correction records its reason and author. Original signatures remain linked to their signed version; new signatures are not required.</p>
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try {
      const response = await fetch(`/api/pm-records/${record.id}/corrections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, expectedRevision: record.revision }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to create correction.");
      await onCreated(result.record.id); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create correction."); } finally { setBusy(false); } }}>
      <label>Reason for correction<textarea autoFocus value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} required rows={4} /></label>
      {error && <p role="alert" className="accountError">{error}</p>}
      <button className="primaryAction" type="submit" disabled={busy || !reason.trim()}>{busy ? "Creating…" : "Create editable version"}</button>
    </form>
  </dialog>;
}
