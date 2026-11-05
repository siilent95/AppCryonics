export type Result = "yes" | "no" | "na" | "any" | null;
export type StepKey = "construction" | "operation" | "verification" | "examination" | "review";
export type InspectionStep = Exclude<StepKey, "review">;
export type BrandKey = "taylor" | "mve";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type CompletionStatus = "idle" | "completing" | "queued" | "completed" | "error";
export type WorkspaceView = "overview" | "orders" | "equipment" | "reports" | "users";
export type RecordsStatus = "idle" | "loading" | "loaded" | "error";
export type PmStatus = "draft" | "ready_for_signature" | "completed" | "archived";
export type SavedRecord = {
  id: string;
  recordNumber: string;
  revision: number;
};
export type PmRecordSummary = {
  id: string;
  recordNumber: string;
  documentVersion?: number;
  correctsRecordId?: string | null;
  correctionReason?: string | null;
  canCorrect?: boolean;
  canDelete?: boolean;
  deletedAt?: string | null;
  brand: BrandKey;
  equipmentBrandId?: string | null;
  equipmentBrandName?: string | null;
  modelFamily: string;
  model: string;
  facility: string | null;
  labName: string | null;
  clientOrganization: string | null;
  technicianName: string | null;
  assignedTechnicianName?: string | null;
  performedOn: string | null;
  freezerSerial: string | null;
  controllerSerial: string | null;
  location: string | null;
  controllerType: string | null;
  status: PmStatus;
  currentStep: string;
  revision: number;
  recipientSignatureCapturedAt: string | null;
  canEdit?: boolean;
  recipientSignatureRetentionUntil: string | null;
  recipientSignatureDeletedAt: string | null;
  technicianSignatureCapturedAt: string | null;
  technicianSignatureRetentionUntil: string | null;
  technicianSignatureDeletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ReportPayload = {
  responses?: Record<string, Result>;
  notes?: Partial<NotesState>;
  measurements?: Record<string, string | null>;
  examination?: Partial<ExamValues>;
  flags?: Record<string, boolean>;
};
export type ReportDetail = {
  localCapture?: import("../offline/types").Capture;
  localState?: string;
  versions?: { id: string; recordNumber: string; documentVersion: number; status: string; correctionReason: string | null; createdAt: string }[];
  record: PmRecordSummary & {
    assignedTechnicianId?: string | null;
    assignedTechnicianName?: string | null;
    createdBy?: string | null;
    canEdit?: boolean;
    signatureReference?: {
      id: string; recordNumber: string; documentVersion: number; technicianName: string | null;
      technicianSignatureCapturedAt: string | null; technicianSignatureDeletedAt: string | null; technicianSignatureRetentionUntil: string | null;
      recipientSignatureCapturedAt: string | null; recipientSignatureDeletedAt: string | null; recipientSignatureRetentionUntil: string | null;
    } | null;
    correctionPublication?: { name: string; createdAt: string } | null;
    firmwareVersion: string | null;
    templateVersion: string;
    payload: ReportPayload;
  };
  events: Array<{
    eventType: string;
    revision: number;
    createdAt: string;
  }>;
};
export type EquipmentRegistryItem = PmRecordSummary & {
  historyCount: number;
  completedCount: number;
};
export type ModelFamily = {
  family: string;
  models: readonly string[];
};
export type ChecklistItem = {
  id: string;
  label: string;
  help: string;
  batteryDependent?: boolean;
  allowNA?: boolean;
  anyInsteadOfNo?: boolean;
};
export type NotesState = Record<InspectionStep | "general", string>;
export type ExamValues = {
  highTemperature: string;
  lowTemperature: string;
  highLevelAlarm: string;
  highLevelSetPoint: string;
  lowLevelSetPoint: string;
  lowLevelAlarm: string;
  gasBypassTemperature: string;
  gasBypassDelay: string;
  maximumFillTime: string;
  eventLogInterval: string;
  temperatureUnit: string;
  levelUnit: string;
};
