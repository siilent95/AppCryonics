"use client";
import type { WorkspaceView, RecordsStatus, PmRecordSummary } from "@/features/pm/types";

import { formatDate, pmDate, freezerImage, brandLabel, statusLabel } from "@/features/pm/helpers";
import { RecordsMessage } from "@/features/pm/components/RecordsMessage";
export function OverviewView({
  error,
  onNavigate,
  onRetry,
  records,
  status,
}: {
  error: string;
  onNavigate: (view: WorkspaceView) => void;
  onRetry: () => void;
  records: PmRecordSummary[];
  status: RecordsStatus;
}) {
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const completed = records.filter((record) => record.status === "completed");
  const open = records.filter((record) => record.status !== "completed" && record.status !== "archived");
  const equipmentKeys = new Set(
    records.map((record) => `${record.brand}:${record.freezerSerial?.trim().toUpperCase() || record.id}`),
  );
  const completionRate = records.length === 0 ? 0 : Math.round((completed.length / records.length) * 100);
  const mveCount = records.filter((record) => record.brand === "mve").length;
  const taylorCount = records.filter((record) => record.brand === "taylor").length;
  const readyForExport = completed.filter((record) =>
    record.technicianSignatureCapturedAt && !record.technicianSignatureDeletedAt &&
    record.recipientSignatureCapturedAt && !record.recipientSignatureDeletedAt,
  );
  const signaturePending = records.filter((record) => record.status === "ready_for_signature");
  const featured = completed[0] ?? records[0];
  const featuredImage = featured
    ? freezerImage(featured.brand, featured.modelFamily, featured.model)
    : { src: "/freezers/mve-heco-800.webp", exact: false };
  const recent = records.filter((record) => record.status !== "archived").slice(0, 3);

  return (
    <div className="kairosOverview" aria-label="Maintenance overview">
      <div className="kairosOverviewGrid">
        <div className="kairosOverviewRail">
          <section className="kairosPanel kairosActivityPanel">
            <h1>Alerts &amp; service facts</h1>
            <div className="kairosActivityList">
              {recent.length === 0 ? <p className="kairosEmpty">No PM activity yet. Start a PM to populate this dashboard.</p> : recent.map((record) => (
                <button className="kairosActivity" key={record.id} onClick={() => onNavigate("reports")} type="button">
                  <span className="kairosDot" aria-hidden="true" />
                  <span><strong>{statusLabel(record.status)} · {record.recordNumber}</strong><small>{brandLabel(record.brand)} {record.model} · {record.labName || "Lab pending"}</small></span>
                </button>
              ))}
            </div>
            <div className="kairosFacts"><div><strong>{equipmentKeys.size}</strong><span>Equipment</span></div><div><strong>{records.length}</strong><span>PMs</span></div><div><strong>{open.length}</strong><span>Open</span></div></div>
          </section>
          <section className="kairosPanel kairosProgressPanel">
            <h2>PM completion</h2><p>Completed records</p>
            <div className="kairosProgressBody"><div className="kairosRing" style={{ background: `conic-gradient(var(--cyan) 0 ${completionRate}%, rgba(255,255,255,.15) ${completionRate}% 100%)` }}><span>{completionRate}%</span></div><div><strong>{completed.length} completed</strong><small>of {records.length} PM records</small></div></div>
            <button className="kairosCta" onClick={() => onNavigate("reports")} type="button">View reports</button>
          </section>
        </div>

        <section className="kairosProductStage" aria-label="Featured freezer">
          <div className="kairosProductTop"><span>Featured equipment / {featured?.modelFamily || "MVE and Taylor-Wharton"}</span>{featured && <b>{featured.model}</b>}</div>
          <div className="kairosProductHalo" aria-hidden="true" />
          <div className="kairosProductImage" role="img" aria-label={featured ? `${brandLabel(featured.brand)} ${featured.model} freezer reference` : "MVE freezer reference"} style={{ backgroundImage: `url("${featuredImage.src}")` }} />
          {featured && <div className="kairosProductDate"><span>LAST PM</span><strong>{formatDate(pmDate(featured))}</strong><small>{statusLabel(featured.status)}</small></div>}
          <div className="kairosProductFooter"><div><strong>{featured ? `${brandLabel(featured.brand)} ${featured.modelFamily}` : "MVE and Taylor-Wharton"}</strong><span>{featured ? `${featured.labName || "Lab pending"} · ${featured.freezerSerial || "Serial pending"} · ${statusLabel(featured.status)}` : "Start the first PM to see equipment details"}</span></div><button onClick={() => onNavigate(featured ? "equipment" : "orders")} type="button">{featured ? "View equipment" : "Start a PM"}</button></div>
        </section>

        <div className="kairosOverviewRail">
          <section className="kairosPanel kairosMetricPanel"><h2>PM activity</h2><strong className="kairosBigNumber">{completed.length}</strong><p>completed records</p><div className="kairosMeter" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i className={index < Math.round(completionRate * 14 / 100) ? "" : "dim"} key={index} />)}</div></section>
          <section className="kairosPanel kairosBrandPanel"><h2>PM records by brand</h2><div className="kairosBrandRow"><span>MVE</span><strong>{mveCount}</strong><i><b style={{ width: `${records.length ? (mveCount / records.length) * 100 : 0}%` }} /></i></div><div className="kairosBrandRow"><span>Taylor-Wharton</span><strong>{taylorCount}</strong><i><b style={{ width: `${records.length ? (taylorCount / records.length) * 100 : 0}%` }} /></i></div></section>
          <section className="kairosPanel kairosClosurePanel"><h2>Report closure</h2><div><span>Signed reports ready</span><strong>{readyForExport.length}</strong></div><div><span>Pending signature</span><strong>{signaturePending.length}</strong></div><div><span>Open work</span><strong>{open.length}</strong></div><button onClick={() => onNavigate("reports")} type="button">Open report queue</button></section>
        </div>
      </div>
    </div>
  );
}
