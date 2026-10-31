"use client";
import { useState } from "react";
import { accountRequest, useUsers } from "./useUsers";
export function PmAssignment({ record, onAssigned }: { record: { id: string; revision: number; assignedTechnicianId?: string | null; assignedTechnicianName?: string | null }; onAssigned: () => void }) {
  const users = useUsers(0);
  const [technicianId, setTechnicianId] = useState(record.assignedTechnicianId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function assign() {
    setBusy(true); setError(""); setNotice("");
    try { await accountRequest(`/api/pm-records/${record.id}/assignment`, "POST", { technicianId, expectedRevision: record.revision }); setNotice("PM assigned. The creator keeps read access."); onAssigned(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to assign PM."); }
    finally { setBusy(false); }
  }
  return <section className="assignmentPanel" aria-label="PM assignment"><div><h2>Assigned technician</h2><p>{record.assignedTechnicianName || "No technician assigned"}</p></div><label>Assign to<select value={technicianId} disabled={busy || !users?.users} onChange={event => setTechnicianId(event.target.value)}><option value="">Choose an active technician</option>{users?.users?.filter(u => u.role === "technician" && !u.disabled && u.activatedAt && !u.passwordSetupRequired).map(u => <option value={u.id} key={u.id}>{u.displayName}</option>)}</select></label><button className="ghostButton" type="button" disabled={busy || !technicianId || technicianId === record.assignedTechnicianId} onClick={() => void assign()}>{busy ? "Assigning…" : "Assign PM"}</button>{(error || users?.error) && <p className="accountError" role="alert">{error || users?.error}</p>}{notice && <p role="status">{notice}</p>}</section>;
}
