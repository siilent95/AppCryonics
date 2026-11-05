import { requireActor } from "@/lib/auth";
import { apiError } from "@/app/api/pm-records/_shared";
import { analyticsFilters, analyticsHeaders, getAnalyticsRecords } from "@/lib/pm/analytics";
export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const owner = actor.role === "admin" ? null : actor.id;
    const params = new URL(request.url).searchParams;
    return Response.json(await getAnalyticsRecords(owner, analyticsFilters(params), params), { headers: {...analyticsHeaders, "X-CryoPM-Actor":actor.id} });
  } catch (error) { return apiError(error); }
}
