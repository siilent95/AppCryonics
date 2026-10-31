import { requireActor } from "@/lib/auth";
import { apiError } from "@/app/api/pm-records/_shared";
import { analyticsFilters, analyticsHeaders, getAnalytics } from "@/lib/pm/analytics";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const owner = actor.role === "admin" ? null : actor.id;
    return Response.json(await getAnalytics(owner, analyticsFilters(new URL(request.url).searchParams)), { headers: analyticsHeaders });
  } catch (error) { return apiError(error); }
}
