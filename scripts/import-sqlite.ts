import nextEnv from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { getPool } from "../db";
nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
if (!["--source", "--owners", "--signatures"].every(name => args.includes(name) && option(name))) {
  throw new Error("Usage: npm run db:import -- --source backup.sqlite --owners owners.json --signatures exported-r2-directory [--apply]");
}
const sourcePath = resolve(option("--source"));
const source = new DatabaseSync(sourcePath.endsWith(".sql") ? ":memory:" : sourcePath, { readOnly: !sourcePath.endsWith(".sql") });
if (sourcePath.endsWith(".sql")) source.exec(await readFile(sourcePath, "utf8"));
const owners: Record<string, string> = JSON.parse(await readFile(resolve(option("--owners")), "utf8"));
const signatureRoot = resolve(option("--signatures"));
const client = await getPool().connect();
try {
  await client.query("BEGIN");
  const count = await client.query("SELECT (SELECT count(*) FROM pm_records) + (SELECT count(*) FROM pm_events) + (SELECT count(*) FROM pm_signatures) AS count");
  if (Number(count.rows[0].count)) throw new Error("Import requires an empty target PM database.");
  const knownUsers = new Set((await client.query("SELECT id FROM users")).rows.map(row => row.id));
  const records = source.prepare("SELECT * FROM pm_records").all();
  const events = source.prepare("SELECT * FROM pm_events").all();
  const seenKeys = new Set<string>();
  let importedSignatures = 0;
  async function insert(table: string, row: Record<string, unknown>) {
    const columns = Object.keys(row);
    const target = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]);
    const allowed = new Set(target.rows.map(item => item.column_name));
    if (columns.some(column => !allowed.has(column))) throw new Error(`Unexpected column in ${table}`);
    const quoted = columns.map(column => `"${column}"`).join(",");
    await client.query(`INSERT INTO "${table}" (${quoted}) ${table === "pm_events" ? "OVERRIDING SYSTEM VALUE" : ""} VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})`, columns.map(column => row[column]));
  }
  function normalize(row: Record<string, unknown>) {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && (key.endsWith("_at") || key.endsWith("_until"))) {
        const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
        if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${key}`);
        row[key] = date.toISOString();
      }
    }
    return row;
  }
  for (const original of records) {
    const row = normalize({ ...original });
    const owner = owners[String(row.owner_subject)];
    if (!owner || !knownUsers.has(owner)) throw new Error("Every PM owner must map to an existing CryoPM account.");
    row.owner_subject = owner;
    row.owner_email = null;
    for (const role of ["recipient", "technician"]) {
      const key = row[`${role}_signature_key`];
      if (typeof key !== "string" || row[`${role}_signature_deleted_at`] || seenKeys.has(key)) continue;
      const file = resolve(signatureRoot, key);
      const inside = relative(signatureRoot, file);
      if (inside.startsWith("..") || isAbsolute(inside)) throw new Error("Signature key escapes export directory.");
      const bytes = await readFile(file);
      if (createHash("sha256").update(bytes).digest("hex") !== row[`${role}_signature_sha256`]) throw new Error("Signature checksum does not match source record.");
      await insert("pm_signatures", { key, data: bytes, content_type: row[`${role}_signature_mime_type`] ?? "image/png", metadata_json: JSON.stringify({ pmRecordId: row.id, signatureRole: role, imported: true }) });
      seenKeys.add(key);
      importedSignatures++;
    }
    await insert("pm_records", row);
  }
  for (const original of events) {
    const row = normalize({ ...original });
    if (row.actor_subject) {
      const actor = owners[String(row.actor_subject)];
      if (!actor || !knownUsers.has(actor)) throw new Error("Every event actor must map to an existing CryoPM account.");
      row.actor_subject = actor;
    }
    row.actor_email = null;
    await insert("pm_events", row);
  }
  if (args.includes("--apply")) {
    await client.query("SELECT setval('pm_events_id_seq', COALESCE((SELECT max(id) FROM pm_events), 1), EXISTS(SELECT 1 FROM pm_events))");
    await client.query("COMMIT");
  } else await client.query("ROLLBACK");
  console.log(`${args.includes("--apply") ? "Imported" : "Dry run passed; rolled back"}: ${records.length} PM, ${events.length} events, ${importedSignatures} signatures.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release(); source.close(); await getPool().end();
}
