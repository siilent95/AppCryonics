import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { getDb, getPool } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../lib/password";
nextEnv.loadEnvConfig(process.cwd());
const [email, displayName] = process.argv.slice(2);
const password = process.env.CRYOPM_BOOTSTRAP_PASSWORD;
if (!email?.includes("@") || !displayName || !password) throw new Error("Usage: CRYOPM_BOOTSTRAP_PASSWORD=<secret> npm run user:create -- email displayName");
try {
  await getDb().insert(users).values({ id: randomUUID(), email: email.trim().toLowerCase(), displayName, passwordHash: await hashPassword(password) });
  console.log("CryoPM account created.");
} finally { await getPool().end(); }
