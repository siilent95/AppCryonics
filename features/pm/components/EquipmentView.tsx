"use client";
import type { BrandKey, WorkspaceView, RecordsStatus, EquipmentRegistryItem } from "@/features/pm/types";

import { formatDate, freezerImage, brandLabel, statusLabel } from "@/features/pm/helpers";
import { RecordsMessage } from "@/features/pm/components/RecordsMessage";
import { useState } from "react";
export function EquipmentView({
  equipmentRecords,
  error,
  onNavigate,
  onRetry,
  status,
}: {
  equipmentRecords: EquipmentRegistryItem[];
  error: string;
  onNavigate: (view: WorkspaceView) => void;
  onRetry: () => void;
  status: RecordsStatus;
}) {
  const [query, setQuery] = useState("");
  const [serialFilter, setSerialFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState<"all" | BrandKey>("all");
  const [selectedKey, setSelectedKey] = useState("");
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = equipmentRecords.filter((record) => {
    const matchesBrand = brandFilter === "all" || record.brand === brandFilter;
    const searchable = [
      record.freezerSerial,
      record.modelFamily,
      record.model,
      record.labName,
      record.location,
      record.controllerType,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesBrand && (!normalizedQuery || searchable.includes(normalizedQuery)) && (!serialFilter.trim() || (record.freezerSerial || "").toLowerCase().includes(serialFilter.trim().toLowerCase()));
  });
  const selectedRecord = filtered.find((record) => `${record.brand}:${record.freezerSerial || record.id}` === selectedKey) ?? filtered[0];
  const selectedImage = selectedRecord ? freezerImage(selectedRecord.brand, selectedRecord.modelFamily, selectedRecord.model) : null;

  return (
    <div className="managementView">
      <section className="viewHero">
        <div>
          <div className="eyebrow">Equipment registry</div>
          <h1>Equipment</h1>
          <p>Freezers are created from saved PM identification records. Models remain controlled by the approved MVE and Taylor-Wharton lists.</p>
        </div>
        <div className="viewCount"><strong>{equipmentRecords.length}</strong><span>Tracked units</span></div>
      </section>

      <div className="kairosEquipmentLayout"><section className="dataPanel">
        <div className="filterBar">
          <label><span>Search equipment</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Serial, model, lab or location" value={query} /></label>
          <label><span>Serial number</span><input aria-label="Filter equipment by serial number" onChange={(event) => setSerialFilter(event.target.value)} placeholder="Enter freezer serial" value={serialFilter} /></label>
          <label><span>Brand</span><select onChange={(event) => setBrandFilter(event.target.value as "all" | BrandKey)} value={brandFilter}><option value="all">All brands</option><option value="mve">MVE</option><option value="taylor">Taylor-Wharton</option></select></label>
        </div>
        <div className="tableWrap">
          <table className="recordsTable">
            <thead><tr><th>Equipment</th><th>Model</th><th>Lab and location</th><th>Controller</th><th>PM history</th><th>Latest status</th></tr></thead>
            <tbody>
              {filtered.map((record) => (
                <tr className={record.id === selectedRecord?.id ? "selectedEquipmentRow" : ""} key={`${record.brand}:${record.freezerSerial || record.id}`}>
                  <td><div className="tableIdentity"><span className={`brandToken ${record.brand}`}>{record.brand === "mve" ? "MV" : "TW"}</span><div><button aria-label={`View equipment ${record.freezerSerial || record.id}`} className="equipmentSelect" onClick={() => setSelectedKey(`${record.brand}:${record.freezerSerial || record.id}`)} type="button">{record.freezerSerial || "Serial not recorded"}</button><small>{brandLabel(record.brand)}</small></div></div></td>
                  <td><strong>{record.modelFamily}</strong><small>{record.model}</small></td>
                  <td><strong>{record.labName || "Lab pending"}</strong><small>{record.location || record.facility || "Location pending"}</small></td>
                  <td><strong>{record.controllerType || "Not recorded"}</strong><small>{record.controllerSerial || "Serial pending"}</small></td>
                  <td><strong>{record.historyCount} PM record{record.historyCount === 1 ? "" : "s"}</strong><small>{record.completedCount} completed</small></td>
                  <td><span className={`recordStatus ${record.status}`}>{statusLabel(record.status)}</span><small>Updated {formatDate(record.updatedAt)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="emptyState"><strong>No equipment matches the filters</strong><span>Change the search or brand selection.</span></div>}
        </div>
      </section>
      <aside className="kairosEquipmentDetail" aria-live="polite">
        {selectedRecord && selectedImage ? <>
          <div className="kairosEquipmentImage" role="img" aria-label={`${brandLabel(selectedRecord.brand)} ${selectedRecord.model} freezer reference`} style={{ backgroundImage: `url("${selectedImage.src}")` }} />
          <div className="kairosEquipmentInfo"><div className="eyebrow">Selected equipment</div><h2>{selectedRecord.modelFamily}</h2><p>{selectedRecord.model} · {selectedRecord.freezerSerial || "Serial not recorded"}</p>
            <dl><div><dt>Lab</dt><dd>{selectedRecord.labName || "Not recorded"}</dd></div><div><dt>Location</dt><dd>{selectedRecord.location || selectedRecord.facility || "Not recorded"}</dd></div><div><dt>Controller</dt><dd>{selectedRecord.controllerType || "Not recorded"}</dd></div><div><dt>PM history</dt><dd>{selectedRecord.historyCount} records</dd></div></dl>
            <button onClick={() => onNavigate("reports")} type="button">Open Reports</button>
          </div>
        </> : <div className="kairosEquipmentMissing">No equipment matches the filters.</div>}
      </aside></div>
    </div>
  );
}

