import { AuthenticationError } from "./_identity";

export const MAX_PAYLOAD_BYTES = 128_000;

export type Brand = "mve" | "taylor";
export type PmStatus = "draft" | "ready_for_signature" | "completed" | "archived";

export type DraftInput = {
  brand?: unknown;
  modelFamily?: unknown;
  model?: unknown;
  facility?: unknown;
  labName?: unknown;
  clientOrganization?: unknown;
  performedOn?: unknown;
  firmwareVersion?: unknown;
  freezerSerial?: unknown;
  controllerSerial?: unknown;
  location?: unknown;
  controllerType?: unknown;
  templateVersion?: unknown;
  currentStep?: unknown;
  payload?: unknown;
  expectedRevision?: unknown;
};

export type ValidDraftInput = {
  brand: Brand;
  modelFamily: string;
  model: string;
  facility: string | null;
  labName: string | null;
  clientOrganization: string | null;
  performedOn: string | null;
  firmwareVersion: string | null;
  freezerSerial: string | null;
  controllerSerial: string | null;
  location: string | null;
  controllerType: string | null;
  templateVersion: string;
  currentStep: string;
  payloadJson: string;
  expectedRevision: number | null;
};

const allowedSteps = new Set(["construction", "operation", "verification", "examination", "review"]);
const forbiddenKey = /(password|credential|patient|sample|clinical)/i;

export function validateDraftInput(input: DraftInput): ValidDraftInput {
  if (input.brand !== "mve" && input.brand !== "taylor") {
    throw new RequestValidationError("brand must be mve or taylor");
  }

  const modelFamily = requiredText(input.modelFamily, "modelFamily", 120);
  const model = requiredText(input.model, "model", 120);
  const performedOn = optionalText(input.performedOn, "performedOn", 10);
  if (performedOn && (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn) || Number.isNaN(Date.parse(`${performedOn}T12:00:00Z`)) || new Date(`${performedOn}T12:00:00Z`).toISOString().slice(0, 10) !== performedOn)) {
    throw new RequestValidationError("performedOn must be a valid YYYY-MM-DD date");
  }
  const currentStep = requiredText(input.currentStep, "currentStep", 32);
  if (!allowedSteps.has(currentStep)) {
    throw new RequestValidationError("currentStep is invalid");
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    throw new RequestValidationError("payload must be an object");
  }
  assertNoForbiddenKeys(input.payload);
  const payloadJson = JSON.stringify(input.payload);
  if (new TextEncoder().encode(payloadJson).byteLength > MAX_PAYLOAD_BYTES) {
    throw new RequestValidationError("payload exceeds the 128 KB limit");
  }

  const expectedRevision =
    input.expectedRevision === undefined || input.expectedRevision === null
      ? null
      : Number(input.expectedRevision);
  if (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) {
    throw new RequestValidationError("expectedRevision must be a positive integer");
  }

  return {
    brand: input.brand,
    modelFamily,
    model,
    facility: optionalText(input.facility, "facility", 160),
    labName: optionalText(input.labName, "labName", 160),
    clientOrganization: optionalText(input.clientOrganization, "clientOrganization", 160),
    performedOn,
    firmwareVersion: optionalText(input.firmwareVersion, "firmwareVersion", 80),
    freezerSerial: optionalText(input.freezerSerial, "freezerSerial", 120),
    controllerSerial: optionalText(input.controllerSerial, "controllerSerial", 120),
    location: optionalText(input.location, "location", 200),
    controllerType: optionalText(input.controllerType, "controllerType", 120),
    templateVersion: optionalText(input.templateVersion, "templateVersion", 24) ?? "0.2",
    currentStep,
    payloadJson,
    expectedRevision,
  };
}

export function parsePayload(payloadJson: string) {
  try {
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function apiError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof RequestValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (message.includes("no such table") || message.includes("D1 binding")) {
    return Response.json({ error: "PM storage is not initialized." }, { status: 503 });
  }
  if (message.includes("pseudonymization") || message.includes("Signature storage")) {
    return Response.json({ error: "Protected PM storage is not configured." }, { status: 503 });
  }
  return Response.json({ error: "Unable to process the PM record." }, { status: 500 });
}

function requiredText(value: unknown, field: string, maxLength: number) {
  const result = optionalText(value, field, maxLength);
  if (!result) throw new RequestValidationError(`${field} is required`);
  return result;
}

function optionalText(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new RequestValidationError(`${field} must be text`);
  const result = value.trim();
  if (result.length > maxLength) throw new RequestValidationError(`${field} is too long`);
  return result || null;
}

function assertNoForbiddenKeys(value: unknown, path = "payload") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKey.test(key)) {
      throw new RequestValidationError(`${path}.${key} is not an allowed data field`);
    }
    assertNoForbiddenKeys(child, `${path}.${key}`);
  }
}

export class RequestValidationError extends Error {}
