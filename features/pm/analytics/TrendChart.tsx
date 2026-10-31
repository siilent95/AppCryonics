"use client";
import { useSyncExternalStore, type CSSProperties } from "react";
import type { AnalyticsData, Drill } from "./types";
import { shortDate } from "./useAnalytics";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia("(max-width: 650px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
export function TrendChart({ data, days, onDrill }: { data: AnalyticsData; days: number; onDrill: (drill: Drill) => void }) {
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 650px)").matches, () => false);
  const interval = days <= 7 ? 1 : narrow ? Math.ceil(days / 6) : 7;
  const bins = [];
  for (let i = 0; i < days; i += interval) {
    const start = new Date(data.start + "T12:00:00Z"); start.setUTCDate(start.getUTCDate() + i);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + Math.min(interval - 1, days - i - 1));
    const from = start.toISOString().slice(0, 10), to = end.toISOString().slice(0, 10);
    const points = data.daily.filter(day => day.date >= from && day.date <= to);
    bins.push({ from, to, completed: points.reduce((sum, point) => sum + point.completed, 0), open: points.reduce((sum, point) => sum + point.open, 0) });
  }
  const ceiling = Math.ceil(Math.max(4, ...bins.map(bin => bin.completed + bin.open)) / 4) * 4;
  return <section className="analytics-panel trend-panel">
    <header><div><h2>PM activity over time</h2></div><button className="text-button" type="button" onClick={() => onDrill({ kind: "all", title: "PM records in selected period" })}>View data</button></header>
    <div className="trend-summary"><div className="plot-legend"><span><i className="swatch closed" />Completed</span><span><i className="swatch open" />Open</span></div><span>{days <= 7 ? "Daily" : narrow ? "Grouped periods" : "Weekly"} / PM records</span></div>
    <div className="trend-plot"><div className="y-labels" aria-hidden="true">{[ceiling, ceiling * .75, ceiling * .5, ceiling * .25, 0].map(v => <span key={v}>{v}</span>)}</div><div className="plot-grid" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
      <div className="plot-bins" style={{ "--bins": bins.length } as CSSProperties}>{bins.map(bin => {
        const total = bin.completed + bin.open;
        return <button className="trend-bin" key={bin.from} type="button" aria-label={`${shortDate(bin.from)} to ${shortDate(bin.to)}: ${bin.completed} completed, ${bin.open} open PM records`} onClick={() => onDrill({ kind: "period", from: bin.from, to: bin.to, title: `${shortDate(bin.from)} – ${shortDate(bin.to)}` })}>
          <span className="bin-value">{total}</span><span className="bar-stack" style={{ height: `${total / ceiling * 100}%` }}><i className="stack-open" style={{ height: `${total ? bin.open / total * 100 : 0}%` }} /><i className="stack-closed" style={{ height: `${total ? bin.completed / total * 100 : 0}%` }} /></span>
        </button>;
      })}</div>
    </div><div className="x-labels" style={{ "--bins": bins.length } as CSSProperties} aria-hidden="true">{bins.map(bin => <span key={bin.from}>{shortDate(bin.from)}</span>)}</div>
    <p className="chart-footnote">Grouped by recorded PM execution date. Colors show current record status.</p>
  </section>;
}
