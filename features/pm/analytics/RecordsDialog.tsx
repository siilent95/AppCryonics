"use client";
import { useDialogDismiss } from "@/features/shared/useDialogDismiss";
import { useEffect, useRef, useState } from "react";
import type { AnalyticsDetails, AnalyticsFilters, AnalyticsRecord, Drill } from "./types";
import { filterQuery, shortDate, useAnalyticsResource } from "./useAnalytics";
import { recordBrandLabel } from "../helpers";
export function RecordsDialog({ drill, filters, onClose, onOpenRecord }: { drill: Drill; filters: AnalyticsFilters; onClose: () => void; onOpenRecord: (record: AnalyticsRecord) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const query = new URLSearchParams(filterQuery(filters));
  query.set("kind", drill.kind); query.set("page", String(page)); query.set("refresh", String(attempt));
  if (drill.value) query.set("value", drill.value);
  if (drill.from) query.set("from", drill.from);
  if (drill.to) query.set("to", drill.to);
  const response = useAnalyticsResource<AnalyticsDetails>(`/api/pm-analytics/records?${query}`);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const data = response?.data;
  const dismiss = useDialogDismiss();
  return <dialog {...dismiss} id="analytics-detail" ref={dialog} aria-labelledby="analytics-detail-title" onClose={onClose}>
    <div className="detail-header"><div><h2 id="analytics-detail-title">{drill.title}</h2><p>{data ? `${data.total} matching records · Page ${page} of ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : "Loading records…"}</p></div><button className="ghostButton" type="button" autoFocus onClick={() => dialog.current?.close()}>Close</button></div>
    <div aria-live="polite">{!response ? <p className="analytics-empty" role="status">Loading PM records…</p> : response.error ? <div role="alert"><p>{response.error}</p><button className="ghostButton" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div> : data && data.records.length ? <div className="detail-table"><table><thead><tr><th>PM record</th><th>Equipment</th><th>Laboratory</th><th>PM date</th><th>Status</th></tr></thead><tbody>{data.records.map(record => <tr key={record.id}><td><button className="text-button" type="button" onClick={() => { onClose(); onOpenRecord(record); }}>{record.recordNumber} ↗</button></td><td>{recordBrandLabel(record)} {record.model}<small>{record.modelFamily}</small><small>{record.freezerSerial || "Serial not recorded"}</small></td><td>{record.labName || "Not recorded"}</td><td>{shortDate(record.performedOn)}</td><td>{record.status === "completed" ? "Completed" : record.currentStep === "review" || record.status === "ready_for_signature" ? "Review" : "Draft"}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No PM records in this selection.</p>}</div>
    <div className="detail-pagination"><button className="ghostButton" type="button" disabled={!data || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="ghostButton" type="button" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next page</button></div>
  </dialog>;
}
