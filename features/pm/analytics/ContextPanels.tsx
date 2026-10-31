"use client";
import { useState } from "react";
import { recordBrandLabel, freezerImage, statusLabel } from "../helpers";
import type { PmStatus } from "../types";
import type { AnalyticsData, Drill } from "./types";
import { shortDate } from "./useAnalytics";
export function ContextPanels({ models = [], data, onDrill }: { models?: import("@/features/equipment/types").CatalogModel[]; data: AnalyticsData; onDrill: (drill: Drill) => void }) {
  const [group, setGroup] = useState<"lab" | "brand">("lab");
  const groups = group === "lab" ? data.labs : data.brands;
  const featured = data.featured;
  const entry = featured && models.find(m => m.brandId === (featured.equipmentBrandId || featured.brand) && m.family === featured.modelFamily && m.model === featured.model);
  const image = entry?.imageUrl ? { src: entry.imageUrl } : featured && (!featured.equipmentBrandId || featured.equipmentBrandId === featured.brand) ? freezerImage(featured.brand, featured.modelFamily, featured.model) : null;
  return <div className="analytics-bottom">
    <section className="analytics-panel"><header><div><h2>Observations by section</h2><p>PM records with a documented note.</p></div></header><div className="horizontal-bars">{data.sections.map(section => <button key={section.key} type="button" onClick={() => onDrill({ kind: "section", value: section.key, title: `${section.label} observations` })}><span className="bar-label">{section.label}<strong>{section.count}<small>{data.total ? Math.round(section.count / data.total * 100) : 0}%</small></strong></span><span className="horizontal-track"><i style={{ width: `${data.total ? section.count / data.total * 100 : 0}%` }} /></span></button>)}</div><p className="chart-footnote">A PM can have notes in several sections. Notes are not necessarily failures.</p></section>
    <section className="analytics-panel distribution-panel"><header><div><h2>Work distribution</h2></div></header><div className="segmented" aria-label="Group distribution"><button type="button" aria-pressed={group === "lab"} onClick={() => setGroup("lab")}>Laboratory</button><button type="button" aria-pressed={group === "brand"} onClick={() => setGroup("brand")}>Brand</button></div><div className="horizontal-bars distribution-bars">{groups.length ? groups.map(item => <button key={item.key} type="button" onClick={() => onDrill({ kind: group, value: item.key, title: item.label })}><span className="bar-label"><span>{item.label}</span><strong>{item.count}</strong></span><span className="horizontal-track"><i style={{ width: `${data.total ? item.count / data.total * 100 : 0}%` }} /></span></button>) : <p className="analytics-empty">No records match these filters.</p>}</div></section>
    <section className="analytics-panel analytics-equipment"><header><div><h2>Equipment context</h2><p>Most recent PM in this selection.</p></div></header>{featured ? <>
      <div className="compact-equipment"><div className="compact-photo">{image ? <img src={image.src} alt={`${recordBrandLabel(featured)} ${featured.model} model reference`} /> : <span>Image pending</span>}</div><div><p>{recordBrandLabel(featured)}</p><h3>{featured.modelFamily}</h3><span>{featured.model}</span><small>{featured.labName || "Lab not recorded"}</small></div></div>
      <dl><div><dt>Freezer serial</dt><dd>{featured.freezerSerial || "Not recorded"}</dd></div><div><dt>PM date</dt><dd>{shortDate(featured.performedOn)}</dd></div><div><dt>Record status</dt><dd><span className={`recordStatus ${featured.status}`}>{statusLabel(featured.status as PmStatus)}</span></dd></div></dl>
      {featured.freezerSerial?.trim() && <button type="button" className="ghostButton full" onClick={() => onDrill({ kind: "equipment", value: `${featured.equipmentBrandId || featured.brand}:${featured.freezerSerial!.trim().toUpperCase()}`, title: `PM history / ${featured.freezerSerial}` })}>View PM history</button>}
    </> : <p className="analytics-empty">No equipment in this selection.</p>}</section>
  </div>;
}
