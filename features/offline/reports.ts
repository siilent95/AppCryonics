import type { LocalDraft } from "./types";
import type { PmRecordSummary, ReportDetail } from "../pm/types";
export function localDetail(d: LocalDraft, original?: ReportDetail): ReportDetail {
  const b=d.snapshot.body; const completed=d.status==="completed";
  const record: ReportDetail["record"] = {
    ...original?.record, id:d.server?.id || `local:${d.id}`, recordNumber:d.server?.recordNumber || `LOCAL-${d.id.slice(0,8).toUpperCase()}`,
    brand:b.brand, equipmentBrandId:d.snapshot.catalogBrandId, equipmentBrandName:d.snapshot.catalogBrandName,
    modelFamily:b.modelFamily, model:b.model, facility:b.facility, firmwareVersion:b.firmwareVersion,
    labName:b.labName, clientOrganization:b.clientOrganization, performedOn:b.performedOn, freezerSerial:b.freezerSerial,
    controllerSerial:b.controllerSerial, location:b.location, controllerType:b.controllerType, templateVersion:b.templateVersion,
    currentStep:b.currentStep, payload:b.payload, revision:d.server?.revision || 0, status:completed ? "completed" : "draft",
    technicianName:completed ? d.snapshot.capture.technicianName : null, assignedTechnicianName:original?.record.assignedTechnicianName || "Current technician",
    canEdit:!completed && !d.closing, canCorrect:false, canDelete:false, createdAt:original?.record.createdAt || d.updatedAt, updatedAt:d.updatedAt,
    technicianSignatureCapturedAt:completed ? d.completedAt || null : null, technicianSignatureRetentionUntil:null, technicianSignatureDeletedAt:null,
    recipientSignatureCapturedAt:completed ? d.completedAt || null : null, recipientSignatureRetentionUntil:null, recipientSignatureDeletedAt:null,
    correctsRecordId:d.snapshot.correctsRecordId, correctionReason:d.snapshot.correctionReason,
  };
  return { record, versions:original?.versions || [], events:original?.events || [], localCapture:d.snapshot.capture, localState:completed ? "Synchronized copy" : d.closing ? "Completion pending synchronization" : d.sequence>d.syncedSequence ? "Device changes pending synchronization" : "Device copy" };
}
export function filterReports(records: PmRecordSummary[], params: URLSearchParams) {
  if (params.get("view")==="trash") throw new Error("Trash requires a connection.");
  const q=(params.get("q")||"").toLowerCase(); const tech=(params.get("technician")||"").toLowerCase();
  const filtered=records.filter(r => (!q || [r.recordNumber,r.freezerSerial,r.modelFamily,r.model,r.labName,r.clientOrganization,r.location].join(" ").toLowerCase().includes(q)) &&
    (!tech || (r.technicianName||"").toLowerCase().includes(tech)) && (!params.get("brand") || (r.equipmentBrandId||r.brand)===params.get("brand")) &&
    (!params.get("status") || r.status===params.get("status")) && (!params.get("from") || (r.performedOn||r.createdAt.slice(0,10))>=params.get("from")!) &&
    (!params.get("to") || (r.performedOn||r.createdAt.slice(0,10))<=params.get("to")!)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(filtered.length/25)); const page=Math.max(1,Math.min(Number(params.get("page"))||1,pages));
  const brands=Array.from(new Map(records.map(r=>[r.equipmentBrandId||r.brand,{ id:r.equipmentBrandId||r.brand,name:r.equipmentBrandName || (r.brand==="mve" ? "MVE" : "Taylor-Wharton") }])).values());
  return { records:filtered.slice((page-1)*25,page*25),pagination:{page,pageSize:25,total:filtered.length,pages},brands };
}
