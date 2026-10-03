import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { pmSignatures } from "../../../db/schema";
export function getSignatureBucket() {
  const db = getDb();
  return {
    async put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }) {
      await db.insert(pmSignatures).values({ key, data: Buffer.from(value), contentType: options.httpMetadata.contentType, metadataJson: JSON.stringify(options.customMetadata) });
    },
    async get(key: string) {
      const [signature] = await db.select().from(pmSignatures).where(eq(pmSignatures.key, key)).limit(1);
      return signature ? { body: new Uint8Array(signature.data).buffer, httpMetadata: { contentType: signature.contentType } } : null;
    },
    async delete(keys: string | string[]) {
      const list = typeof keys === "string" ? [keys] : keys;
      if (list.length) await db.delete(pmSignatures).where(inArray(pmSignatures.key, list));
    },
  };
}
