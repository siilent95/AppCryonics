import { and, eq, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getDb, transactionalResponse } from "@/db";
import { equipmentModels, equipmentAssets } from "@/db/schema";
import { requireActor, requireAdmin } from "@/lib/auth";
import { auditCatalog, catalogError, privateHeaders } from "@/lib/equipment/catalog";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
type Context = { params: Promise<{ id: string }> };
function assetKind(request: Request): "image" | "datasheet" {
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "image" && kind !== "datasheet") throw new RequestValidationError("Choose image or datasheet.");
  return kind;
}
export async function GET(request: Request, context: Context) {
  try {
    await requireActor(request); const { id } = await context.params; const kind = assetKind(request);
    const [model] = await getDb().select().from(equipmentModels).where(eq(equipmentModels.id, id));
    if (!model) return new Response("Model not found", { status: 404 });
    const [asset] = await getDb().select().from(equipmentAssets).where(and(eq(equipmentAssets.modelId, id), eq(equipmentAssets.kind, kind)));
    let data = asset?.data; let contentType = asset?.contentType;
    if (!data) {
      const source = kind === "image" ? model.imagePath : model.datasheetPath;
      if (!source) return new Response("Document or image not available", { status: 404 });
      // These paths are seeded by migrations; API input cannot set file paths.
      if (!/^\/(equipment-assets|freezers)\/[a-z0-9_.-]+\.(webp|png|jpg|pdf)$/.test(source)) throw new Error("Invalid bundled asset path");
      data = await readFile(path.join(process.cwd(), "public", source));
      contentType = source.endsWith(".pdf") ? "application/pdf" : source.endsWith(".png") ? "image/png" : source.endsWith(".jpg") ? "image/jpeg" : "image/webp";
    }
    const filename = model.model.replace(/[^a-zA-Z0-9_-]/g, "-") + (kind === "datasheet" ? ".pdf" : ".webp");
    return new Response(new Uint8Array(data), { headers: { ...privateHeaders, "Content-Type": contentType!, "Content-Length": String(data.length),
      "Content-Disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"` } });
  } catch (error) { return catalogError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireAdmin(request); const { id } = await context.params; const kind = assetKind(request);
    const maximum = kind === "image" ? 6 * 1024 * 1024 : 12 * 1024 * 1024;
    if (Number(request.headers.get("content-length")) > maximum) return Response.json({ error: "File exceeds the size limit." }, { status: 413 });
    const reader = request.body?.getReader(); if (!reader) throw new RequestValidationError("Choose a file.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length;
      if (size > maximum) { await reader.cancel(); return Response.json({ error: "File exceeds the size limit." }, { status: 413 }); } chunks.push(value); }
    let data = Buffer.concat(chunks); let contentType = "application/pdf";
    if (kind === "datasheet") {
      if (!data.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new RequestValidationError("Upload a PDF document.");
    } else {
      try {
        const png = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = data[0] === 255 && data[1] === 216 && data[2] === 255;
        const webp = data.subarray(0,4).toString() === "RIFF" && data.subarray(8,12).toString() === "WEBP";
        if (!png && !jpeg && !webp) throw Error();
        const image = sharp(data, { limitInputPixels: 30_000_000, animated: false }); const metadata = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format || "")) throw Error();
        data = await image.rotate().resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(); contentType = "image/webp";
      } catch { throw new RequestValidationError("Upload a valid JPG, PNG or WebP image (maximum 30 megapixels)."); }
    }
    return await transactionalResponse(async () => {
      // Serialize file replacements with edits, and bump the revision for cache invalidation.
      const [model] = await getDb().select().from(equipmentModels).where(eq(equipmentModels.id, id)).for("update");
      if (!model) return Response.json({ error: "Model not found." }, { status: 404 });
      await getDb().insert(equipmentAssets).values({ modelId: id, kind, data, contentType })
        .onConflictDoUpdate({ target: [equipmentAssets.modelId, equipmentAssets.kind], set: { data, contentType } });
      await getDb().update(equipmentModels).set({ revision: sql`${equipmentModels.revision} + 1`, updatedAt: new Date().toISOString() }).where(eq(equipmentModels.id, id));
      await auditCatalog(actor.id, id, `${kind}_uploaded`);
      return Response.json({ id }, { headers: privateHeaders });
    });
  } catch (error) { return catalogError(error); }
}
