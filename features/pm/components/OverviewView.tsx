"use client";
import type { CatalogBrand } from "@/features/equipment/types";
import { useState } from "react";
import type { AnalyticsData, AnalyticsFilters, AnalyticsRecord, Drill } from "../analytics/types";
import { filterQuery, localToday, shortDate, useAnalyticsResource } from "../analytics/useAnalytics";
import { TrendChart } from "../analytics/TrendChart";
import { StatusChart } from "../analytics/StatusChart";
import { ContextPanels } from "../analytics/ContextPanels";
import { TopEquipment } from "../analytics/TopEquipment";
import { RecordsDialog } from "../analytics/RecordsDialog";
export function OverviewView({ models = [], brands = [], scopeLabel = "Your account", refresh, onWorkspace, onOpenRecord }: { models?: import("@/features/equipment/types").CatalogModel[]; brands?: CatalogBrand[]; scopeLabel?: string; refresh: number; onWorkspace: () => void; onOpenRecord: (record: AnalyticsRecord) => void }) {
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({ days: 90, brand: "all", end: localToday() }));
  const [retry, setRetry] = useState(0);
  const [drill, setDrill] = useState<Drill | null>(null);
  const response = useAnalyticsResource<AnalyticsData>(`/api/pm-analytics?${filterQuery(filters)}&refresh=${refresh}-${retry}`);
  const data = response?.data;
  const rate = data?.total ? Math.round(data.completed / data.total * 100) : 0;
  const delta = data ? data.total - data.previousTotal : 0;
  return <div className="analyticsOverview">
    <div className="overviewHeading"><div><h1>Maintenance overview</h1></div><button className="primaryAction" type="button" onClick={onWorkspace}>PM workspace</button></div>
    <section className="analytics-toolbar" aria-label="Dashboard filters"><div>
      <label>Period<select value={filters.days} onChange={event => setFilters({ ...filters, days: Number(event.target.value) as AnalyticsFilters["days"] })}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label>Brand<select value={filters.brand} onChange={event => setFilters({ ...filters, brand: event.target.value as AnalyticsFilters["brand"] })}><option value="all">All brands</option>{brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>Ending on<input type="date" value={filters.end} onChange={event => { if (event.target.value && /^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setFilters({ ...filters, end: event.target.value }); }} /></label>
    </div><p>{data ? `${shortDate(data.start)} – ${shortDate(data.end)}, ${data.end.slice(0, 4)}` : "Selected period"}<span>{scopeLabel} · Saved PM records</span></p></section>
    {!response ? <div className="analytics-loading" role="status">Loading maintenance statistics…</div> : response.error ? <div className="analytics-loading" role="alert"><p>{response.error}</p><button className="ghostButton" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : data && <>
      <section className="analytics-metrics" aria-label="Period summary"><div><span>PM records</span><strong>{data.total}</strong><small>{delta > 0 ? "+" : ""}{delta} vs previous {filters.days} days</small></div><div><span>Completed records</span><strong>{data.completed}<em>{rate}%</em></strong><small>Documented closure</small></div><div><span>Open records</span><strong>{data.review + data.draft}</strong><small>{data.review} at Review · {data.draft} other drafts</small></div><div><span>Equipment with PMs</span><strong>{data.equipment}</strong><small>Within selected period</small></div></section>
      {data.total === 0 && <p className="overviewEmpty" role="status">No PM records match this period and brand. Change the filters or open the PM workspace to record maintenance.</p>}
      <div className="analytics-top"><TrendChart data={data} days={filters.days} onDrill={setDrill} /><StatusChart data={data} onDrill={setDrill} /></div>
      <TopEquipment data={data} models={models} onDrill={setDrill} />
      <ContextPanels models={models} data={data} onDrill={setDrill} />
      <div className="analytics-method"><span>All panels share the selected period and brand. Archived records are excluded. Equipment counts use brand and freezer serial.</span><span>{data.undated > 0 && `${data.undated} records without a valid PM date excluded. `}{data.missingSerial > 0 && `${data.missingSerial} PMs without a freezer serial excluded from equipment count.`}</span></div>
    </>}
    {drill && <RecordsDialog drill={drill} filters={filters} onClose={() => setDrill(null)} onOpenRecord={onOpenRecord} />}
  </div>;
}
