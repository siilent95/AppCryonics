import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, transactionalResponse } from "@/db";
import { equipmentBrands } from "@/db/schema";
import { auditCatalog, catalogError, readInput, field, sourceUrl, templateInput, privateHeaders } from "@/lib/equipment/catalog";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request); const input = await readInput(request); const { id } = await context.params;
    const pmTemplate = templateInput(input.pmTemplate);
    const [current] = await getDb().select().from(equipmentBrands).where(eq(equipmentBrands.id, id)).for("update");
    if (!current) return Response.json({ error: "Brand not found." }, { status: 404 });
    if ((id === "mve" || id === "taylor") && pmTemplate !== id) throw new RequestValidationError("The original brand retains its native PM template.");
    await getDb().update(equipmentBrands).set({ name: field(input.name, "name", 120), website: sourceUrl(input.website), pmTemplate }).where(eq(equipmentBrands.id, id));
    await auditCatalog(actor.id, id, "brand_updated"); return Response.json({ id }, { headers: privateHeaders });
  }); } catch (error) { return catalogError(error); }
}
