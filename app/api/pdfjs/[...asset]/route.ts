import { readFile } from "node:fs/promises";
import path from "node:path";
/** Public, self-hosted PDF.js runtime assets; no document data passes through this route. */
export async function GET(_request: Request, context: { params: Promise<{ asset: string[] }> }) {
 const { asset } = await context.params; const name = asset.join("/");
 if (!/^(build\/(pdf\.mjs|pdf\.worker\.min\.mjs)|(cmaps|standard_fonts|wasm)\/[a-zA-Z0-9_.-]+\.(bcmap|pfb|ttf|wasm))$/.test(name)) return new Response("Not found", { status: 404 });
 try {
  const file = await readFile(path.join(process.cwd(), "node_modules/pdfjs-dist", name));
  return new Response(new Uint8Array(file), { headers: { "Content-Type": name.endsWith(".mjs") ? "text/javascript; charset=utf-8" : name.endsWith(".wasm") ? "application/wasm" : "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
 } catch { return new Response("Not found", { status: 404 }); }
}
