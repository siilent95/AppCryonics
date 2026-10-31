import { asc } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb, transactionalResponse } from "@/db";
import { adminEvents, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { issueInvitation } from "@/lib/accounts/invitations";
import { accountError, accountUsername, emailAddress, field, privateHeaders, readInput, userRole } from "@/lib/accounts/shared";
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const list = await getDb().select({ id: users.id, displayName: users.displayName, email: users.email, username: users.username, role: users.role, disabled: users.disabled, activatedAt: users.activatedAt, passwordSetupRequired: users.passwordSetupRequired }).from(users).orderBy(asc(users.displayName));
    return Response.json({ users: list }, { headers: privateHeaders });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try { return await transactionalResponse(async () => {
    const actor = await requireAdmin(request);
    const input = await readInput(request);
    const email = emailAddress(input.email);
    const username = accountUsername(input.username);
    const id = randomUUID();
    await getDb().insert(users).values({ id, email, username, displayName: field(input.displayName, "Name", 160), role: userRole(input.role), activatedAt: null, passwordSetupRequired: 1, passwordHash: await hashPassword(randomBytes(32).toString("hex")) });
    await getDb().insert(adminEvents).values({ actorId: actor.id, targetUserId: id, eventType: "user_created" });
    const invitation = await issueInvitation(id, actor.id, "activation");
    return Response.json({ id, invitation }, { status: 201, headers: privateHeaders });
  }); } catch (error) { return accountError(error); }
}
