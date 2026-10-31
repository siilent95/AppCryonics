import nextEnv from "@next/env";
import { and, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import { getDb, getPool } from "../db";
import { pmRecords, sessions, users } from "../db/schema";
import { createSession, tokenHash } from "../lib/auth";
import { readCatalog } from "../lib/equipment/catalog";
import { getAnalytics } from "../lib/pm/analytics";
import { POST as create } from "../app/api/pm-records/route";
import { POST as sign } from "../app/api/pm-records/[id]/signature/route";
import { completeQaDraft, qaSigningInput } from "../tests/fixtures/pm";

nextEnv.loadEnvConfig(process.cwd(), true);
const url = new URL(process.env.DATABASE_URL!);
if (!process.argv.includes("--create-local-qa") || process.env.CRYOPM_LOCAL_MANAGED_POSTGRES !== "1" || url.hostname !== "127.0.0.1" || url.port !== "15433" || url.pathname !== "/cryopm" || process.env.APP_ORIGIN !== "http://localhost:3000") throw new Error("Only the managed local QA database is allowed. Pass --create-local-qa.");
let token: string | undefined;
try {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, process.env.CRYOPM_LOCAL_TEST_EMAIL!));
  if (!user || user.disabled) throw new Error("Local QA account unavailable.");
  const catalog = await readCatalog();
  token = await createSession(user.id);
  const request = (suffix: string, body: unknown) => new Request(`http://localhost:3000/api/pm-records${suffix}`, { method: "POST", headers: { cookie: `cryopm_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) });
  const plan = [
    { brandId: "mve", family: "HEco 800 Series", model: "815P-190", count: 3, completed: 2, code: "HECO815" },
    { brandId: "taylor", family: "K-Series", model: "24K", count: 2, completed: 1, code: "K24" },
    { brandId: "mve", family: "HE Series CryoVerse Connect", model: "815P-190", count: 1, completed: 1, code: "CRYOVERSE815" },
  ];
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const results: { id: string; recordNumber: string; family: string; model: string; serial: string; status: string }[] = [];
  for (const group of plan) {
    const model = catalog.models.find(item => item.brandId === group.brandId && item.family === group.family && item.model === group.model && item.active);
    const brand = catalog.brands.find(item => item.id === group.brandId);
    if (!model || !brand?.pmTemplate) throw new Error(`Active catalog selection missing: ${group.family} / ${group.model}`);
    for (let i = 1; i <= group.count; i++) {
      const serial = `QA-CATALOG-${group.code}-${String(i).padStart(3, "0")}`;
      const input = { ...completeQaDraft(brand.pmTemplate, date), catalogModelId: model.id, modelFamily: model.family, model: model.model, freezerSerial: serial, controllerType: model.controllers[0] || "QA controller", controllerSerial: `QA-CTRL-${group.code}-${i}`, labName: "QA Catalog Laboratory - synthetic", location: "Local catalog test bench - no real equipment" };
      const [existing] = await db.select().from(pmRecords).where(and(eq(pmRecords.ownerSubject, user.id), eq(pmRecords.freezerSerial, serial)));
      if (existing && (existing.clientOrganization !== input.clientOrganization || existing.equipmentBrandId !== brand.id || existing.modelFamily !== model.family || existing.model !== model.model || existing.deletedAt)) throw new Error(`Existing serial is not this synthetic catalog record: ${serial}`);
      let record = existing ? { id: existing.id, recordNumber: existing.recordNumber } : null;
      if (!record) {
        const response = await create(request("", input));
        if (response.status !== 201) throw new Error(`Catalog QA creation failed: ${await response.text()}`);
        record = (await response.json()).record;
      }
      const complete = i <= group.completed;
      if (complete && existing?.status !== "completed") {
        if (existing && (existing.status !== "draft" || existing.revision !== 1)) throw new Error(`QA record was changed; inspect before signing: ${serial}`);
        const response = await sign(request(`/${record!.id}/signature`, await qaSigningInput(1)), { params: Promise.resolve({ id: record!.id }) });
        if (response.status !== 200) throw new Error(`Catalog QA signing failed: ${await response.text()}`);
      }
      results.push({ id: record!.id, recordNumber: record!.recordNumber, family: model.family, model: model.model, serial, status: complete ? "completed" : existing?.status || "draft" });
    }
  }
  const stats = await getAnalytics(user.id, { days: 90, brand: "all", end: date });
  await mkdir("work", { recursive: true });
  await writeFile("work/catalog-qa-records.json", JSON.stringify({ synthetic: true, records: results, total: stats.total, topModels: stats.topModels }, null, 2));
  console.log(JSON.stringify({ synthetic: true, records: results, total: stats.total, topModels: stats.topModels }, null, 2));
} finally {
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  await getPool().end();
}
