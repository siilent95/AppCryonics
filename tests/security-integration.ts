import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { randomUUID, scryptSync } from "node:crypto";
import sharp from "sharp";
import { getDb } from "../db";
import { users } from "../db/schema";
import { createSession } from "../lib/auth";
import { hashPassword, passwordNeedsRehash } from "../lib/password";
import { GET as list, POST as create } from "../app/api/pm-records/route";
import { GET as detail, PUT as update, DELETE as remove } from "../app/api/pm-records/[id]/route";
import { GET as pdf } from "../app/api/pm-records/[id]/pdf/route";
import { GET as signature, POST as sign } from "../app/api/pm-records/[id]/signature/route";
import { GET as catalog } from "../app/api/equipment/route";
import { GET as asset } from "../app/api/equipment/models/[id]/assets/route";
import { GET as adminUsers } from "../app/api/admin/users/route";
import { GET as analytics } from "../app/api/pm-analytics/route";
import { GET as records } from "../app/api/pm-analytics/records/route";
import { GET as runtimeAsset } from "../app/api/pdfjs/[...asset]/route";
import { POST as activate } from "../app/api/auth/activate/route";
import { POST as login } from "../app/api/auth/login/route";
import { completeQaDraft, qaSigningInput } from "./fixtures/pm";

export async function testSecurityBoundaries() {
  const origin = "http://localhost:3000";
  const ids = [randomUUID(), randomUUID()];
  await getDb().insert(users).values(await Promise.all(ids.map(async (id, i) => ({ id, email: `security-${id}@example.test`, displayName: `Security QA ${i}`, passwordHash: await hashPassword("security-test-password") }))));
  const [owner, outsider] = await Promise.all(ids.map(createSession));
  const req = (method: string, url: string, body?: unknown, session?: string) => new Request(origin + url, { method, headers: { origin, "content-type": "application/json", ...(session ? { cookie: `cryopm_session=${session}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const ctx = { params: Promise.resolve({ id: "unavailable" }) };
  const anonymous: [string, () => Promise<Response>][] = [
    ["PM list", () => list(req("GET", "/api/pm-records"))],
    ["PM details", () => detail(req("GET", "/api/pm-records/unavailable"), ctx)],
    ["PM PDF", () => pdf(req("GET", "/api/pm-records/unavailable/pdf"), ctx)],
    ["PM signature", () => signature(req("GET", "/api/pm-records/unavailable/signature"), ctx)],
    ["Equipment", () => catalog(req("GET", "/api/equipment"))],
    ["Equipment file", () => asset(req("GET", "/api/equipment/models/unavailable/assets?kind=datasheet"), ctx)],
    ["User directory", () => adminUsers(req("GET", "/api/admin/users"))],
    ["Statistics", () => analytics(req("GET", "/api/pm-analytics"))],
    ["Statistics records", () => records(req("GET", "/api/pm-analytics/records"))],
  ];
  for (const [name, call] of anonymous) assert.equal((await call()).status, 401, name);
  assert.equal((await adminUsers(req("GET", "/api/admin/users", undefined, owner))).status, 403);
  const unauthenticatedBody = new Request(origin + "/api/pm-records", { method: "POST", headers: { origin }, body: "not JSON" });
  assert.equal((await create(unauthenticatedBody)).status, 401);
  assert.equal(unauthenticatedBody.bodyUsed, false, "Reject anonymous input before parsing it");
  const input = completeQaDraft("mve");
  const created = await create(req("POST", "/api/pm-records", input, owner));
  assert.equal(created.status, 201);
  const id = (await created.json()).record.id;
  const context = { params: Promise.resolve({ id }) };
  for (const call of [() => detail(req("GET", `/api/pm-records/${id}`, undefined, outsider), context), () => pdf(req("GET", `/api/pm-records/${id}/pdf`, undefined, outsider), context), () => signature(req("GET", `/api/pm-records/${id}/signature`, undefined, outsider), context), () => update(req("PUT", `/api/pm-records/${id}`, { ...input, expectedRevision: 1 }, outsider), context), () => remove(req("DELETE", `/api/pm-records/${id}`, { expectedRevision: 1 }, outsider), context)]) assert.equal((await call()).status, 404);
  assert.equal((await (await list(req("GET", "/api/pm-records", undefined, outsider))).json()).pagination.total, 0);
  const oversized = req("POST", "/api/pm-records", { ...input, padding: "a".repeat(193_000) }, owner);
  assert.equal((await create(oversized)).status, 413);
  const signing = await qaSigningInput(1);
  assert.equal((await sign(req("POST", `/api/pm-records/${id}/signature`, { ...signing, recipientSignatureDataUrl: "data:image/png;base64,====" }, owner), context)).status, 400);
  const invalidPng = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(120)]).toString("base64");
  assert.equal((await sign(req("POST", `/api/pm-records/${id}/signature`, { ...signing, recipientSignatureDataUrl: `data:image/png;base64,${invalidPng}` }, owner), context)).status, 400);
  const bomb = await sharp({ create: { width: 1500, height: 1500, channels: 3, background: "white" } }).png().toBuffer();
  assert.equal((await sign(req("POST", `/api/pm-records/${id}/signature`, { ...signing, recipientSignatureDataUrl: `data:image/png;base64,${bomb.toString("base64")}` }, owner), context)).status, 400);
  assert.equal((await (await detail(req("GET", `/api/pm-records/${id}`, undefined, owner), context)).json()).record.status, "draft");
  const forged = req("PUT", `/api/pm-records/${id}`, { ...input, expectedRevision: 1 }, owner); forged.headers.set("origin", "https://outside.example");
  assert.equal((await update(forged, context)).status, 401);
  for (const path of [["..", "..", ".env.local"], ["build", "..", "..", "package.json"], ["cmaps", "..", "..", "db", "schema.ts"]]) assert.equal((await runtimeAsset(req("GET", "/api/pdfjs/test"), { params: Promise.resolve({ asset: path }) })).status, 404);
  assert.equal((await activate(req("POST", "/api/auth/activate", { token: "f".repeat(64), password: "security-test-password" }))).status, 400);
  const hugeForm = new Request(origin + "/api/auth/login", { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" }, body: "email=" + "a".repeat(5000) });
  assert.equal((await login(hugeForm)).status, 413);
  const legacyId = randomUUID(); const salt = "ab".repeat(16); const password = "legacy-security-password";
  const legacyHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  await getDb().insert(users).values({ id: legacyId, email: `legacy-${legacyId}@example.test`, displayName: "Legacy security QA", passwordHash: legacyHash });
  const legacyLogin = await login(new Request(origin + "/api/auth/login", { method: "POST", headers: { origin }, body: new URLSearchParams({ email: `legacy-${legacyId}@example.test`, password }) }));
  assert.equal(legacyLogin.status, 303);
  assert.ok(legacyLogin.headers.get("set-cookie"));
  const [upgraded] = await getDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, legacyId));
  assert.equal(passwordNeedsRehash(upgraded.hash), false, "Successful sign-in upgrades the hash without changing the password");
}
