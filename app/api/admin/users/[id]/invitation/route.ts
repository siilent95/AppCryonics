import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, transactionalResponse } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { issueInvitation } from "@/lib/accounts/invitations";
import { accountError, privateHeaders, readInput } from "@/lib/accounts/shared";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await transactionalResponse(async () => {
    await getDb().execute(sql`SELECT pg_advisory_xact_lock(71403321)`);
    const actor = await requireAdmin(request);
    const { id } = await context.params;
    const input = await readInput(request);
    if (input.purpose !== "activation" && input.purpose !== "reset") throw new RequestValidationError("Invalid invitation purpose.");
    const [target] = await getDb().select().from(users).where(eq(users.id, id)).limit(1).for("update");
    if (!target || target.disabled) return Response.json({ error: "An enabled user is required." }, { status: 404, headers: privateHeaders });
    if ((target.activatedAt && input.purpose === "activation") || (!target.activatedAt && input.purpose === "reset")) throw new RequestValidationError("Invitation purpose does not match account status.");
    if (target.role === "admin" && target.activatedAt && !target.passwordSetupRequired) {
      const admins = await getDb().select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.disabled, 0), isNotNull(users.activatedAt), eq(users.passwordSetupRequired, 0)));
      if (admins.length <= 1) return Response.json({ error: "Another active administrator is required before resetting this admin account." }, { status: 409, headers: privateHeaders });
    }
    return Response.json({ invitation: await issueInvitation(id, actor.id, input.purpose) }, { headers: privateHeaders });
  }); } catch (error) { return accountError(error); }
}
