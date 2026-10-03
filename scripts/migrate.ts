import nextEnv from "@next/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, getPool } from "../db";
nextEnv.loadEnvConfig(process.cwd());
try { await migrate(getDb(), { migrationsFolder: "./drizzle" }); console.log("PostgreSQL migrations applied."); }
finally { await getPool().end(); }
