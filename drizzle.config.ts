import nextEnv from "@next/env";
import { defineConfig } from "drizzle-kit";
nextEnv.loadEnvConfig(process.cwd());
export default defineConfig({ out: "./drizzle", schema: "./db/schema.ts", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL! } });
