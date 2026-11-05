import { requireActor } from "@/lib/auth";
import { readCatalog, catalogError, privateHeaders } from "@/lib/equipment/catalog";
export async function GET(request: Request) {
  try { const actor = await requireActor(request); return Response.json(await readCatalog(), { headers: {...privateHeaders,"X-CryoPM-Actor":actor.id} }); }
  catch (error) { return catalogError(error); }
}
