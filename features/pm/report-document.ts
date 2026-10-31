import { constructionItems, operationItems, verificationItems, equipment } from "./catalogs";
import { recordBrandLabel, brandLabel } from "./helpers";
import type { ChecklistItem, ExamValues, InspectionStep, NotesState, ReportDetail } from "./types";
export type ReportRow = { label: string; value: string; reference?: string };
export type ReportSection = { title: string; intro: string; groups: { title?: string; rows: ReportRow[]; measurement?: boolean }[]; note: string };
export function reportDocument(record: ReportDetail["record"]) {
  const payload = record.payload;
  const text = (value: unknown, fallback = "Not recorded") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const answerLabels: Record<string, string> = { yes: "Yes", no: "No", na: "N/A", any: "Any" };
  const answer = (section: InspectionStep, id: string) => (answerLabels[payload.responses?.[`${record.brand}:${section}:${id}`] ?? ""] ?? "Not recorded");
  const measure = (key: string, unit: string) => { const value = text(payload.measurements?.[key]); return value === "Not recorded" ? value : `${value} ${unit}`; };
  const note = (section: keyof NotesState) => text(payload.notes?.[section], "No observations recorded.");
  const checklist = (section: InspectionStep, items: readonly ChecklistItem[]) => items.map(item => ({ label: item.label, value: answer(section, item.id) }));
  const exam = payload.examination ?? {};
  const examValue = (key: keyof ExamValues, unit = "") => {
    if ((key === "gasBypassTemperature" && payload.flags?.gasBypassTemperatureNA) || (key === "gasBypassDelay" && payload.flags?.gasBypassDelayNA)) return "N/A";
    const value = text(exam[key]); return value === "Not recorded" ? value : `${value}${unit ? ` ${unit}` : ""}`;
  };
  const manual = payload.measurements?.manualLevel, controller = payload.measurements?.controllerLevel;
  const difference = manual && controller && Number.isFinite(Number(manual)) && Number.isFinite(Number(controller)) ? `${Math.abs(Number(manual) - Number(controller)).toFixed(2)} in` : "Not recorded";
  const sections: ReportSection[] = [
    { title: "01 / Construction", intro: "Visual and mechanical inspection of the freezer construction.", groups: [{ rows: checklist("construction", constructionItems) }], note: note("construction") },
    { title: "02 / Operation", intro: "Electrical, valve and battery backup inspection.", groups: [
      { rows: checklist("operation", operationItems[record.brand]) },
      ...(record.brand === "mve" ? [{ title: "Solenoid resistance", measurement: true, rows: [
        { label: "Solenoid valve resistance confirmed", value: answer("operation", "resistance-confirmed") },
        { label: "Single valve resistance", value: measure("singleValveResistance", "Ω"), reference: "62 < R < 74 Ω" },
        { label: "Dual valve resistance", value: measure("dualValveResistance", "Ω"), reference: "28 < R < 38 Ω" },
        { label: "Purge / 3-way valve resistance", value: measure("purgeValveResistance", "Ω"), reference: "135 < R < 145 Ω" },
      ] }] : []),
      { title: "Battery measurement", measurement: true, rows: [{ label: "Battery output voltage", value: measure("batteryVoltage", "VDC"), reference: `${equipment[record.brand].batteryNominal} to ${(equipment[record.brand].batteryNominal * 1.1).toFixed(1)} VDC` }] },
    ], note: note("operation") },
    { title: "03 / Verification", intro: "Temperature probes, liquid level and functional controls.", groups: [
      { measurement: true, rows: [
        { label: record.brand === "mve" ? "Temperature resistance confirmed" : "Thermocouple resistance confirmed", value: answer("verification", "temperature-resistance") },
        { label: "Room temperature resistance", value: measure("roomResistance", "Ω"), reference: `${equipment[record.brand].room.min} < R < ${equipment[record.brand].room.max} Ω` },
        { label: "Cryogenic temperature resistance", value: measure("cryoResistance", "Ω"), reference: `${equipment[record.brand].cryo.min} < R < ${equipment[record.brand].cryo.max} Ω` },
        { label: "Manually measured liquid level", value: measure("manualLevel", "in") }, { label: "Controller displayed liquid level", value: measure("controllerLevel", "in") },
        { label: "Displayed vs. actual level difference", value: difference, reference: "≤ 0.5 in" },
      ] }, { title: "Functional verification", rows: checklist("verification", verificationItems[record.brand]) },
    ], note: note("verification") },
    { title: "04 / Examination", intro: "Controller readings and configured alarm, level and time values.", groups: [{ measurement: true, rows: [
      { label: "Temperature unit", value: examValue("temperatureUnit") }, { label: "Level unit", value: examValue("levelUnit") },
      ...([ ["High Temperature A-B", "highTemperature", exam.temperatureUnit], ["Low Temperature A-B", "lowTemperature", exam.temperatureUnit],
        ["High Level Alarm", "highLevelAlarm", exam.levelUnit], ["High Level Set Point", "highLevelSetPoint", exam.levelUnit], ["Low Level Set Point", "lowLevelSetPoint", exam.levelUnit], ["Low Level Alarm", "lowLevelAlarm", exam.levelUnit],
        ["Gas Bypass Temperature Set Point", "gasBypassTemperature", exam.temperatureUnit], ["Gas Bypass Time Delay", "gasBypassDelay", "min"], ["Maximum Fill Time", "maximumFillTime", "min"], ["Event Log Interval", "eventLogInterval", "min"],
      ] as const).map(([label, key, unit]) => ({ label, value: examValue(key, unit) })),
    ] }], note: note("examination") },
  ];
  return { sections, general: note("general"), facts: [
    ["Document version", String(record.documentVersion || 1)],
    ...(record.correctionPublication ? [["Correction finalized by", record.correctionPublication.name], ["Correction finalized on", record.correctionPublication.createdAt]] : []),
    ...(record.correctionReason ? [["Reason for correction", record.correctionReason]] : []),
    ["Technician", text(record.signatureReference?.technicianName || record.technicianName)], ["Freezer model", `${recordBrandLabel(record)} ${record.modelFamily} / ${record.model}`],
    ...(record.equipmentBrandId && record.equipmentBrandId !== record.brand ? [["PM template", brandLabel(record.brand)]] : []),
    ["Serial number", text(record.freezerSerial)], ["Client", text(record.clientOrganization)], ["Lab name", text(record.labName)], ["Location", text(record.location)],
    ["Controller serial", text(record.controllerSerial)], ["Controller type", text(record.controllerType)], ...(record.brand === "mve" ? [["Firmware version", text(record.firmwareVersion)]] : []),
  ] };
}
