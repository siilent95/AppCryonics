import nextEnv from "@next/env";
import { and, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb, getPool } from "../db";
import { pmRecords, sessions, users } from "../db/schema";
import { createSession, tokenHash } from "../lib/auth";
import { POST as create } from "../app/api/pm-records/route";
import { POST as sign } from "../app/api/pm-records/[id]/signature/route";
import { GET as pdf } from "../app/api/pm-records/[id]/pdf/route";
import { completeQaDraft, qaSigningInput } from "../tests/fixtures/pm";
nextEnv.loadEnvConfig(process.cwd(), true);
const url = new URL(process.env.DATABASE_URL!);
if (!process.argv.includes("--create-local-qa") || process.env.CRYOPM_LOCAL_MANAGED_POSTGRES !== "1" || url.hostname !== "127.0.0.1" || url.port !== "15433" || url.pathname !== "/cryopm" || process.env.APP_ORIGIN !== "http://localhost:3000") throw new Error("This script only creates synthetic PMs in the managed local QA database. Pass --create-local-qa.");
let token: string | undefined;
try {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, process.env.CRYOPM_LOCAL_TEST_EMAIL!));
  if (!user || user.disabled) throw new Error("Local QA account is unavailable.");
  token = await createSession(user.id);
  const request = (method: string, suffix: string, body?: unknown) => new Request(`http://localhost:3000/api/pm-records${suffix}`, { method, headers: { cookie: `cryopm_session=${token}`, origin: "http://localhost:3000", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const output = path.resolve("output/pdf"); await mkdir(output, { recursive: true });
  for (const brand of ["mve", "taylor"] as const) {
    const input = completeQaDraft(brand);
    const [existing] = await db.select().from(pmRecords).where(and(eq(pmRecords.ownerSubject, user.id), eq(pmRecords.freezerSerial, input.freezerSerial)));
    let id = existing?.id;
    if (existing && (existing.clientOrganization !== input.clientOrganization || existing.status !== "completed")) throw new Error("Existing serial is not a completed synthetic QA record; inspect it before running again.");
    if (!id) {
      const created = await create(request("POST", "", input));
      if (created.status !== 201) throw new Error(`QA create failed: ${await created.text()}`);
      id = (await created.json()).record.id;
      const signed = await sign(request("POST", `/${id}/signature`, await qaSigningInput(1)), { params: Promise.resolve({ id: id! }) });
      if (signed.status !== 200) throw new Error(`QA signing failed: ${await signed.text()}`);
    }
    const exported = await pdf(request("GET", `/${id}/pdf`), { params: Promise.resolve({ id: id! }) });
    if (exported.status !== 200) throw new Error(`QA PDF failed: ${await exported.text()}`);
    const file = path.join(output, brand === "mve" ? "qa-mve.pdf" : "qa-taylor-wharton.pdf");
    await writeFile(file, new Uint8Array(await exported.arrayBuffer()));
    console.log(JSON.stringify({ brand, id, file, status: "completed", synthetic: true }));
  }
} finally {
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
  await getPool().end();
}
