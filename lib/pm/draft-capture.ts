import { RequestValidationError } from "@/app/api/pm-records/_shared";
import { parseSignatureDataUrl } from "./signature-image";
import type { Capture } from "@/features/offline/types";
export async function validateCapture(value: unknown): Promise<Capture> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestValidationError("Capture information is required.");
  const c = value as Record<string, unknown>;
  for (const name of ["technicianSignature", "recipientSignature", "technicianName"]) if (typeof c[name] !== "string") throw new RequestValidationError("Invalid draft capture.");
  if ((c.technicianName as string).length > 120 || typeof c.technicianResponsible !== "boolean" || typeof c.recipientAccepted !== "boolean") throw new RequestValidationError("Invalid draft capture.");
  for (const name of ["technicianSignature", "recipientSignature"]) if (c[name]) await parseSignatureDataUrl(c[name], "Provisional");
  if (c.capturedAt !== undefined && (typeof c.capturedAt !== "string" || c.capturedAt.length > 40 || !Number.isFinite(Date.parse(c.capturedAt)))) throw new RequestValidationError("Invalid declared capture time.");
  return { technicianSignature: c.technicianSignature as string, recipientSignature: c.recipientSignature as string, technicianName: c.technicianName as string, technicianResponsible: c.technicianResponsible, recipientAccepted: c.recipientAccepted, ...(c.capturedAt ? { capturedAt: c.capturedAt as string } : {}) };
}
