"use client";
import type { PmRecordSummary, ReportDetail } from "@/features/pm/types";
import { formatDate, pmDate, statusLabel, recordBrandLabel } from "@/features/pm/helpers";
import { PmAssignment } from "@/features/accounts/PmAssignment";
import { ReportPreview } from "@/features/pm/components/ReportPreview";
import { NativeDateInput } from "./NativeDateInput";
import { PdfDownloadButton } from "./PdfDownloadButton";
import { useEffect, useRef, useState } from "react";
import { VersionHistory } from "./VersionHistory";
import { CorrectionDialog } from "./CorrectionDialog";
import { DeleteReportDialog } from "./DeleteReportDialog";
import { trashExpiresAt, TRASH_RETENTION_DAYS } from "../trash-policy";
import { useOffline } from "@/features/offline/useOffline";
import { useReports } from "../useReports";
export function ReportsView({
  catalogModels = [],
  isAdmin = false,
  onAssigned,
  refreshKey,
  onReportsChanged,
  onContinue,
  onNewPm,
  newPmBusy,
  onResume,
  onCorrectionCreated,
  detail,
  detailError,
  detailLoading,
  onExport,
  onOpenReport,onCloseReport,
}: {
  catalogModels?: import("@/features/equipment/types").CatalogModel[];
  isAdmin?: boolean;
  onAssigned: () => void;
  refreshKey: number;
  onReportsChanged: (ids: string[], deleted: boolean) => void;
  onContinue: (detail: ReportDetail) => void;
  onNewPm: () => void; newPmBusy: boolean;
  onResume: (record: PmRecordSummary) => void;
  onCorrectionCreated: (id: string) => Promise<void>;
  detail: ReportDetail | null;
  detailError: string;
  detailLoading: boolean;
  onExport: (records: PmRecordSummary[]) => void;
  onCloseReport: () => void;
  onOpenReport: (record: PmRecordSummary) => void;
}) {
  const connection = useOffline();
  const reports = useReports(refreshKey + connection.acknowledgements);
  const { records, pagination, filters, changeFilters, status, error } = reports;
  const trash = filters.view === "trash";
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const activeFilters = [filters.brand, filters.status, filters.technician, filters.from, filters.to].filter(Boolean).length;
  const [correction, setCorrection] = useState<PmRecordSummary | null>(null);
  const [deleting, setDeleting] = useState<PmRecordSummary | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const listPane = useRef<HTMLElement>(null);
  const selectedRow = useRef<string | null>(null);
  useEffect(() => {
    if (detailLoading || !detail || !window.matchMedia("(max-width:1180px)").matches) return;
    // Also supports opening an existing record from an Overview chart.
    const frame = requestAnimationFrame(() => {
      setDetailOpen(true);
      requestAnimationFrame(() => {
        detailHeading.current?.focus({ preventScroll: true });
        detailHeading.current?.closest("header")?.scrollIntoView({ block: "start" });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [detail, detailLoading]);
  function openDetail(record: PmRecordSummary) { selectedRow.current = record.id; setDetailOpen(true); onOpenReport(record); }
  function backToReports() {
    onCloseReport();
    setDetailOpen(false);
    requestAnimationFrame(() => {
      const row = selectedRow.current ? document.getElementById(`report-row-${selectedRow.current}`) : null;
      const target = row || listPane.current?.querySelector<HTMLInputElement>("input");
      target?.focus();
    });
  }
  const busy = status === "loading";
  async function restore(record: PmRecordSummary) {
    setRestoring(record.id); setActionError(""); setNotice("");
    try {
      const response = await fetch(`/api/pm-records/${record.id}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: record.revision }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to restore this PM.");
      setNotice(`${record.recordNumber} restored with its version history.`); onReportsChanged(result.ids, false); reports.refresh();
    } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to restore this PM."); } finally { setRestoring(null); }
  }

  return (
    <div className="managementView reportsView" data-detail-open={!trash && (detailOpen || detailLoading)}>
      <section className="viewHero">
        <div>
          <div className="eyebrow">PM documentation</div>
          <h1>Reports</h1>

        </div>
        <div className="reportHeroActions"><button className="primaryAction" disabled={newPmBusy} onClick={onNewPm} type="button">New PM</button><button className="ghostButton" disabled={busy || pagination.total === 0 || exporting} onClick={async () => { setExporting(true); setActionError(""); try { onExport(await reports.exportAll()); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to export reports."); } finally { setExporting(false); } }} type="button">{exporting ? "Exporting…" : "Export CSV"}</button></div>
      </section>

      <div className="reportManagementBar"><div className="reportViewTabs" role="group" aria-label="Report collection"><button className="ghostButton" aria-pressed={!trash} type="button" onClick={() => { changeFilters({ view: "active", brand: "" }); setDetailOpen(false); onCloseReport(); setNotice(""); }}>Active reports</button><button className="ghostButton" aria-pressed={trash} disabled={!connection.online} type="button" onClick={() => { changeFilters({ view: "trash", brand: "" }); setDetailOpen(false); onCloseReport(); setNotice(""); }}>Trash</button></div><span>{trash ? `Recover deleted PMs for ${TRASH_RETENTION_DAYS} days. Then they are permanently deleted.` : `Trash keeps deleted PMs for ${TRASH_RETENTION_DAYS} days.`}</span></div>
      {notice && <p className="reportNotice" role="status">{notice}</p>}
      {actionError && <p className="accountError" role="alert">{actionError}</p>}
      <div className="reportsGrid">
        <section ref={listPane} className="dataPanel reportListPane" data-detail-open={!trash && (detailOpen || detailLoading)}>
          <div className="filterBar reportSearchTools">
            <label><span>Search reports</span><input onChange={(event) => changeFilters({ q: event.target.value })} placeholder="PM number, serial, model or lab" value={filters.q} /></label>
            <button className="ghostButton" type="button" aria-expanded={filtersExpanded} aria-controls="report-filter-fields" onClick={() => setFiltersExpanded(value => !value)}>Filters{activeFilters > 0 ? ` (${activeFilters})` : ""}</button>
          </div>
          {filtersExpanded && <div className="filterBar compact" id="report-filter-fields">
            <label><span>Brand</span><select onChange={(event) => changeFilters({ brand: event.target.value })} value={filters.brand}><option value="">All</option>{reports.brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label><span>Status</span><select onChange={(event) => changeFilters({ status: event.target.value })} value={filters.status}><option value="">All</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <label><span>Technician</span><input aria-label="Filter reports by technician" onChange={(event) => changeFilters({ technician: event.target.value })} placeholder="Technician name" value={filters.technician} /></label>
            <label><span>PM from</span><NativeDateInput aria-label="PM date from" onChange={(event) => changeFilters({ from: event.target.value })} value={filters.from} /></label>
            <label><span>PM to</span><NativeDateInput aria-label="PM date to" min={filters.from || undefined} onChange={(event) => changeFilters({ to: event.target.value })} value={filters.to} /></label>
            {activeFilters > 0 && <button className="ghostButton" type="button" onClick={() => changeFilters({ brand: "", status: "", technician: "", from: "", to: "" })}>Clear filters</button>}
          </div>}
          <div className="reportResultsStatus" role="status">{busy ? "Loading reports…" : `${pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total} PMs`}</div>
          {error && <p className="accountError" role="alert">{error} <button className="ghostButton" type="button" onClick={reports.refresh}>Retry</button></p>}
          <div className="reportList" aria-busy={busy}>
            {records.map((record) => (
              <div className={`reportListRow ${detail?.record.id === record.id ? "selected" : ""}`} key={record.id}><button id={`report-row-${record.id}`} className="reportSelect" disabled={trash || busy} onClick={() => openDetail(record)} type="button">
                <span className={`brandToken ${record.brand}`}>{record.equipmentBrandId && record.equipmentBrandId !== record.brand ? recordBrandLabel(record).slice(0,2).toUpperCase() : record.brand === "mve" ? "MV" : "TW"}</span>
                <div><strong>{record.recordNumber}</strong><span>{record.freezerSerial || "Serial pending"} · {record.model}</span><small>{record.assignedTechnicianName ? `Assigned to ${record.assignedTechnicianName}` : "No technician assigned"} · PM {formatDate(pmDate(record))}</small><small>{record.technicianName ? `Signed by ${record.technicianName}` : (record.documentVersion || 1) > 1 ? "Original signatures linked" : "Not signed yet"}</small>{(record.documentVersion || 1) > 1 && <small>Version {record.documentVersion}</small>}{trash && trashExpiresAt(record.deletedAt) && <small className="trashDeadline">Recover until <time dateTime={trashExpiresAt(record.deletedAt)!}>{new Date(trashExpiresAt(record.deletedAt)!).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></small>}</div>
                <span className={`recordStatus ${record.status}`}>{statusLabel(record.status)}</span>
              </button>
                <div className="reportRowActions">
                  {!trash && (record.canEdit
                    ? <button type="button" className="ghostButton reportRowAction" disabled={busy || detailLoading} onClick={() => onResume(record)} aria-label={`Continue ${record.recordNumber}`}>Continue draft</button>
                    : <button type="button" className="ghostButton reportRowAction" disabled={busy || detailLoading} onClick={() => openDetail(record)} aria-label={`View ${record.recordNumber}`}>View report</button>)}
                  {trash && record.canDelete && <button className="ghostButton reportRowAction" disabled={busy || restoring !== null} type="button" onClick={() => void restore(record)} aria-label={`Restore ${record.recordNumber}`}>{restoring === record.id ? "Restoring…" : "Restore PM"}</button>}
                </div>
              </div>
            ))}
            {!busy && !error && records.length === 0 && <div className="emptyState"><strong>{trash ? "No deleted PMs match the filters" : "No reports match the filters"}</strong><span>{trash ? `Deleted PMs stay recoverable for ${TRASH_RETENTION_DAYS} days.` : "Change the search, brand or status selection."}</span></div>}
          </div>
          <nav className="reportPagination" aria-label="Reports pagination"><button className="ghostButton" disabled={busy || pagination.page <= 1} type="button" onClick={() => changeFilters({ page: pagination.page - 1 })}>Previous</button><span>Page {pagination.page} of {pagination.pages}<small>25 per page</small></span><button className="ghostButton" disabled={busy || pagination.page >= pagination.pages} type="button" onClick={() => changeFilters({ page: pagination.page + 1 })}>Next</button></nav>
        </section>
        {trash ? <div className="reportPreview empty"><strong>Trash</strong><span>Restore a PM within {TRASH_RETENTION_DAYS} days to reopen its reports and version history. After the deadline, it is permanently deleted.</span></div> : <div className="reportWorkspace" data-open={detailOpen || detailLoading}>
          <header className="reportDetailHeader">
            <button type="button" className="ghostButton reportBack" onClick={backToReports}>← Back to reports</button>
            <div className="reportDetailIdentity"><h2 ref={detailHeading} tabIndex={-1} className="reportDetailHeading">{detail?.record.recordNumber || "Report details"}</h2>{detail && <span className={`recordStatus ${detail.record.status}`}>{statusLabel(detail.record.status)}</span>}</div>
          </header>
          {detail && !detailLoading && <>
            <div className="reportEditActions" aria-label="Report actions">
              {detail.record.canEdit && <button className="primaryAction continuePm" type="button" onClick={() => onContinue(detail)}>Continue draft</button>}
              {!connection.online && detail.record.status === "completed" && <p>Connect to download the official PDF. This prepared preview remains available offline.</p>}
              {connection.online && detail.record.status === "completed" && !detail.localState && <PdfDownloadButton key={detail.record.id} id={detail.record.id} completed requiresSignatures={!detail.record.correctsRecordId} />}
              {connection.online && detail.record.canCorrect && <button className="ghostButton" type="button" onClick={() => setCorrection(detail.record)}>Create correction</button>}
              {!detail.record.canEdit && !detail.record.canCorrect && <p>This version is read-only. Drafts can be edited by their assigned technician or an admin.</p>}
            </div>
            {connection.online && ((isAdmin && detail.versions?.at(-1)?.id === detail.record.id) || detail.record.canDelete) && <details className="reportOptions" key={detail.record.id}>
              <summary>Report options</summary>
              {isAdmin && detail.versions?.at(-1)?.id === detail.record.id && <PmAssignment key={`${detail.record.id}-${detail.record.revision}`} record={detail.record} onAssigned={onAssigned} />}
              {detail.record.canDelete && <div className="reportDeleteAction"><p>Move this PM to Trash. It can be restored within {TRASH_RETENTION_DAYS} days.</p><button className="ghostButton dangerText" type="button" onClick={() => setDeleting(detail.record)}>Delete PM</button></div>}
            </details>}
            <VersionHistory detail={detail} onOpen={id => onOpenReport({ ...detail.record, id })} />
          </>}<ReportPreview catalogModels={catalogModels} detail={detail} error={detailError} loading={detailLoading} /></div>}

      </div>
      {connection.online && deleting && <DeleteReportDialog record={deleting} onClose={() => setDeleting(null)} onDeleted={ids => { setDetailOpen(false); selectedRow.current = null; setNotice(`${deleting.recordNumber} moved to Trash. Recover it within ${TRASH_RETENTION_DAYS} days.`); onReportsChanged(ids, true); reports.refresh(); }} />}
      {connection.online && correction && <CorrectionDialog record={correction} onClose={() => setCorrection(null)} onCreated={onCorrectionCreated} />}
    </div>
  );
}
