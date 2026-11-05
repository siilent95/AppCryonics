"use client";
import { statusLabel, formatDate } from "../helpers";
import type { PmStatus, ReportDetail } from "../types";
export function VersionHistory({ detail, onOpen }: { detail: ReportDetail; onOpen: (id: string) => void }) {
  const versions = detail.versions || [];
  const index = versions.findIndex(version => version.id === detail.record.id);
  if (!versions.length) return null;
  return <section className="reportVersions" aria-label="Version history">
    <div className="versionHistoryHeading"><h2>Version history</h2><span>{versions.length} {versions.length === 1 ? "version" : "versions"}</span></div>
    {versions.length > 1 ? <div className="versionHistoryControls"><button className="ghostButton" type="button" disabled={index <= 0} onClick={() => onOpen(versions[index - 1].id)} aria-label="Previous version">←</button>
      <label>Document version<select value={detail.record.id} onChange={event => onOpen(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>Version {version.documentVersion} · {statusLabel(version.status as PmStatus)}</option>)}</select></label>
      <button className="ghostButton" type="button" disabled={index < 0 || index >= versions.length - 1} onClick={() => onOpen(versions[index + 1].id)} aria-label="Next version">→</button></div> : <p className="singleVersion">Version {detail.record.documentVersion || 1} · {statusLabel(detail.record.status)} · {formatDate(detail.record.createdAt)}</p>}
    {detail.record.correctionReason && <details className="versionReason"><summary>Reason for correction</summary><p>{detail.record.correctionReason}</p></details>}
  </section>;
}
