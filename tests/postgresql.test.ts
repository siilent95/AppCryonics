import { testOfflineSync } from "./offline-sync-integration";
import { testSecurityBoundaries } from "./security-integration";
import { testEquipmentCatalog } from "./equipment-integration";
import { testTopEquipment } from "./top-equipment-integration";
import { testUserProfiles } from "./user-profile-integration";
import { testTrashRetention } from "./trash-retention-integration";
import { testReportsManagement } from "./reports-management-integration";
import { testCorrections } from "./corrections-integration";
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
import { users, pmRecords, pmEvents, sessions, userInvitations } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { createSession, requireActorSubject, tokenHash } from "../lib/auth";
import { GET as analytics } from "../app/api/pm-analytics/route";
import { GET as analyticsRecords } from "../app/api/pm-analytics/records/route";
import { GET as adminUsers, POST as inviteUser } from "../app/api/admin/users/route";
import { PATCH as updateUser } from "../app/api/admin/users/[id]/route";
import { POST as issueUserInvitation } from "../app/api/admin/users/[id]/invitation/route";
import { POST as activate } from "../app/api/auth/activate/route";
import { POST as assignPm } from "../app/api/pm-records/[id]/assignment/route";
import { POST as login } from "../app/api/auth/login/route";
import { GET as exportPdf } from "../app/api/pm-records/[id]/pdf/route";
import { PDFParse } from "pdf-parse";
import { completeQaDraft, qaSigningInput } from "./fixtures/pm";
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
    await t.test("direct PDF downloads preserve complete brand-specific reports and enforce ownership", async () => {
      for (const brand of ["mve", "taylor"] as const) {
        const input = completeQaDraft(brand);
        if (brand === "mve") input.payload.notes.general = "Long QA observation: inspección sintética, Ω and °C. ".repeat(300) + "END-OF-LONG-QA-NOTE";
        const created = await create(request("POST", "", input));
        const recordId = (await created.json()).record.id;
        const context = { params: Promise.resolve({ id: recordId }) };
        assert.equal((await exportPdf(request("GET", `/${recordId}/pdf`), context)).status, 409);
        assert.equal((await exportPdf(request("GET", `/${recordId}/pdf`, undefined, otherToken), context)).status, 404);
        assert.equal((await exportPdf(new Request("http://localhost:3000/api/pm-records/x/pdf"), context)).status, 401);
        const signed = await sign(request("POST", `/${recordId}/signature`, await qaSigningInput(1)), context);
        assert.equal(signed.status, 200, await signed.clone().text());
        const exported = await exportPdf(request("GET", `/${recordId}/pdf`), context);
        assert.equal(exported.status, 200, await exported.clone().text().then(t => t.slice(0, 100)));
        assert.equal(exported.headers.get("content-type"), "application/pdf");
        assert.equal(exported.headers.get("cache-control"), "no-store, private");
        assert.match(exported.headers.get("content-disposition")!, /^attachment; filename="PM-[A-Z0-9]+-(mve|taylor)\.pdf"$/);
        const bytes = Buffer.from(await exported.arrayBuffer());
        assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
        assert.ok((bytes.toString("latin1").match(/\/Subtype \/Image/g) || []).length >= 4, "logo, equipment and both signature marks are embedded");
        const parser = new PDFParse({ data: bytes });
        try {
          const result = await parser.getText();
          assert.ok(result.total >= 6);
          assert.ok(result.total <= (brand === "mve" ? 14 : 7), `Unexpected page count: ${result.total}`);
          for (const label of ["Equipment identification", "01 / Construction", "02 / Operation", "03 / Verification", "04 / Examination", "05 / Service closure", input.freezerSerial, input.controllerSerial, "QA Technician - synthetic", "Maximum Fill Time", "Event Log Interval", "0.20 in", "-170 °C", "Signature retention date"]) assert.ok(result.text.includes(label), label);
          assert.ok(result.text.includes(brand === "mve" ? "1050 Ω" : "6.8 Ω"));
          if (brand === "mve") { assert.ok(result.text.includes("140 Ω")); assert.ok(result.text.replace(/\s+/g, "").includes("END-OF-LONG-QA-NOTE")); }
          else assert.ok(!result.text.includes("Single valve resistance"));
        } finally { await parser.destroy(); }
        await db.update(pmRecords).set({ technicianSignatureRetentionUntil: "2000-01-01T00:00:00.000Z", recipientSignatureRetentionUntil: "2000-01-01T00:00:00.000Z" }).where(eq(pmRecords.id, recordId));
        const expired = await exportPdf(request("GET", `/${recordId}/pdf`), context);
        const expiredParser = new PDFParse({ data: new Uint8Array(await expired.arrayBuffer()) });
        try { assert.ok((await expiredParser.getText()).text.includes("Signature no longer available")); } finally { await expiredParser.destroy(); }
      }
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
        assert.equal((await pool.query("SELECT created_by FROM pm_records")).rows[0].created_by, "import-user");
        assert.deepEqual((await pool.query("SELECT data FROM pm_signatures")).rows[0].data, signatureBytes);
        const next = await pool.query("INSERT INTO pm_events(record_id, event_type, revision) VALUES ('imported', 'draft_saved', 2) RETURNING id");
        assert.equal(next.rows[0].id, 2);
        await assert.rejects(runImport(true));
      } finally { await pool.end(); }
    });
    await t.test("analytics counts full history and drills into account-scoped cohorts", async () => {
      const rows = Array.from({ length: 75 }, (_, i) => ({
        id: `analytics-${i}`, recordNumber: `PM-ANALYTICS-${i}`, ownerSubject: "technician-a",
        brand: (i % 2 ? "taylor" : "mve") as "mve" | "taylor", modelFamily: "HE", model: "800",
        performedOn: "2026-08-15", freezerSerial: `SERIAL-${i % 10}`, labName: `Lab ${i % 3}`,
        status: (i < 50 ? "completed" : "draft") as "completed" | "draft", currentStep: i >= 50 && i < 60 ? "review" : "construction",
        payloadJson: JSON.stringify({ notes: { construction: i % 2 === 0 ? "A note" : "", operation: i % 3 === 0 ? "A note" : "", verification: " \n\t ", examination: 7 } }),
      }));
      await db.insert(pmRecords).values(rows);
      for (const [suffix, count, values] of [
        ["previous", 5, { performedOn: "2026-07-20" }], ["other", 4, { ownerSubject: "technician-b" }],
        ["archived", 2, { status: "archived" }], ["deleted", 3, { deletedAt: new Date().toISOString() }],
        ["undated", 1, { performedOn: null }], ["invalid", 1, { performedOn: "2026-02-30", payloadJson: "invalid legacy JSON" }],
      ] as const) {
        await db.insert(pmRecords).values(Array.from({ length: count }, (_, i) => ({ ...rows[0], id: `${suffix}-${i}`, recordNumber: `PM-${suffix}-${i}`, ...values })));
      }
      await db.update(pmRecords).set({ freezerSerial: " serial-0 " }).where(eq(pmRecords.id, "analytics-0"));
      await db.update(pmRecords).set({ freezerSerial: null }).where(eq(pmRecords.id, "analytics-74"));
      await db.update(pmRecords).set({ payloadJson: JSON.stringify({ notes: { general: "\u0000" } }) }).where(eq(pmRecords.id, "analytics-1"));
      await db.update(pmRecords).set({ status: "ready_for_signature", currentStep: "construction" }).where(eq(pmRecords.id, "analytics-59"));
      const req = (extra = "", session = token) => {
        const params = new URLSearchParams("days=30&end=2026-08-31");
        new URLSearchParams(extra.replace(/^&/, "")).forEach((value, key) => params.set(key, value));
        return new Request(`http://localhost:3000/api/pm-analytics?${params}`, { headers: { cookie: `cryopm_session=${session}` } });
      };
      const response = await analytics(req());
      assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
      assert.equal(response.headers.get("cache-control"), "no-store, private");
      const data = await response.json();
      assert.equal(data.total, 75); assert.equal(data.previousTotal, 5);
      assert.equal(data.completed, 50); assert.equal(data.review, 10); assert.equal(data.draft, 15);
      assert.equal(data.equipment, 10); assert.equal(data.missingSerial, 1); assert.equal(data.undated, 2);
      assert.deepEqual(data.daily, [{ date: "2026-08-15", completed: 50, open: 25 }]);
      assert.deepEqual(data.sections.map((s: { count: number }) => s.count), [38, 25, 0, 0]);
      assert.equal((await (await analytics(req("&brand=mve"))).json()).total, 38);
      assert.equal((await (await analytics(req("", otherToken))).json()).total, 4);
      const page = await (await analyticsRecords(req("&kind=state&value=completed"))).json();
      const second = await (await analyticsRecords(req("&kind=state&value=completed&page=2"))).json();
      assert.equal((await (await analyticsRecords(req("", otherToken))).json()).total, 4);
      assert.equal(page.total, 50); assert.equal(page.records.length, 25); assert.equal(second.records.length, 25);
      assert.equal(new Set([...page.records, ...second.records].map(r => r.id)).size, 50);
      assert.equal(page.records[0].payloadJson, undefined); assert.equal(page.records[0].ownerSubject, undefined);
      for (const [extra, total] of [["&kind=section&value=construction", 38], ["&kind=lab&value=Lab%200", 25], ["&kind=equipment&value=mve%3ASERIAL-0", 8], ["&kind=period&from=2026-08-15&to=2026-08-15", 75]] as const) {
        assert.equal((await (await analyticsRecords(req(extra))).json()).total, total);
      }
      for (const extra of ["&kind=state&value=bad", "&page=0", "&kind=period&from=2026-07-01&to=2026-08-15", "&kind=section&value=general"]) assert.equal((await analyticsRecords(req(extra))).status, 400);
      assert.equal((await analytics(req("&end=2026-02-30"))).status, 400);
      assert.equal((await analytics(req("&days=365"))).status, 400);
      assert.equal((await analytics(new Request("http://localhost:3000/api/pm-analytics"))).status, 401);
      assert.equal((await analyticsRecords(new Request("http://localhost:3000/api/pm-analytics/records"))).status, 401);
    });
    await t.test("admin sees all PMs; reassignment keeps creator read access and assigned-only writes", async () => {
      await db.insert(users).values([
        { id: "admin-a", email: "admin@example.test", username: "qaadmin", displayName: "QA Admin", role: "admin", passwordHash: await hashPassword("admin-test-password") },
        { id: "technician-c", email: "c@example.test", displayName: "C", passwordHash: await hashPassword("third-test-password") },
      ]);
      const admin = await createSession("admin-a"); const outsider = await createSession("technician-c");
      const created = await create(request("POST", "", { ...completeQaDraft("mve"), ownerSubject: "technician-b", createdBy: "admin-a", role: "admin" }));
      const recordId = (await created.json()).record.id;
      const context = { params: Promise.resolve({ id: recordId }) };
      const original = (await (await detail(request("GET", `/${recordId}`), context)).json()).record;
      assert.equal(original.createdBy, "technician-a"); assert.equal(original.assignedTechnicianId, "technician-a");
      assert.equal((await detail(request("GET", `/${recordId}`, undefined, admin), context)).status, 200);
      assert.equal((await detail(request("GET", `/${recordId}`, undefined, otherToken), context)).status, 404);
      const assignment = { technicianId: "technician-b", expectedRevision: 1 };
      assert.equal((await assignPm(request("POST", `/${recordId}/assignment`, assignment), context)).status, 403);
      assert.equal((await assignPm(request("POST", `/${recordId}/assignment`, { ...assignment, technicianId: "admin-a" }, admin), context)).status, 400);
      assert.equal((await assignPm(request("POST", `/${recordId}/assignment`, { ...assignment, expectedRevision: 99 }, admin), context)).status, 409);
      assert.equal((await assignPm(request("POST", `/${recordId}/assignment`, assignment, admin), context)).status, 200);
      const creatorView = (await (await detail(request("GET", `/${recordId}`), context)).json()).record;
      const assigneeView = (await (await detail(request("GET", `/${recordId}`, undefined, otherToken), context)).json()).record;
      assert.equal(creatorView.canEdit, false); assert.equal(assigneeView.canEdit, true); assert.equal(creatorView.createdBy, "technician-a"); assert.equal(creatorView.revision, 2);
      assert.equal((await detail(request("GET", `/${recordId}`, undefined, outsider), context)).status, 404);
      assert.equal((await update(request("PUT", `/${recordId}`, { ...completeQaDraft("mve"), expectedRevision: 2 }), context)).status, 404);
      assert.equal((await update(request("PUT", `/${recordId}`, { ...completeQaDraft("mve"), expectedRevision: 2 }, otherToken), context)).status, 200);
      assert.equal((await sign(request("POST", `/${recordId}/signature`, await qaSigningInput(3)), context)).status, 404);
      assert.equal((await sign(request("POST", `/${recordId}/signature`, await qaSigningInput(3), otherToken), context)).status, 200);
      const before = (await (await detail(request("GET", `/${recordId}`, undefined, admin), context)).json()).record;
      assert.equal(before.revision, 4);
      assert.equal((await assignPm(request("POST", `/${recordId}/assignment`, { technicianId: "technician-c", expectedRevision: 4 }, admin), context)).status, 200);
      const after = (await (await detail(request("GET", `/${recordId}`, undefined, admin), context)).json()).record;
      assert.equal(after.revision, before.revision); assert.deepEqual(after.payload, before.payload); assert.equal(after.technicianName, before.technicianName); assert.equal(after.technicianSignatureCapturedAt, before.technicianSignatureCapturedAt);
      assert.equal((await detail(request("GET", `/${recordId}`, undefined, otherToken), context)).status, 404, "previous assignee is not the creator");
      for (const session of [token, outsider, admin]) {
        assert.equal((await exportPdf(request("GET", `/${recordId}/pdf`, undefined, session), context)).status, 200);
        assert.equal((await signature(request("GET", `/${recordId}/signature?role=technician`, undefined, session), context)).status, 200);
      }
      const rows = await db.select().from(pmEvents).where(eq(pmEvents.recordId, recordId));
      assert.equal(rows.filter(e => e.eventType === "assigned").length, 2);
      const adminStatsRequest = new Request("http://localhost:3000/api/pm-analytics?days=30&end=2026-08-31", { headers: { cookie: `cryopm_session=${admin}` } });
      const global = await (await analytics(adminStatsRequest)).json();
      assert.equal(global.total, 79);
      const globalDrill = await (await analyticsRecords(new Request(adminStatsRequest.url + "&kind=all", { headers: adminStatsRequest.headers }))).json();
      assert.equal(globalDrill.total, 79);
      assert.equal((await adminUsers(request("GET"))).status, 403);
      const directory = await (await adminUsers(request("GET", "", undefined, admin))).json();
      assert.ok(directory.users.some((u: { id: string }) => u.id === "admin-a"));
      assert.equal(directory.users[0].passwordHash, undefined);
    });
    await t.test("invitations activate once, expire, rotate and revoke sessions on reset or disable", async () => {
      const admin = await createSession("admin-a");
      const api = (method: string, url: string, body?: unknown, session = admin) => new Request("http://localhost:3000" + url, { method, headers: { cookie: `cryopm_session=${session}`, origin: process.env.APP_ORIGIN!, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const creation = { email: "invited@example.test", username: "newtech", displayName: "New technician", role: "technician" };
      assert.equal((await inviteUser(api("POST", "/api/admin/users", creation, token))).status, 403);
      const invited = await inviteUser(api("POST", "/api/admin/users", creation)); assert.equal(invited.status, 201);
      const result = await invited.json(); const context = { params: Promise.resolve({ id: result.id }) };
      const firstToken = new URLSearchParams(new URL(result.invitation.url).hash.slice(1)).get("token")!;
      assert.equal((await db.select().from(userInvitations).where(eq(userInvitations.userId, result.id)))[0].tokenHash, tokenHash(firstToken));
      const pendingSession = await createSession(result.id);
      assert.equal((await list(api("GET", "/api/pm-records", undefined, pendingSession))).status, 401);
      const reissued = await (await issueUserInvitation(api("POST", `/api/admin/users/${result.id}/invitation`, { purpose: "activation" }), context)).json();
      assert.equal((await activate(api("POST", "/api/auth/activate", { token: firstToken, password: "new-technician-password" }))).status, 400);
      const secondToken = new URLSearchParams(new URL(reissued.invitation.url).hash.slice(1)).get("token")!;
      const activations = await Promise.all([activate(api("POST", "/api/auth/activate", { token: secondToken, password: "new-technician-password" })), activate(api("POST", "/api/auth/activate", { token: secondToken, password: "new-technician-password" }))]);
      assert.deepEqual(activations.map(r => r.status).sort(), [200, 400]);
      const loginAs = (username: string, password: string) => login(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin: process.env.APP_ORIGIN!, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email: username, password }) }));
      const loggedIn = await loginAs("NEWTECH", "new-technician-password");
      assert.equal(loggedIn.status, 303); assert.ok(loggedIn.headers.get("set-cookie"));
      const session = loggedIn.headers.get("set-cookie")!.match(/cryopm_session=([^;]+)/)![1];
      assert.equal((await list(api("GET", "/api/pm-records", undefined, session))).status, 200);
      const reset = await issueUserInvitation(api("POST", `/api/admin/users/${result.id}/invitation`, { purpose: "reset" }), context);
      assert.equal(reset.status, 200); assert.equal((await list(api("GET", "/api/pm-records", undefined, session))).status, 401);
      assert.equal((await loginAs("newtech", "new-technician-password")).headers.get("set-cookie"), null);
      const resetToken = new URLSearchParams(new URL((await reset.json()).invitation.url).hash.slice(1)).get("token")!;
      await db.update(userInvitations).set({ expiresAt: "2000-01-01T00:00:00.000Z" }).where(eq(userInvitations.tokenHash, tokenHash(resetToken)));
      assert.equal((await activate(api("POST", "/api/auth/activate", { token: resetToken, password: "replacement-password" }))).status, 400);
      const fresh = await (await issueUserInvitation(api("POST", `/api/admin/users/${result.id}/invitation`, { purpose: "reset" }), context)).json();
      const freshToken = new URLSearchParams(new URL(fresh.invitation.url).hash.slice(1)).get("token")!;
      assert.equal((await activate(api("POST", "/api/auth/activate", { token: freshToken, password: "replacement-password" }))).status, 200);
      const newSession = await createSession(result.id);
      assert.equal((await updateUser(api("PATCH", `/api/admin/users/${result.id}`, { disabled: true }), context)).status, 200);
      assert.equal((await list(api("GET", "/api/pm-records", undefined, newSession))).status, 401);
      assert.equal((await issueUserInvitation(api("POST", `/api/admin/users/${result.id}/invitation`, { purpose: "reset" }), context)).status, 404);
      const adminContext = { params: Promise.resolve({ id: "admin-a" }) };
      assert.equal((await updateUser(api("PATCH", "/api/admin/users/admin-a", { disabled: true }), adminContext)).status, 409);
      assert.equal((await updateUser(api("PATCH", "/api/admin/users/admin-a", { disabled: false, role: "technician" }), adminContext)).status, 409);
      assert.equal((await issueUserInvitation(api("POST", "/api/admin/users/admin-a/invitation", { purpose: "reset" }), adminContext)).status, 409);
      await db.insert(users).values({ id: "admin-b", email: "admin-b@example.test", displayName: "Other admin", role: "admin", passwordHash: await hashPassword("second-admin-password") });
      const secondAdmin = await createSession("admin-b");
      const changes = await Promise.all([updateUser(api("PATCH", "/api/admin/users/admin-a", { disabled: false, role: "technician" }), adminContext), updateUser(api("PATCH", "/api/admin/users/admin-b", { disabled: false, role: "technician" }, secondAdmin), { params: Promise.resolve({ id: "admin-b" }) })]);
      assert.deepEqual(changes.map(r => r.status).sort(), [200, 409]);
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
        const loginPage = await fetch(`${origin}/login`);
        const policy = loginPage.headers.get("content-security-policy")!;
        assert.ok(policy, "CSP is present on login");
        assert.match(policy, /frame-ancestors 'none'/);
        assert.ok(!policy.includes("'unsafe-eval'"));
        const nonce = /'nonce-([^']+)'/.exec(policy)![1];
        const loginHtml = await loginPage.text();
        const scriptTags = loginHtml.match(/<script\b[^>]*>/g) || [];
        assert.ok(scriptTags.length > 0 && scriptTags.every(tag => tag.includes(`nonce="${nonce}"`)), "SSR scripts carry the request nonce");
        const secondPolicy = (await fetch(`${origin}/login`)).headers.get("content-security-policy");
        assert.notEqual(secondPolicy, policy, "Nonces are unique per request");
        assert.equal(loginPage.headers.get("x-frame-options"), "DENY");
        assert.equal(loginPage.headers.get("referrer-policy"), "same-origin");
        assert.match(loginPage.headers.get("cache-control")!, /no-store/);
        assert.equal((await fetch(`${origin}/design-study/index.html`)).status, 404);
        const anonymousPdf = await fetch(`${origin}/api/pm-records/unavailable/pdf`);
        assert.equal(anonymousPdf.status, 401);
        assert.match(anonymousPdf.headers.get("cache-control")!, /no-store/);
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
    await t.test("offline idempotency, concurrent revisions, provisional captures, rollback and account isolation", testOfflineSync);
    await t.test("security boundaries reject anonymous access, cross-account access, oversized input and invalid files", testSecurityBoundaries);
    await t.test("equipment catalog, uploads and manufacturer/template snapshots", testEquipmentCatalog);
    await t.test("top three equipment models preserve family identity, filters and access", testTopEquipment);
    await t.test("admin draft edits and signed corrections preserve history, signatures and statistics", testCorrections);
    await t.test("reports paginate, search all records and delete/restore complete version histories with access checks", testReportsManagement);
    await t.test("Trash expires after 25 days and safely purges complete chains, signatures and events", testTrashRetention);
    await t.test("admins edit user profiles with validation, audit, stable PM ownership and concurrent conflict checks", testUserProfiles);
  } finally {
    if ((globalThis as unknown as { cryoPool?: unknown }).cryoPool) await getPool().end();
    await postgres.stop();
  }
});
