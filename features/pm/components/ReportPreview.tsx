"use client";
import type { InspectionStep, ReportDetail, ChecklistItem, NotesState, ExamValues } from "@/features/pm/types";
import { constructionItems, operationItems, verificationItems, equipment } from "@/features/pm/catalogs";
import { formatDate, pmDate, freezerImage, brandLabel } from "@/features/pm/helpers";
export function ReportPreview({
  detail,
  error,
  loading,
}: {
  detail: ReportDetail | null;
  error: string;
  loading: boolean;
}) {
  if (loading) return <div className="reportPreview empty"><strong>Loading report</strong><span>Retrieving PM details and signature status.</span></div>;
  if (error) return <div className="reportPreview empty error"><strong>Report could not be opened</strong><span>{error}</span></div>;
  if (!detail) return <div className="reportPreview empty"><strong>Select a PM report</strong><span>Choose a record to review its maintenance summary, signatures and audit history.</span></div>;

  const { record } = detail;
  const notes = record.payload.notes ?? {};
  const technicianSignatureAvailable = Boolean(record.technicianSignatureCapturedAt && !record.technicianSignatureDeletedAt);
  const recipientSignatureAvailable = Boolean(record.recipientSignatureCapturedAt && !record.recipientSignatureDeletedAt);
  const image = freezerImage(record.brand, record.modelFamily, record.model);
  const savedResponses = record.payload.responses ?? {};
  const measurements = record.payload.measurements ?? {};
  const exam = record.payload.examination ?? {};
  const flags = record.payload.flags ?? {};
  const answer = (section: InspectionStep, id: string) => {
    const result = savedResponses[`${record.brand}:${section}:${id}`];
    return result === "yes" ? "Yes" : result === "no" ? "No" : result === "na" ? "N/A" : result === "any" ? "Any" : "Not recorded";
  };
  const measure = (key: string, unit: string) => {
    const value = measurements[key];
    return value === null || value === undefined || value === "" ? "Not recorded" : `${value} ${unit}`;
  };
  const examValue = (key: keyof ExamValues, unit: string) => {
    if ((key === "gasBypassTemperature" && flags.gasBypassTemperatureNA) || (key === "gasBypassDelay" && flags.gasBypassDelayNA)) return "N/A";
    const value = exam[key];
    return value === undefined || value === "" ? "Not recorded" : `${value}${unit ? ` ${unit}` : ""}`;
  };
  const levelDifference = measurements.manualLevel && measurements.controllerLevel
    ? Math.abs(Number(measurements.manualLevel) - Number(measurements.controllerLevel)).toFixed(2)
    : null;
  const note = (section: keyof NotesState) => notes[section]?.trim() || "No observations recorded.";

  function checklistTable(section: InspectionStep, items: readonly ChecklistItem[]) {
    return <table className="pmReportTable"><thead><tr><th>Maintenance criterion</th><th>Result</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.label}</td><td>{answer(section, item.id)}</td></tr>)}</tbody></table>;
  }

  function measurementTable(rows: Array<{ label: string; value: string; reference?: string }>) {
    return <table className="pmReportTable"><thead><tr><th>Measured or configured value</th><th>Result</th><th>PM reference</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.value}</td><td>{row.reference || "-"}</td></tr>)}</tbody></table>;
  }

  function reportSectionHeading(number: string, title: string) {
    return <header className="pmReportSectionHeading"><img alt="Cryogenics Solution Inc." src="/brand/logo-primary.png" /><div><span>Preventive maintenance program</span><h2>{number} / {title}</h2><small>{record.recordNumber} · {brandLabel(record.brand)} · {record.freezerSerial || "Serial not recorded"}</small></div></header>;
  }

  function reportNote(section: keyof NotesState) {
    return <div className="pmReportNote"><strong>{section === "general" ? "General service notes" : `${section[0].toUpperCase()}${section.slice(1)} observations`}</strong><p>{note(section)}</p></div>;
  }

  return (
    <article className="reportPreview">
      <div className="reportToolbar">
        <div><span>Preventive maintenance report</span><h2>{record.recordNumber}</h2></div>
        <button disabled={record.status !== "completed"} onClick={() => window.print()} type="button">Print or save full PM PDF</button>
      </div>
      <section className="reportCover" aria-label="PM report summary">
        <img className="reportLogo" alt="Cryogenics Solution Inc." src="/brand/logo-primary.png" />
        <div className="reportCoverHeading"><span>Preventive maintenance</span><strong>{record.recordNumber}</strong><small>PM date {formatDate(pmDate(record))}</small></div>
        <figure className="reportFreezerImage"><img alt={`${brandLabel(record.brand)} ${record.model} freezer reference`} src={image.src} /><figcaption>{image.exact ? `Freezer model ${record.model}` : `Reference image for ${record.modelFamily}; verify the equipment label for ${record.model}`}</figcaption></figure>
      <dl className="reportCoverFacts">
          <div><dt>Technician</dt><dd>{record.technicianName || "Not recorded"}</dd></div>
          <div><dt>Freezer model</dt><dd>{brandLabel(record.brand)} {record.model}</dd></div>
          <div><dt>Serial number</dt><dd>{record.freezerSerial || "Not recorded"}</dd></div>
          <div><dt>Client</dt><dd>{record.clientOrganization || (record.labName ? `Lab: ${record.labName}` : "Not recorded")}</dd></div>
          <div><dt>Lab name</dt><dd>{record.labName || "Not recorded"}</dd></div>
          <div><dt>Location</dt><dd>{record.location || "Not recorded"}</dd></div>
          <div><dt>Controller serial</dt><dd>{record.controllerSerial || "Not recorded"}</dd></div>
          <div><dt>Controller type</dt><dd>{record.controllerType || "Not recorded"}</dd></div>
          {record.brand === "mve" && <div><dt>Firmware version</dt><dd>{record.firmwareVersion || "Not recorded"}</dd></div>}
        </dl>
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("01", "Construction")}
        <p className="pmReportIntro">Visual and mechanical inspection of the freezer construction.</p>
        {checklistTable("construction", constructionItems)}
        {reportNote("construction")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("02", "Operation")}
        <p className="pmReportIntro">Electrical, valve and battery backup inspection.</p>
        {checklistTable("operation", operationItems[record.brand])}
        {record.brand === "mve" && <>
          <h3 className="pmReportSubheading">Solenoid resistance</h3>
          {measurementTable([
            { label: "Solenoid valve resistance confirmed", value: answer("operation", "resistance-confirmed") },
            { label: "Single valve resistance", value: measure("singleValveResistance", "Ω"), reference: "62 < R < 74 Ω" },
            { label: "Dual valve resistance", value: measure("dualValveResistance", "Ω"), reference: "28 < R < 38 Ω" },
            { label: "Purge / 3-way valve resistance", value: measure("purgeValveResistance", "Ω"), reference: "135 < R < 145 Ω" },
          ])}
        </>}
        <h3 className="pmReportSubheading">Battery measurement</h3>
        {measurementTable([{ label: "Battery output voltage", value: measure("batteryVoltage", "VDC"), reference: `${equipment[record.brand].batteryNominal} to ${(equipment[record.brand].batteryNominal * 1.1).toFixed(1)} VDC` }])}
        {reportNote("operation")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("03", "Verification")}
        <p className="pmReportIntro">Temperature probes, liquid level and functional controls.</p>
        {measurementTable([
          { label: record.brand === "mve" ? "Temperature resistance confirmed" : "Thermocouple resistance confirmed", value: answer("verification", "temperature-resistance") },
          { label: "Room temperature resistance", value: measure("roomResistance", "Ω"), reference: `${equipment[record.brand].room.min} < R < ${equipment[record.brand].room.max} Ω` },
          { label: "Cryogenic temperature resistance", value: measure("cryoResistance", "Ω"), reference: `${equipment[record.brand].cryo.min} < R < ${equipment[record.brand].cryo.max} Ω` },
          { label: "Manually measured liquid level", value: measure("manualLevel", "in") },
          { label: "Controller displayed liquid level", value: measure("controllerLevel", "in") },
          { label: "Displayed vs. actual level difference", value: levelDifference === null ? "Not recorded" : `${levelDifference} in`, reference: "≤ 0.5 in" },
        ])}
        <h3 className="pmReportSubheading">Functional verification</h3>
        {checklistTable("verification", verificationItems[record.brand])}
        {reportNote("verification")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("04", "Examination")}
        <p className="pmReportIntro">Controller readings and configured alarm, level and time values.</p>
        {measurementTable([
          { label: "Temperature unit", value: exam.temperatureUnit || "Not recorded" },
          { label: "Level unit", value: exam.levelUnit || "Not recorded" },
          { label: "High Temperature A-B", value: examValue("highTemperature", exam.temperatureUnit || "") },
          { label: "Low Temperature A-B", value: examValue("lowTemperature", exam.temperatureUnit || "") },
          { label: "High Level Alarm", value: examValue("highLevelAlarm", exam.levelUnit || "") },
          { label: "High Level Set Point", value: examValue("highLevelSetPoint", exam.levelUnit || "") },
          { label: "Low Level Set Point", value: examValue("lowLevelSetPoint", exam.levelUnit || "") },
          { label: "Low Level Alarm", value: examValue("lowLevelAlarm", exam.levelUnit || "") },
          { label: "Gas Bypass Temperature Set Point", value: examValue("gasBypassTemperature", exam.temperatureUnit || "") },
          { label: "Gas Bypass Time Delay", value: examValue("gasBypassDelay", "min") },
          { label: "Maximum Fill Time", value: examValue("maximumFillTime", "min") },
          { label: "Event Log Interval", value: examValue("eventLogInterval", "min") },
        ])}
        {reportNote("examination")}
      </section>
      <section className="pmReportPage pmReportClosing">
        {reportSectionHeading("05", "Service closure")}
        {reportNote("general")}
        <div className="pmReportAttestation"><strong>Maintenance record</strong><p>The technician signature documents responsibility for the work recorded in this PM. The recipient signature documents receipt of the PM.</p><p>PM date: {formatDate(pmDate(record))} · Record: {record.recordNumber} · Revision: {record.revision}</p></div>
        {record.status !== "completed" ? (
          <p>This PM is still a draft. Signatures have not been recorded.</p>
        ) : (
          <div className="reportSignatureGrid">
            <figure>
              <figcaption><strong>Responsible technician: {record.technicianName || "Not recorded"}</strong><span>Signed {formatDate(record.technicianSignatureCapturedAt, true)}</span></figcaption>
              {technicianSignatureAvailable ? <img alt="Responsible PM technician signature" src={`/api/pm-records/${record.id}/signature?role=technician`} /> : <div>Signature no longer available</div>}
            </figure>
            <figure>
              <figcaption><strong>PM recipient</strong><span>Signed {formatDate(record.recipientSignatureCapturedAt, true)}</span></figcaption>
              {recipientSignatureAvailable ? <img alt="PM recipient signature" src={`/api/pm-records/${record.id}/signature?role=recipient`} /> : <div>Signature no longer available</div>}
            </figure>
          </div>
        )}
        {record.status === "completed" && (
          <p className="retentionLine">Signature retention date: {formatDate(record.technicianSignatureRetentionUntil || record.recipientSignatureRetentionUntil)}</p>
        )}
      </section>
      <section className="reportSection reportAuditSection">
        <div className="reportSectionTitle"><span>Audit history</span><strong>Record activity</strong></div>
        <div className="auditList">
          {detail.events.map((event) => <div key={`${event.eventType}-${event.revision}-${event.createdAt}`}><span>{event.eventType.replaceAll("_", " ")}</span><strong>Revision {event.revision}</strong><small>{formatDate(event.createdAt, true)}</small></div>)}
        </div>
      </section>
    </article>
  );
}
