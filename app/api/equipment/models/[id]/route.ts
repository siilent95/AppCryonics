import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, transactionalResponse } from "@/db";
import { equipmentModels } from "@/db/schema";
import { auditCatalog, catalogError, modelInput, readInput, privateHeaders } from "@/lib/equipment/catalog";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request); const { id } = await context.params;
    const body = await readInput(request); const input = modelInput(body);
    const [current] = await getDb().select().from(equipmentModels).where(eq(equipmentModels.id, id));
    if (!current) return Response.json({ error: "Model not found." }, { status: 404 });
    if (input.brandId !== current.brandId || input.family !== current.family || input.model !== current.model) throw new RequestValidationError("Brand, family and model identify a catalog entry. Create a new entry to change its identity.");
    const [updated] = await getDb().update(equipmentModels).set({ ...input, revision: current.revision + 1, updatedAt: new Date().toISOString() })
      .where(and(eq(equipmentModels.id, id), eq(equipmentModels.revision, Number(body.expectedRevision)))).returning({ id: equipmentModels.id });
    if (!updated) return Response.json({ error: "The model changed. Refresh the catalog and try again." }, { status: 409 });
    await auditCatalog(actor.id, id, "model_updated");
    return Response.json({ id }, { headers: privateHeaders });
  }); } catch (error) { return catalogError(error); }
}
