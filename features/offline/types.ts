import type { BrandKey, ReportPayload, SavedRecord, StepKey } from "../pm/types";

export type OfflineUser = { id: string; displayName: string; role: "admin" | "technician" };
export type DraftBody = {
  brand: BrandKey; catalogModelId?: string; modelFamily: string; model: string;
  facility: string | null; labName: string; clientOrganization: string; performedOn: string;
  firmwareVersion: string | null; freezerSerial: string; controllerSerial: string;
  location: string; controllerType: string; templateVersion: string; currentStep: StepKey; payload: ReportPayload;
};
export type Capture = {
  technicianSignature: string; recipientSignature: string; technicianName: string;
  technicianResponsible: boolean; recipientAccepted: boolean; capturedAt?: string;
};
export const emptyCapture: Capture = { technicianSignature: "", recipientSignature: "", technicianName: "", technicianResponsible: false, recipientAccepted: false };
export type WorkspaceSnapshot = {
  body: DraftBody; capture: Capture; catalogBrandId: string; catalogBrandName: string;
  requestedStep: StepKey; correctsRecordId: string | null; correctionReason: string;
};
export type SyncOperation = {
  operationId: string; localId: string; recordId: string | null; expectedRevision: number | null;
  sequence: number; mode: "draft" | "complete" | "correction"; body: DraftBody; capture: Capture;
};
export type LocalDraft = {
  version: 1; id: string; ownerId: string; sequence: number; syncedSequence: number;
  snapshot: WorkspaceSnapshot; server: SavedRecord | null; formal: boolean;
  status: "local" | "pending" | "synced" | "blocked" | "completed";
  operation: SyncOperation | null; closing: boolean; error: string; errorCode?: number;
  updatedAt: string; syncedAt: string | null;
  editor?: string; editorUntil?: number; completedAt?: string;
};
export type Preparation = { at: string; reports: number; images: number; totalImages: number; documents: number; totalDocuments: number; complete: boolean; errors: string[]; shell: boolean };
