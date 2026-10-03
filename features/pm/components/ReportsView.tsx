"use client";
import type { BrandKey, RecordsStatus, PmStatus, PmRecordSummary, ReportDetail } from "@/features/pm/types";
import { formatDate, pmDate, localDateKey, statusLabel } from "@/features/pm/helpers";
import { RecordsMessage } from "@/features/pm/components/RecordsMessage";
import { ReportPreview } from "@/features/pm/components/ReportPreview";
import { useState } from "react";
export function ReportsView({
  detail,
  detailError,
  detailLoading,
  error,
  onExport,
  onOpenReport,
  onRetry,
  records,
  status,
}: {
  detail: ReportDetail | null;
  detailError: string;
  detailLoading: boolean;
  error: string;
  onExport: (records: PmRecordSummary[]) => void;
  onOpenReport: (record: PmRecordSummary) => void;
  onRetry: () => void;
  records: PmRecordSummary[];
  status: RecordsStatus;
}) {
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<"all" | BrandKey>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PmStatus>("all");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const matchesBrand = brandFilter === "all" || record.brand === brandFilter;
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const performed = localDateKey(pmDate(record));
    const searchable = [record.recordNumber, record.freezerSerial, record.modelFamily, record.model, record.labName, record.clientOrganization, record.location].filter(Boolean).join(" ").toLowerCase();
    return matchesBrand && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery)) && (!technicianFilter.trim() || (record.technicianName || "").toLowerCase().includes(technicianFilter.trim().toLowerCase())) && (!dateFrom || (performed !== "" && performed >= dateFrom)) && (!dateTo || (performed !== "" && performed <= dateTo));
  });

  return (
    <div className="managementView reportsView">
      <section className="viewHero">
        <div>
          <div className="eyebrow">PM documentation</div>
          <h1>Reports</h1>
          <p>Search PM records, review stored signatures and print a completed maintenance report.</p>
        </div>
        <button className="primaryAction" disabled={filtered.length === 0} onClick={() => onExport(filtered)} type="button">Export filtered CSV</button>
      </section>

      <div className="reportsGrid">
        <section className="dataPanel reportListPane">
          <div className="filterBar compact">
            <label className="wideFilter"><span>Search reports</span><input onChange={(event) => setQuery(event.target.value)} placeholder="PM number, serial, model or lab" value={query} /></label>
            <label><span>Brand</span><select onChange={(event) => setBrandFilter(event.target.value as "all" | BrandKey)} value={brandFilter}><option value="all">All</option><option value="mve">MVE</option><option value="taylor">Taylor-Wharton</option></select></label>
            <label><span>Status</span><select onChange={(event) => setStatusFilter(event.target.value as "all" | PmStatus)} value={statusFilter}><option value="all">All</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <label><span>Technician</span><input aria-label="Filter reports by technician" onChange={(event) => setTechnicianFilter(event.target.value)} placeholder="Technician name" value={technicianFilter} /></label>
            <label><span>PM from</span><input aria-label="PM date from" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
            <label><span>PM to</span><input aria-label="PM date to" min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
          </div>
          <div className="reportList">
            {filtered.map((record) => (
              <button className={detail?.record.id === record.id ? "selected" : ""} key={record.id} onClick={() => onOpenReport(record)} type="button">
                <span className={`brandToken ${record.brand}`}>{record.brand === "mve" ? "MV" : "TW"}</span>
                <div><strong>{record.recordNumber}</strong><span>{record.freezerSerial || "Serial pending"} · {record.model}</span><small>{record.technicianName || "Technician not recorded"} · PM {formatDate(pmDate(record))}</small></div>
                <span className={`recordStatus ${record.status}`}>{statusLabel(record.status)}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="emptyState"><strong>No reports match the filters</strong><span>Change the search, brand or status selection.</span></div>}
          </div>
        </section>
        <ReportPreview detail={detail} error={detailError} loading={detailLoading} />
      </div>
    </div>
  );
}

