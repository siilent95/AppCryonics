import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { pmEvents, pmRecords } from "../../../../../db/schema";
import { requireActorSubject } from "../../_identity";
import { purgeExpiredSignatures } from "../../_retention";
import { getSignatureBucket } from "../../_signature-storage";
import { apiError, parsePayload, RequestValidationError } from "../../_shared";

type RouteContext = { params: Promise<{ id: string }> };
type SignatureRole = "recipient" | "technician";

type SignatureInput = {
  recipientSignatureDataUrl?: unknown;
  recipientAccepted?: unknown;
  recipientAcceptanceVersion?: unknown;
  technicianSignatureDataUrl?: unknown;
  technicianName?: unknown;
  technicianResponsible?: unknown;
  technicianAcceptanceVersion?: unknown;
  expectedRevision?: unknown;
};

const RECIPIENT_ACCEPTANCE_VERSION = "PM_RECEIPT_V1";
const TECHNICIAN_ACCEPTANCE_VERSION = "PM_TECHNICIAN_RESPONSIBILITY_V1";
const SIGNATURE_CONTENT_TYPE = "image/png";
const MAX_SIGNATURE_BYTES = 384_000;
const SIX_YEARS = 6;

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const role = parseSignatureRole(request);
    const actorSubject = await requireActorSubject(request);
    await purgeExpiredSignatures();
    const db = getDb();
    const [record] = await db
      .select({
        recipientKey: pmRecords.recipientSignatureKey,
        recipientMimeType: pmRecords.recipientSignatureMimeType,
        recipientDeletedAt: pmRecords.recipientSignatureDeletedAt,
        technicianKey: pmRecords.technicianSignatureKey,
        technicianMimeType: pmRecords.technicianSignatureMimeType,
        technicianDeletedAt: pmRecords.technicianSignatureDeletedAt,
      })
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          eq(pmRecords.ownerSubject, actorSubject),
          isNull(pmRecords.deletedAt),
        ),
      )
      .limit(1);

    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    const key = role === "technician" ? record.technicianKey : record.recipientKey;
    const mimeType = role === "technician" ? record.technicianMimeType : record.recipientMimeType;
    const deletedAt = role === "technician" ? record.technicianDeletedAt : record.recipientDeletedAt;
    const roleLabel = role === "technician" ? "Technician" : "Recipient";

    if (!key || deletedAt) {
      return Response.json({ error: `${roleLabel} signature is not available.` }, { status: 404 });
    }

    const object = await getSignatureBucket().get(key);
    if (!object) {
      return Response.json({ error: `${roleLabel} signature is not available.` }, { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        ...privateHeaders,
        "Content-Type": mimeType || object.httpMetadata?.contentType || SIGNATURE_CONTENT_TYPE,
        "Content-Disposition": `inline; filename="${id}-${role}-signature.png"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  let storedKeys: string[] = [];
  try {
    const { id } = await context.params;
    const actorSubject = await requireActorSubject(request);
    const input = validateSignatureInput((await request.json()) as SignatureInput);
    const db = getDb();
    const [record] = await db
      .select({
        recordNumber: pmRecords.recordNumber,
        status: pmRecords.status,
        revision: pmRecords.revision,
        payloadJson: pmRecords.payloadJson,
        performedOn: pmRecords.performedOn,
        clientOrganization: pmRecords.clientOrganization,
        previousRecipientKey: pmRecords.recipientSignatureKey,
        previousTechnicianKey: pmRecords.technicianSignatureKey,
      })
      .from(pmRecords)
      .where(
        and(
          eq(pmRecords.id, id),
          eq(pmRecords.ownerSubject, actorSubject),
          isNull(pmRecords.deletedAt),
        ),
      )
      .limit(1);

    if (!record) return Response.json({ error: "PM record not found." }, { status: 404 });
    if (record.status === "completed" || record.status === "archived") {
      return Response.json({ error: "A signed PM cannot be signed again." }, { status: 409 });
    }
    if (record.revision !== input.expectedRevision) {
      return Response.json(
        { error: "This PM draft was updated elsewhere.", currentRevision: record.revision },
        { status: 409 },
      );
    }
    if (!record.performedOn) {
      throw new RequestValidationError("PM execution date is required before signing.");
    }
    if (!record.clientOrganization) {
      throw new RequestValidationError("Client organization is required before signing.");
    }
    validateExaminationOrder(parsePayload(record.payloadJson));

    const capturedAt = new Date();
    const retentionUntil = new Date(capturedAt);
    retentionUntil.setUTCFullYear(retentionUntil.getUTCFullYear() + SIX_YEARS);
    const capturedAtIso = capturedAt.toISOString();
    const retentionUntilIso = retentionUntil.toISOString();
    const recipientKey = `pm-signatures/${id}/recipient-${crypto.randomUUID()}.png`;
    const technicianKey = `pm-signatures/${id}/technician-${crypto.randomUUID()}.png`;
    const recipientSha256 = await digestHex(input.recipientBytes);
    const technicianSha256 = await digestHex(input.technicianBytes);
    const bucket = getSignatureBucket();

    await bucket.put(recipientKey, input.recipientBytes, {
      httpMetadata: { contentType: SIGNATURE_CONTENT_TYPE },
      customMetadata: {
        pmRecordId: id,
        signatureRole: "recipient",
        acceptanceVersion: RECIPIENT_ACCEPTANCE_VERSION,
        retentionUntil: retentionUntilIso,
      },
    });
    storedKeys.push(recipientKey);

    await bucket.put(technicianKey, input.technicianBytes, {
      httpMetadata: { contentType: SIGNATURE_CONTENT_TYPE },
      customMetadata: {
        pmRecordId: id,
        signatureRole: "technician",
        acceptanceVersion: TECHNICIAN_ACCEPTANCE_VERSION,
        retentionUntil: retentionUntilIso,
      },
    });
    storedKeys.push(technicianKey);

    const nextRevision = record.revision + 1;
    const [updated] = await db
      .update(pmRecords)
      .set({
        ownerSubject: actorSubject,
        ownerEmail: null,
        status: "completed",
        currentStep: "review",
        recipientSignatureKey: recipientKey,
        recipientSignatureSha256: recipientSha256,
        recipientSignatureMimeType: SIGNATURE_CONTENT_TYPE,
        recipientSignatureCapturedAt: capturedAtIso,
        recipientSignatureConsentVersion: RECIPIENT_ACCEPTANCE_VERSION,
        recipientSignatureRetentionUntil: retentionUntilIso,
        recipientSignatureDeletedAt: null,
        technicianSignatureKey: technicianKey,
        technicianName: input.technicianName,
        technicianSignatureSha256: technicianSha256,
        technicianSignatureMimeType: SIGNATURE_CONTENT_TYPE,
        technicianSignatureCapturedAt: capturedAtIso,
        technicianSignatureAcceptanceVersion: TECHNICIAN_ACCEPTANCE_VERSION,
        technicianSignatureRetentionUntil: retentionUntilIso,
        technicianSignatureDeletedAt: null,
        revision: nextRevision,
        updatedAt: capturedAtIso,
      })
      .where(and(eq(pmRecords.id, id), eq(pmRecords.revision, record.revision), eq(pmRecords.status, record.status)))
      .returning({ id: pmRecords.id });

    if (!updated) {
      await bucket.delete(storedKeys);
      storedKeys = [];
      return Response.json({ error: "This PM draft was updated elsewhere." }, { status: 409 });
    }

    storedKeys = [];
    const previousKeys = [record.previousRecipientKey, record.previousTechnicianKey].filter(
      (key): key is string => Boolean(key) && key !== recipientKey && key !== technicianKey,
    );
    if (previousKeys.length > 0) await bucket.delete(previousKeys);

    await db.insert(pmEvents).values({
      recordId: id,
      eventType: "signature_captured",
      actorSubject,
      actorEmail: null,
      revision: nextRevision,
      detailsJson: JSON.stringify({
        signatureRoles: ["technician", "recipient"],
        recipientAcceptanceVersion: RECIPIENT_ACCEPTANCE_VERSION,
        technicianAcceptanceVersion: TECHNICIAN_ACCEPTANCE_VERSION,
        capturedAt: capturedAtIso,
        retentionUntil: retentionUntilIso,
        recipientSha256,
        technicianSha256,
      }),
    });

    return Response.json(
      {
        record: {
          id,
          recordNumber: record.recordNumber,
          revision: nextRevision,
          status: "completed",
          signatureCapturedAt: capturedAtIso,
          signatureRetentionUntil: retentionUntilIso,
          technicianSignatureCapturedAt: capturedAtIso,
          technicianSignatureRetentionUntil: retentionUntilIso,
        },
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (storedKeys.length > 0) {
      try {
        await getSignatureBucket().delete(storedKeys);
      } catch {
        // The protected storage layer will retry cleanup on the next retention pass.
      }
    }
    return apiError(error);
  }
}

function parseSignatureRole(request: Request): SignatureRole {
  const role = new URL(request.url).searchParams.get("role");
  if (!role || role === "recipient") return "recipient";
  if (role === "technician") return "technician";
  throw new RequestValidationError("Signature role must be recipient or technician.");
}

function validateSignatureInput(input: SignatureInput) {
  if (typeof input.technicianName !== "string" || !input.technicianName.trim() || input.technicianName.trim().length > 120) {
    throw new RequestValidationError("Responsible technician name is required (maximum 120 characters).");
  }
  if (
    input.recipientAccepted !== true ||
    input.recipientAcceptanceVersion !== RECIPIENT_ACCEPTANCE_VERSION
  ) {
    throw new RequestValidationError("Recipient acceptance is required.");
  }
  if (
    input.technicianResponsible !== true ||
    input.technicianAcceptanceVersion !== TECHNICIAN_ACCEPTANCE_VERSION
  ) {
    throw new RequestValidationError("Technician responsibility confirmation is required.");
  }
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new RequestValidationError("expectedRevision must be a positive integer.");
  }
  return {
    expectedRevision,
    technicianName: input.technicianName.trim(),
    recipientBytes: parseSignatureDataUrl(input.recipientSignatureDataUrl, "Recipient"),
    technicianBytes: parseSignatureDataUrl(input.technicianSignatureDataUrl, "Technician"),
  };
}

function validateExaminationOrder(payload: Record<string, unknown>) {
  const values = payload.examination;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new RequestValidationError("Examination values must be completed before signing.");
  }
  const exam = values as Record<string, unknown>;
  const pairs = [
    ["lowTemperature", "highTemperature"],
    ["lowLevelAlarm", "highLevelAlarm"],
    ["lowLevelSetPoint", "highLevelSetPoint"],
  ] as const;
  for (const [minimum, maximum] of pairs) {
    const low = Number(exam[minimum]);
    const high = Number(exam[maximum]);
    if (exam[minimum] === "" || exam[maximum] === "" || !Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
      throw new RequestValidationError(`${minimum} must be lower than ${maximum}.`);
    }
  }
}

function parseSignatureDataUrl(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${label} signature is required.`);
  }
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new RequestValidationError(`${label} signature must be a PNG image.`);

  const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
  if (bytes.byteLength < 100 || bytes.byteLength > MAX_SIGNATURE_BYTES) {
    throw new RequestValidationError(`${label} signature image size is invalid.`);
  }
  const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngHeader.every((byte, index) => bytes[index] === byte)) {
    throw new RequestValidationError(`${label} signature image is invalid.`);
  }
  return bytes;
}

async function digestHex(bytes: Uint8Array) {
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const privateHeaders = {
  "Cache-Control": "no-store, private",
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
};
