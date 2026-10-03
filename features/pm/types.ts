export type Result = "yes" | "no" | "na" | "any" | null;
export type StepKey = "construction" | "operation" | "verification" | "examination" | "review";
export type InspectionStep = Exclude<StepKey, "review">;
export type BrandKey = "taylor" | "mve";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type CompletionStatus = "idle" | "completing" | "completed" | "error";
export type WorkspaceView = "overview" | "orders" | "equipment" | "reports";
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
  brand: BrandKey;
  modelFamily: string;
  model: string;
  facility: string | null;
  labName: string | null;
  clientOrganization: string | null;
  technicianName: string | null;
  performedOn: string | null;
  freezerSerial: string | null;
  controllerSerial: string | null;
  location: string | null;
  controllerType: string | null;
  status: PmStatus;
  currentStep: string;
  revision: number;
  recipientSignatureCapturedAt: string | null;
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
  record: PmRecordSummary & {
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

