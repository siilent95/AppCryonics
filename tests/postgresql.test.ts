import assert from "node:assert/strict";
import test from "node:test";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import sharp from "sharp";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "../db";
import { users, pmRecords, pmEvents, sessions } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSession, requireActorSubject, tokenHash } from "../lib/auth";
import { GET as list, POST as create } from "../app/api/pm-records/route";
import { GET as detail, PUT as update } from "../app/api/pm-records/[id]/route";
import { GET as signature, POST as sign } from "../app/api/pm-records/[id]/signature/route";
import { purgeExpiredSignatures } from "../app/api/pm-records/_retention";
import { getSignatureBucket } from "../app/api/pm-records/_signature-storage";

test("password hashing rejects incorrect and oversized passwords", async () => {
  const hash = await hashPassword("a-secure-test-password");
  assert.equal(await verifyPassword("a-secure-test-password", hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.equal(await verifyPassword("a".repeat(257), hash), false);
  await assert.rejects(hashPassword("short"));
});

test("PostgreSQL migration, sessions, ownership, revisions, signatures and retention", { timeout: 120000 }, async t => {
  const directory = await mkdtemp(path.resolve("work/test-postgres-"));
  const port = 15432;
  const password = randomBytes(16).toString("hex");
  const postgres = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password, persistent: true, postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: () => {} });
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
  try {
    await postgres.initialise();
    await postgres.start();
    await migrate(getDb(), { migrationsFolder: "./drizzle" });
    await migrate(getDb(), { migrationsFolder: "./drizzle" });
    const db = getDb();
    await db.insert(users).values([
      { id: "technician-a", email: "a@example.test", displayName: "A", passwordHash: await hashPassword("first-test-password") },
      { id: "technician-b", email: "b@example.test", displayName: "B", passwordHash: await hashPassword("second-test-password") },
    ]);
    const token = await createSession("technician-a");
    const otherToken = await createSession("technician-b");
    const request = (method: string, suffix = "", body?: unknown, session = token) => new Request(`http://localhost:3000/api/pm-records${suffix}`, {
      method, headers: { cookie: `cryopm_session=${session}`, origin: process.env.APP_ORIGIN!, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const draft = { brand: "mve", modelFamily: "HE", model: "800", currentStep: "examination", performedOn: "2026-10-03", clientOrganization: "Test client", payload: { examination: { lowTemperature: "-190", highTemperature: "-180", lowLevelAlarm: "1", highLevelAlarm: "5", lowLevelSetPoint: "2", highLevelSetPoint: "4" } } };
    let id: string;
    await t.test("server-side identity ignores forged Sites headers and rejects expired sessions", async () => {
      const forged = new Request("http://localhost:3000/api/pm-records", { headers: { "oai-authenticated-user-id": "forged", "oai-authenticated-user-email": "a@example.test" } });
      assert.equal((await list(forged)).status, 401);
      const expired = await createSession("technician-a");
      await db.update(sessions).set({ expiresAt: "2000-01-01T00:00:00.000Z" }).where(eq(sessions.tokenHash, tokenHash(expired)));
      await assert.rejects(requireActorSubject(request("GET", "", undefined, expired)));
      const badOrigin = request("POST", "", draft);
      badOrigin.headers.set("origin", "https://other.test");
      assert.equal((await create(badOrigin)).status, 401);
    });
    await t.test("draft CRUD preserves audit history and isolates accounts", async () => {
      const response = await create(request("POST", "", draft));
      assert.equal(response.status, 201);
      id = (await response.json()).record.id;
      assert.equal((await (await list(request("GET", "", undefined, otherToken))).json()).records.length, 0);
      const context = { params: Promise.resolve({ id }) };
      assert.equal((await detail(request("GET", `/${id}`, undefined, otherToken), context)).status, 404);
      assert.equal((await update(request("PUT", `/${id}`, { ...draft, expectedRevision: 1 }), context)).status, 200);
      assert.equal((await update(request("PUT", `/${id}`, { ...draft, expectedRevision: 1 }), context)).status, 409);
      const result = await (await detail(request("GET", `/${id}`), context)).json();
      assert.equal(result.record.revision, 2);
      assert.equal(result.events.length, 2);
      assert.equal(result.record.ownerSubject, undefined);
      assert.match(result.record.createdAt, /^\d{4}-\d\d-\d\dT/);
    });
    await t.test("both PNG signatures persist in PostgreSQL and signed PM is immutable", async () => {
      const imageBytes = await sharp({ create: { width: 240, height: 80, channels: 4, background: { r: 20, g: 40, b: 60, alpha: 1 } } }).png().toBuffer();
      const png = "data:image/png;base64," + imageBytes.toString("base64");
      const context = { params: Promise.resolve({ id }) };
      const response = await sign(request("POST", `/${id}/signature`, { expectedRevision: 2, technicianName: "Test technician", recipientAccepted: true, recipientAcceptanceVersion: "PM_RECEIPT_V1", technicianResponsible: true, technicianAcceptanceVersion: "PM_TECHNICIAN_RESPONSIBILITY_V1", recipientSignatureDataUrl: png, technicianSignatureDataUrl: png }), context);
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      const image = await signature(request("GET", `/${id}/signature?role=technician`), context);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get("content-type"), "image/png");
      assert.equal(Buffer.from(await image.arrayBuffer()).toString("base64"), png.split(",")[1]);
      assert.equal((await update(request("PUT", `/${id}`, { ...draft, expectedRevision: 3 }), context)).status, 409);
      assert.equal((await signature(request("GET", `/${id}/signature`, undefined, otherToken), context)).status, 404);
    });
    await t.test("expired signatures are deleted with an audit event", async () => {
      const [record] = await db.select().from(pmRecords).where(eq(pmRecords.id, id));
      await db.update(pmRecords).set({ recipientSignatureRetentionUntil: "2000-01-01T00:00:00.000Z", technicianSignatureRetentionUntil: "2000-01-01T00:00:00.000Z" }).where(eq(pmRecords.id, id));
      assert.equal(await purgeExpiredSignatures(), 1);
      assert.equal(await getSignatureBucket().get(record.recipientSignatureKey!), null);
      assert.equal(await getSignatureBucket().get(record.technicianSignatureKey!), null);
      const events = await db.select().from(pmEvents).where(eq(pmEvents.recordId, id));
      assert.equal(events.at(-1)?.eventType, "signature_deleted");
    });
    await t.test("SQLite import dry run, owner mapping and signature checksum rollback", async () => {
      await postgres.createDatabase("cryopm_import_test");
      const targetUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/cryopm_import_test`;
      const pool = new Pool({ connectionString: targetUrl });
      const exportDir = path.join(directory, "export");
      await mkdir(exportDir);
      const sqliteFile = path.join(exportDir, "backup.sqlite");
      const sqlite = new DatabaseSync(sqliteFile);
      for (const file of ["0000_initial_pm_backend.sql", "0001_signature_privacy.sql", "0002_technician_signature.sql", "0003_pm_parties.sql"]) {
        sqlite.exec(await readFile(path.join("legacy-sqlite", file), "utf8"));
      }
      sqlite.prepare("INSERT INTO pm_records (id, record_number, brand, model_family, model, payload_json, owner_subject) VALUES (?, ?, ?, ?, ?, ?, ?)").run("imported", "PM-IMPORT", "mve", "HE", "800", "{}", "legacy-owner");
      sqlite.prepare("INSERT INTO pm_events (record_id, event_type, actor_subject, revision) VALUES (?, ?, ?, ?)").run("imported", "created", "legacy-owner", 1);
      const signatureBytes = await sharp({ create: { width: 240, height: 80, channels: 4, background: "#204060" } }).png().toBuffer();
      const signatureKey = "signature.png";
      await writeFile(path.join(exportDir, signatureKey), signatureBytes);
      sqlite.prepare("UPDATE pm_records SET recipient_signature_key=?, recipient_signature_sha256=?, recipient_signature_mime_type=? WHERE id='imported'").run(signatureKey, createHash("sha256").update(signatureBytes).digest("hex"), "image/png");
      sqlite.close();
      const mapFile = path.join(exportDir, "owners.json");
      await writeFile(mapFile, JSON.stringify({ "legacy-owner": "import-user" }));
      try {
        await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
        await pool.query("INSERT INTO users (id, email, display_name, password_hash) VALUES ($1, $2, $3, $4)", ["import-user", "import@example.test", "Import", await hashPassword("import-test-password")]);
        const runImport = (apply = false) => promisify(execFile)(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/import-sqlite.ts", "--source", sqliteFile, "--owners", mapFile, "--signatures", exportDir, ...(apply ? ["--apply"] : [])], { env: { ...process.env, DATABASE_URL: targetUrl }, windowsHide: true });
        assert.match((await runImport()).stdout, /Dry run passed/);
        assert.equal(Number((await pool.query("SELECT count(*) FROM pm_records")).rows[0].count), 0);
        await writeFile(path.join(exportDir, signatureKey), Buffer.from("corrupt-export"));
        await assert.rejects(runImport(true));
        assert.equal(Number((await pool.query("SELECT count(*) FROM pm_signatures")).rows[0].count), 0);
        await writeFile(path.join(exportDir, signatureKey), signatureBytes);
        await writeFile(mapFile, "{}");
        await assert.rejects(runImport(true));
        assert.equal(Number((await pool.query("SELECT count(*) FROM pm_records")).rows[0].count), 0);
        await writeFile(mapFile, JSON.stringify({ "legacy-owner": "import-user" }));
        await runImport(true);
        assert.equal((await pool.query("SELECT owner_subject, created_at FROM pm_records")).rows[0].owner_subject, "import-user");
        assert.deepEqual((await pool.query("SELECT data FROM pm_signatures")).rows[0].data, signatureBytes);
        const next = await pool.query("INSERT INTO pm_events(record_id, event_type, revision) VALUES ('imported', 'draft_saved', 2) RETURNING id");
        assert.equal(next.rows[0].id, 2);
        await assert.rejects(runImport(true));
      } finally { await pool.end(); }
    });
    if (process.env.RUN_HTTP_TESTS === "1") await t.test("production HTTP login, access control and logout", async () => {
      const origin = "http://localhost:3100";
      let logs = "";
      const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100", "-H", "127.0.0.1"], { env: { ...process.env, APP_ORIGIN: origin, NODE_ENV: "production" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", data => { logs += data; });
      server.stderr.on("data", data => { logs += data; });
      const exited = once(server, "exit");
      try {
        let ready = false;
        for (let i = 0; i < 100; i++) {
          try { if ((await fetch(`${origin}/login`)).status === 200) { ready = true; break; } } catch {}
          if (server.exitCode !== null) break;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.equal(ready, true, logs);
        const anonymous = await fetch(origin, { redirect: "manual" });
        assert.equal(anonymous.status, 307);
        assert.match(anonymous.headers.get("location")!, /login/);
        const form = new URLSearchParams({ email: "a@example.test", password: "first-test-password" });
        assert.equal((await fetch(`${origin}/api/auth/login`, { method: "POST", body: form, headers: { origin: "https://forged.test" } })).status, 403);
        const login = await fetch(`${origin}/api/auth/login`, { method: "POST", body: form, headers: { origin }, redirect: "manual" });
        assert.equal(login.status, 303, logs);
        const cookie = login.headers.get("set-cookie")!;
        assert.match(cookie, /HttpOnly/i);
        const cookieHeader = cookie.split(";")[0];
        const page = await fetch(origin, { headers: { cookie: cookieHeader } });
        assert.equal(page.status, 200, logs);
        assert.match(await page.text(), /CryoPM/);
        assert.equal((await fetch(`${origin}/api/pm-records`, { headers: { cookie: cookieHeader } })).status, 200);
        assert.equal((await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { origin, cookie: cookieHeader }, redirect: "manual" })).status, 303);
        assert.equal((await fetch(`${origin}/api/pm-records`, { headers: { cookie: cookieHeader } })).status, 401);
      } finally { server.kill(); await exited; }
    });
  } finally {
    if ((globalThis as unknown as { cryoPool?: unknown }).cryoPool) await getPool().end();
    await postgres.stop();
  }
});
