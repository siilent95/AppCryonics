import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { AsyncLocalStorage } from "node:async_hooks";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { databasePoolConfig } from "./config";
const globalDb = globalThis as unknown as { cryoPool?: Pool };
const transactionContext = new AsyncLocalStorage<NodePgDatabase<typeof schema>>();
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  return globalDb.cryoPool ??= new Pool(databasePoolConfig(process.env.DATABASE_URL, process.env.DATABASE_SSL_CA_BASE64));
}
export function getDb() { return transactionContext.getStore() ?? drizzle(getPool(), { schema }); }
class RollbackResponse extends Error {
  constructor(readonly response: Response) { super("Rollback failed request"); }
}
export async function transactionalResponse(operation: () => Promise<Response>) {
  try {
    return await getDb().transaction(tx => transactionContext.run(tx, async () => {
      const response = await operation();
      if (response.status >= 400) throw new RollbackResponse(response);
      return response;
    }));
  } catch (error) {
    if (error instanceof RollbackResponse) return error.response;
    throw error;
  }
}
