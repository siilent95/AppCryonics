import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users, pmRecords, adminEvents, userInvitations } from "../db/schema";
import { createSession, requireActor, tokenHash } from "../lib/auth";
import { hashPassword } from "../lib/password";
import { PATCH as edit } from "../app/api/admin/users/[id]/profile/route";
import { GET as directory, POST as invite } from "../app/api/admin/users/route";
import { POST as login } from "../app/api/auth/login/route";
import { POST as activate } from "../app/api/auth/activate/route";
import { POST as create } from "../app/api/pm-records/route";
import { POST as sign } from "../app/api/pm-records/[id]/signature/route";
import { GET as detail } from "../app/api/pm-records/[id]/route";
import { completeQaDraft, qaSigningInput } from "./fixtures/pm";

type Profile = { displayName: string; email: string; username: string | null };
export async function testUserProfiles() {
  const db = getDb(), password = "profile-test-password";
  const adminId = randomUUID(), techId = randomUUID(), otherId = randomUUID();
  await db.insert(users).values([
    { id: adminId, displayName: "Profile admin", email: "profile-admin@example.test", username: "profileadmin", role: "admin", passwordHash: await hashPassword(password) },
    { id: techId, displayName: "Profile technician", email: "profile-tech@example.test", username: "profiletech", passwordHash: await hashPassword(password) },
    { id: otherId, displayName: "Profile other", email: "profile-taken@example.test", username: "profiletaken", passwordHash: await hashPassword(password) },
  ]);
  const admin = await createSession(adminId), tech = await createSession(techId);
  const req = (method: string, path: string, body?: unknown, token = admin) => new Request(`http://localhost:3000${path}`, { method, headers: { cookie: `cryopm_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  const path = `/api/admin/users/${techId}/profile`;
  const snapshot = async (id = techId): Promise<Profile> => { const [user] = await db.select().from(users).where(eq(users.id, id)); return { displayName: user.displayName, email: user.email, username: user.username }; };
  const old = await snapshot();
  const oldUser = (await db.select().from(users).where(eq(users.id, techId)))[0];
  const body = { displayName: "  Updated technician  ", email: "  PROFILE-NEW@EXAMPLE.TEST  ", username: "  New.Profile  ", expectedProfile: old };
  assert.equal((await edit(req("PATCH", path, body, tech), ctx(techId))).status, 403);
  const unauthorized = new Request(`http://localhost:3000${path}`, { method: "PATCH", headers: { origin: "http://localhost:3000" }, body: JSON.stringify(body) });
  assert.equal((await edit(unauthorized, ctx(techId))).status, 401);
  const forged = req("PATCH", path, body); forged.headers.set("origin", "https://other.test");
  assert.equal((await edit(forged, ctx(techId))).status, 401);
  for (const invalid of [{}, { displayName: "" }, { email: "not-an-email" }, { username: "ab" }, { username: "bad user" }, { username: false }, { role: "admin" }, { disabled: false }, { password: password }, { displayName: "x".repeat(161) }]) assert.equal((await edit(req("PATCH", path, { ...invalid, expectedProfile: old }), ctx(techId))).status, 400);
  assert.equal((await edit(req("PATCH", path, { displayName: "New name" }), ctx(techId))).status, 400);
  for (const taken of [{ email: "PROFILE-TAKEN@example.test" }, { username: "PROFILETAKEN" }]) assert.equal((await edit(req("PATCH", path, { ...taken, expectedProfile: old }), ctx(techId))).status, 409);
  assert.deepEqual(await snapshot(), old);

  const creation = await create(req("POST", "/api/pm-records", completeQaDraft("taylor"), tech)); assert.equal(creation.status, 201);
  const pmId = (await creation.json()).record.id;
  assert.equal((await sign(req("POST", `/api/pm-records/${pmId}/signature`, await qaSigningInput(1), tech), ctx(pmId))).status, 200);
  const originalPm = (await db.select().from(pmRecords).where(eq(pmRecords.id, pmId)))[0];
  const changed = await edit(req("PATCH", path, body), ctx(techId)); assert.equal(changed.status, 200);
  const result = await changed.json();
  assert.deepEqual(result.user, { id: techId, displayName: "Updated technician", email: "profile-new@example.test", username: "new.profile" });
  assert.equal(result.invitationsRevoked, 0); assert.equal(result.user.passwordHash, undefined);
  const currentUser = (await db.select().from(users).where(eq(users.id, techId)))[0];
  for (const key of ["id", "role", "disabled", "activatedAt", "passwordHash", "passwordSetupRequired"] as const) assert.equal(currentUser[key], oldUser[key]);
  assert.deepEqual((await db.select().from(pmRecords).where(eq(pmRecords.id, pmId)))[0], originalPm, "profile changes preserve signed PM snapshots and user IDs");
  assert.equal((await detail(req("GET", `/api/pm-records/${pmId}`, undefined, tech), ctx(pmId))).status, 200);
  assert.equal((await requireActor(req("GET", "/api/pm-records", undefined, tech))).displayName, "Updated technician", "existing sessions remain valid and use the new display name");
  const audit = await db.select().from(adminEvents).where(eq(adminEvents.targetUserId, techId));
  assert.equal(audit.length, 1); assert.equal(audit[0].eventType, "user_profile_updated"); assert.equal(audit[0].actorId, adminId);
  assert.deepEqual(JSON.parse(audit[0].detailsJson!).changes.email, { from: old.email, to: "profile-new@example.test" });
  assert.ok(!audit[0].detailsJson!.includes("password"));
  const loginAs = (identifier: string) => login(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: identifier, password }) }));
  for (const identifier of [old.email, old.username!]) assert.equal((await loginAs(identifier)).headers.get("set-cookie"), null);
  for (const identifier of ["PROFILE-NEW@EXAMPLE.TEST", "NEW.PROFILE"]) assert.ok((await loginAs(identifier)).headers.get("set-cookie"));
  assert.equal((await edit(req("PATCH", path, { displayName: "Stale edit", expectedProfile: old }), ctx(techId))).status, 409);
  const fresh = await snapshot();
  const simultaneous = await Promise.all([edit(req("PATCH", path, { displayName: "Concurrent name one", expectedProfile: fresh }), ctx(techId)), edit(req("PATCH", path, { displayName: "Concurrent name two", expectedProfile: fresh }), ctx(techId))]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 409]);
  const beforeClear = await snapshot();
  assert.equal((await edit(req("PATCH", path, { username: "", expectedProfile: beforeClear }), ctx(techId))).status, 200);
  assert.equal((await snapshot()).username, null); assert.equal((await loginAs("new.profile")).headers.get("set-cookie"), null); assert.ok((await loginAs(beforeClear.email)).headers.get("set-cookie"));
  const noOp = await snapshot();
  const beforeEvents = (await db.select().from(adminEvents).where(eq(adminEvents.targetUserId, techId))).length;
  assert.equal((await edit(req("PATCH", path, { ...noOp, expectedProfile: noOp }), ctx(techId))).status, 200);
  assert.equal((await db.select().from(adminEvents).where(eq(adminEvents.targetUserId, techId))).length, beforeEvents);

  const pending = await invite(req("POST", "/api/admin/users", { displayName: "Pending profile", email: "profile-pending@example.test", username: "profilepending", role: "technician" })); assert.equal(pending.status, 201);
  const invitation = await pending.json();
  const pendingPath = `/api/admin/users/${invitation.id}/profile`;
  const invitationToken = new URLSearchParams(new URL(invitation.invitation.url).hash.slice(1)).get("token")!;
  assert.equal((await edit(req("PATCH", pendingPath, { displayName: "Pending renamed", expectedProfile: await snapshot(invitation.id) }), ctx(invitation.id))).status, 200);
  assert.equal((await db.select().from(userInvitations).where(eq(userInvitations.tokenHash, tokenHash(invitationToken))))[0].revokedAt, null);
  const pendingEmail = await edit(req("PATCH", pendingPath, { email: "profile-pending-new@example.test", expectedProfile: await snapshot(invitation.id) }), ctx(invitation.id)); assert.equal(pendingEmail.status, 200);
  assert.equal((await pendingEmail.json()).invitationsRevoked, 1);
  assert.equal((await activate(req("POST", "/api/auth/activate", { token: invitationToken, password }))).status, 400, "links issued for the previous email are invalidated");
  assert.equal((await db.select().from(users).where(eq(users.id, invitation.id)))[0].activatedAt, null);
  await db.update(users).set({ disabled: 1 }).where(eq(users.id, otherId));
  assert.equal((await edit(req("PATCH", `/api/admin/users/${otherId}/profile`, { displayName: "Disabled renamed", expectedProfile: await snapshot(otherId) }), ctx(otherId))).status, 200);
  assert.equal((await db.select().from(users).where(eq(users.id, otherId)))[0].disabled, 1);
  assert.equal((await edit(req("PATCH", `/api/admin/users/${adminId}/profile`, { displayName: "Self-renamed admin", expectedProfile: await snapshot(adminId) }), ctx(adminId))).status, 200);
  assert.equal((await requireActor(req("GET", "/api/admin/users"))).role, "admin");
  const directoryResponse = await (await directory(req("GET", "/api/admin/users"))).json();
  assert.equal(directoryResponse.users.find((user: { id: string }) => user.id === techId).email, fresh.email);
  assert.equal(directoryResponse.users.find((user: { id: string }) => user.id === adminId).displayName, "Self-renamed admin");
}
