import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import EmbeddedPostgres from "embedded-postgres";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const databaseDir = path.join(root, "work", "postgres-local");
await mkdir(path.dirname(databaseDir), { recursive: true });

try {
  await writeFile(path.join(root, ".env.local"), [
    "# Local synthetic test environment. Do not commit this file.",
    "CRYOPM_LOCAL_MANAGED_POSTGRES=1",
    `DATABASE_URL=postgresql://cryopm:${randomBytes(24).toString("hex")}@127.0.0.1:15433/cryopm`,
    "APP_ORIGIN=http://localhost:3000",
    "CRYOPM_LOCAL_TEST_EMAIL=tester@cryopm.local",
    `CRYOPM_LOCAL_TEST_PASSWORD=CryoPM-local-${randomBytes(12).toString("hex")}`,
    "",
  ].join("\n"), { flag: "wx", mode: 0o600 });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
nextEnv.loadEnvConfig(root, true);
if (process.env.CRYOPM_LOCAL_MANAGED_POSTGRES !== "1") {
  throw new Error("Existing environment detected. Use npm run dev -- --webpack with your configured PostgreSQL, or configure a separate local checkout.");
}
const database = new URL(process.env.DATABASE_URL);
if (database.hostname !== "127.0.0.1" || database.port !== "15433" || database.pathname !== "/cryopm" || database.username !== "cryopm") {
  throw new Error("Managed local PostgreSQL requires cryopm@127.0.0.1:15433/cryopm.");
}
if (process.env.APP_ORIGIN !== "http://localhost:3000") {
  throw new Error("Managed local development requires APP_ORIGIN=http://localhost:3000.");
}
const postgres = new EmbeddedPostgres({
  databaseDir, port: 15433, user: "cryopm", password: database.password,
  authMethod: "scram-sha-256", persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {}, onError: (error) => console.error(error),
});
let app;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (app && app.exitCode === null && app.signalCode === null) {
    const exited = once(app, "exit");
    app.kill("SIGTERM");
    await exited;
  }
  await postgres.stop();
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { void stop().then(() => process.exit(0)); });
}
async function runScript(script, extraEnvironment = {}) {
  const child = spawn(process.execPath, ["--import", "tsx", script], {
    cwd: root, env: { ...process.env, ...extraEnvironment }, stdio: "inherit",
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${script} exited with code ${code}`);
}
try {
  try { await access(path.join(databaseDir, "PG_VERSION")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    await postgres.initialise();
  }
  await postgres.start();
  const client = postgres.getPgClient("postgres", "127.0.0.1");
  await client.connect();
  try {
    if (!(await client.query("SELECT 1 FROM pg_database WHERE datname = $1", ["cryopm"])).rowCount) {
      await client.query("CREATE DATABASE cryopm");
    }
  } finally { await client.end(); }
  await runScript("scripts/migrate.ts");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const email = process.env.CRYOPM_LOCAL_TEST_EMAIL;
    const password = process.env.CRYOPM_LOCAL_TEST_PASSWORD;
    if (!email || !password) throw new Error("Local test account settings are missing from .env.local.");
    if (!(await pool.query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount) {
      const child = spawn(process.execPath, ["--import", "tsx", "scripts/create-user.ts", email, "CryoPM Local Tester"], {
        cwd: root, env: { ...process.env, CRYOPM_BOOTSTRAP_PASSWORD: password }, stdio: "inherit",
      });
      const [code] = await once(child, "exit");
      if (code !== 0) throw new Error("Could not create the local test account.");
    }
  } finally { await pool.end(); }
  console.log("Local PostgreSQL ready on 127.0.0.1:15433; data persists in work/postgres-local.");
  console.log("CryoPM: http://localhost:3000 — test credentials are in .env.local.");
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3000"], {
    cwd: root, env: process.env, stdio: "inherit",
  });
  const [code] = await once(app, "exit");
  process.exitCode = code ?? 1;
} finally { await stop(); }
