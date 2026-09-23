import { env } from "cloudflare:workers";

type StoredSignature = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type SignatureBucket = {
  put(
    key: string,
    value: Uint8Array,
    options: {
      httpMetadata: { contentType: string };
      customMetadata: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<StoredSignature | null>;
  delete(key: string | string[]): Promise<void>;
};

type SignatureEnvironment = {
  SIGNATURES?: SignatureBucket;
};

export function getSignatureBucket() {
  const bucket = (env as unknown as SignatureEnvironment).SIGNATURES;
  if (!bucket) {
    throw new Error("Signature storage binding is unavailable.");
  }
  return bucket;
}
