import { requireActor } from "@/lib/auth";
import { readCatalog, catalogError, privateHeaders } from "@/lib/equipment/catalog";
export async function GET(request: Request) {
  try { await requireActor(request); return Response.json(await readCatalog(), { headers: privateHeaders }); }
  catch (error) { return catalogError(error); }
}
