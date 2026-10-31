"use client";
import { useDialogDismiss } from "@/features/shared/useDialogDismiss";
import { useEffect, useRef, useState } from "react";
import { TRASH_RETENTION_DAYS } from "../trash-policy";
import type { PmRecordSummary } from "../types";
export function DeleteReportDialog({ record, onClose, onDeleted }: { record: PmRecordSummary; onClose: () => void; onDeleted: (ids: string[]) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!dialog.current?.open) { dialog.current?.showModal(); cancel.current?.focus(); } }, []);
  const dismiss = useDialogDismiss(busy);
  return <dialog {...dismiss} ref={dialog} className="catalogDialog correctionDialog deleteReportDialog" aria-labelledby="delete-report-title" aria-describedby="delete-report-description" onClose={onClose}>
    <header><div><p>{record.recordNumber}</p><h2 id="delete-report-title">Delete this PM?</h2></div></header>
    <p id="delete-report-description">This PM and all its versions will move to Trash and leave Reports and statistics. You can restore them for {TRASH_RETENTION_DAYS} days. After that, the PM, all versions and signatures are permanently deleted.</p>
    <div className="deleteReportIdentity"><strong>{record.modelFamily} · {record.model}</strong><span>{record.freezerSerial || "Serial pending"}</span></div>
    {error && <p className="accountError" role="alert">{error}</p>}
    <div className="deleteReportActions"><button ref={cancel} className="ghostButton" type="button" disabled={busy} onClick={() => dialog.current?.close()}>Keep PM</button><button className="dangerButton" disabled={busy} type="button" onClick={async () => {
      setBusy(true); setError("");
      try { const response = await fetch(`/api/pm-records/${record.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: record.revision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to delete the PM."); onDeleted(result.ids); onClose(); }
      catch (error) { setError(error instanceof Error ? error.message : "Unable to delete the PM."); } finally { setBusy(false); }
    }}>{busy ? "Deleting…" : "Delete PM"}</button></div>
  </dialog>;
}
