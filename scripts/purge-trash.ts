import nextEnv from "@next/env";
import { getPool } from "../db";
import { purgeExpiredTrash, TRASH_PURGE_BATCH_SIZE } from "../lib/pm/trash-retention";
nextEnv.loadEnvConfig(process.cwd());
try {
  const total = { pms: 0, versions: 0, signatures: 0 };
  for (let batch = 0; batch < 10; batch++) {
    const result = await purgeExpiredTrash();
    total.pms += result.pms; total.versions += result.versions; total.signatures += result.signatures;
    if (result.pms < TRASH_PURGE_BATCH_SIZE) break;
  }
  console.info("25-day Trash cleanup complete:", total);
} catch {
  console.error("Trash cleanup failed. Check the database configuration and server logs.");
  process.exitCode = 1;
} finally { if (process.env.DATABASE_URL) await getPool().end(); }
