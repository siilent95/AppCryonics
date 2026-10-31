import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, transactionalResponse } from "@/db";
import { equipmentBrands, equipmentModels } from "@/db/schema";
import { auditCatalog, catalogError, modelInput, readInput, privateHeaders } from "@/lib/equipment/catalog";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function POST(request: Request) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request); const input = modelInput(await readInput(request));
    const [brand] = await getDb().select().from(equipmentBrands).where(eq(equipmentBrands.id, input.brandId));
    if (!brand) throw new RequestValidationError("Select an existing brand.");
    const id = crypto.randomUUID(); await getDb().insert(equipmentModels).values({ id, ...input });
    await auditCatalog(actor.id, id, "model_created");
    return Response.json({ id }, { status: 201, headers: privateHeaders });
  }); } catch (error) { return catalogError(error); }
}
