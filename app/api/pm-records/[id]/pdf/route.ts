import { pmReadScope } from "@/lib/pm/access";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { pmRecords } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { apiError, parsePayload } from "../../_shared";
import { purgeExpiredSignatures } from "../../_retention";
import { getSignatureBucket } from "../../_signature-storage";
import { renderPmPdf } from "@/lib/pm/render-pdf";
import type { ReportDetail } from "@/features/pm/types";
import { correctionPresentation } from "@/lib/pm/corrections";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    await purgeExpiredSignatures();
    const [record] = await getDb().select().from(pmRecords).where(and(eq(pmRecords.id, id), pmReadScope(actor), isNull(pmRecords.deletedAt))).limit(1);
    if (!record) return Response.json({ error: "PM record not found." }, { status: 404, headers: privateHeaders });
    if (record.status !== "completed") return Response.json({ error: record.correctsRecordId ? "Finalize the correction before downloading its PDF." : "Complete and sign this PM before downloading its PDF." }, { status: 409, headers: privateHeaders });
    const bucket = getSignatureBucket();
    const readSignature = async (key: string | null, deleted: string | null) => {
      if (!key || deleted) return null;
      const object = await bucket.get(key);
      return object ? Buffer.from(object.body) : null;
    };
    const { source, signatureReference, correctionPublication } = await correctionPresentation(record);
    const [technician, recipient] = await Promise.all([readSignature(source.technicianSignatureKey, source.technicianSignatureDeletedAt), readSignature(source.recipientSignatureKey, source.recipientSignatureDeletedAt)]);
    const pdf = await renderPmPdf({ ...record, signatureReference, correctionPublication, payload: parsePayload(record.payloadJson) } as ReportDetail["record"], { technician, recipient });
    const filename = `${record.recordNumber.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 80)}-${(record.equipmentBrandId && record.equipmentBrandId !== record.brand ? record.equipmentBrandName || record.brand : record.brand).replace(/[^a-zA-Z0-9_.-]/g,"-").slice(0,60)}.pdf`;
    return new Response(new Uint8Array(pdf), { headers: { ...privateHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": String(pdf.length) } });
  } catch (error) { return apiError(error); }
}
