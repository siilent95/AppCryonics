"use client";
import { offlineJson } from "../offline/data";
import { useEffect, useRef, useState } from "react";
import type { PmRecordSummary, RecordsStatus } from "./types";
export type ReportFilters = { q: string; brand: string; status: string; technician: string; from: string; to: string; view: "active" | "trash"; page: number };
type ReportPage = { records: PmRecordSummary[]; pagination: { page: number; pageSize: number; total: number; pages: number }; brands: { id: string; name: string }[] };
const initial: ReportFilters = { q: "", brand: "", status: "", technician: "", from: "", to: "", view: "active", page: 1 };
async function loadPage(filters: ReportFilters, signal?: AbortSignal, maintenance = false): Promise<ReportPage> {
  const params = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]).filter(([, value]) => !!value));
  if (maintenance) params.set("maintenance", "1");
  return offlineJson<ReportPage>(`/api/pm-records?${params}`,signal);
}
export function useReports(refreshKey: number) {
  const [filters, setFilters] = useState(initial);
  const [data, setData] = useState<ReportPage>({ records: [], brands: [], pagination: { page: 1, pageSize: 25, total: 0, pages: 1 } });
  const [status, setStatus] = useState<RecordsStatus>("loading");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const maintenanceRequested = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setStatus("loading"); setError("");
      const runMaintenance = !maintenanceRequested.current;
      maintenanceRequested.current = true;
      loadPage(filters, controller.signal, runMaintenance).then(result => { if (id === requestId.current) { setData(result); setStatus("loaded"); } }).catch(error => { if (!controller.signal.aborted && id === requestId.current) { setError(error instanceof Error ? error.message : "Unable to load reports."); setStatus("error"); } });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, refresh, refreshKey]);
  function changeFilters(change: Partial<ReportFilters>) { setStatus("loading"); setFilters(current => ({ ...current, page: 1, ...change })); }
  // All matching pages are fetched only when an export is explicitly requested.
  async function exportAll() {
    const first = await loadPage({ ...filters, page: 1 });
    const records = [...first.records];
    for (let page = 2; page <= first.pagination.pages; page++) records.push(...(await loadPage({ ...filters, page })).records);
    return records;
  }
  return { ...data, filters, changeFilters, status, error, refresh: () => setRefresh(value => value + 1), exportAll };
}
