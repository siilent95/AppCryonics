import { requireAdmin } from "@/lib/auth";
import { getDb, transactionalResponse } from "@/db";
import { equipmentBrands } from "@/db/schema";
import { auditCatalog, catalogError, readInput, field, sourceUrl, privateHeaders } from "@/lib/equipment/catalog";
import { templateInput } from "@/lib/equipment/catalog";
export async function POST(request: Request) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request); const input = await readInput(request);
    const id = crypto.randomUUID();
    await getDb().insert(equipmentBrands).values({ id, name: field(input.name, "name", 120), website: sourceUrl(input.website), pmTemplate: templateInput(input.pmTemplate) });
    await auditCatalog(actor.id, id, "brand_created");
    return Response.json({ id }, { status: 201, headers: privateHeaders });
  }); } catch (error) { return catalogError(error); }
}
