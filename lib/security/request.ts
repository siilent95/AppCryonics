export class RequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 413 = 400) { super(message); }
}

/** Enforce the limit while streaming, including requests without Content-Length. */
export async function readRequestText(request: Request, maximum: number) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new RequestBodyError("Request is too large.", 413);
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new RequestBodyError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size).toString("utf8");
}

export async function readJsonObject(request: Request, maximum = 8192): Promise<Record<string, unknown>> {
  const text = await readRequestText(request, maximum);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new RequestBodyError("A JSON object is required."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RequestBodyError("A JSON object is required.");
  const pending: { value: object; depth: number }[] = [{ value: input, depth: 0 }];
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > 32) throw new RequestBodyError("Request nesting is too deep.");
    for (const child of Object.values(value)) if (child && typeof child === "object") pending.push({ value: child, depth: depth + 1 });
  }
  return input as Record<string, unknown>;
}
