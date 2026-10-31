"use client";
import type { CatalogModel } from "@/features/equipment/types";
import type { AnalyticsData, Drill } from "./types";

export function TopEquipment({ data, models, onDrill }: { data: AnalyticsData; models: CatalogModel[]; onDrill: (drill: Drill) => void }) {
  return <section className="analytics-panel top-equipment" aria-labelledby="top-equipment-title">
    <header><div><h2 id="top-equipment-title">Most used equipment</h2><p>Top 3 models by PM records in the selected period.</p></div></header>
    {data.topModels.length ? <div className="top-equipment-grid">{data.topModels.map((item, index) => {
      const entry = models.find(model => model.brandId === item.brandId && model.family === item.family && model.model === item.model);
      const share = data.total ? Math.round(item.count / data.total * 100) : 0;
      return <button className="top-equipment-card" type="button" key={item.key} onClick={() => onDrill({ kind: "model", value: item.key, title: `${item.brandName} / ${item.family} / ${item.model}` })}>
        <span className="top-equipment-rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
        <span className="top-equipment-photo">{entry?.imageUrl ? <img src={entry.imageUrl} alt="" width={96} height={112} loading="lazy" decoding="async" /> : <span>Image pending</span>}</span>
        <span className="top-equipment-identity"><small>{item.brandName}</small><strong>{item.model}</strong><span>{item.family}</span></span>
        <span className="top-equipment-count"><strong>{item.count} <small>{item.count === 1 ? "PM" : "PMs"}</small></strong><span>{share}% of PM records</span></span>
        <span className="top-equipment-track" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>
        <span className="top-equipment-link">View PM records <span aria-hidden="true">↗</span></span>
      </button>;
    })}</div> : <p className="analytics-empty">No equipment models in this selection.</p>}
    <p className="chart-footnote">Counts completed and open PMs by brand, family and model.</p>
  </section>;
}
