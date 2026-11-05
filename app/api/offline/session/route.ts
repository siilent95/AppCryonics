import { requireActor } from "@/lib/auth";
import { apiError } from "@/app/api/pm-records/_shared";
export async function GET(request: Request) {
  try {
    const { id, displayName, role } = await requireActor(request);
    return Response.json({ user: { id, displayName, role } }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}
