import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { getDb, getPool } from "../db";
import { users } from "../db/schema";
import { hashPassword } from "../lib/password";
nextEnv.loadEnvConfig(process.cwd());
const [email, displayName, role = "technician", rawUsername] = process.argv.slice(2);
const username = rawUsername?.trim().toLowerCase() || null;
if (!["admin", "technician"].includes(role) || (username && !/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(username))) throw new Error("Invalid role or username.");
const password = process.env.CRYOPM_BOOTSTRAP_PASSWORD;
if (!email?.includes("@") || !displayName || !password) throw new Error("Usage: CRYOPM_BOOTSTRAP_PASSWORD=<secret> npm run user:create -- email displayName [technician|admin] [username]");
try {
  await getDb().insert(users).values({ id: randomUUID(), email: email.trim().toLowerCase(), displayName, username, role: role as "admin" | "technician", passwordHash: await hashPassword(password) });
  console.log(`CryoPM ${role} account created${username ? ` (${username})` : ""}.`);
} finally { await getPool().end(); }
