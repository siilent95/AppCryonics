import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { equipmentBrands, equipmentModels, equipmentAssets, equipmentEvents } from "@/db/schema";
import { RequestValidationError, apiError } from "@/app/api/pm-records/_shared";
import type { EquipmentCatalog } from "@/features/equipment/types";
export { privateHeaders, readInput, field } from "@/lib/accounts/shared";
export function catalogError(error: unknown) {
  const cause = error as { code?: string; cause?: { code?: string } };
  if ([cause?.code, cause?.cause?.code].includes("23505")) return Response.json({ error: "That brand or model is already in the catalog." }, { status: 409 });
  const response = apiError(error); response.headers.set("Cache-Control", "no-store, private"); return response;
}

export async function readCatalog(): Promise<EquipmentCatalog> {
  const db = getDb();
  const [brands, rows, assets] = await Promise.all([
    db.select().from(equipmentBrands).orderBy(asc(equipmentBrands.name)),
    db.select().from(equipmentModels).orderBy(asc(equipmentModels.family), asc(equipmentModels.model)),
    db.select({ modelId: equipmentAssets.modelId, kind: equipmentAssets.kind }).from(equipmentAssets),
  ]);
  const available = new Set(assets.map(a => `${a.modelId}:${a.kind}`));
  return { brands, models: rows.map(row => ({
    id: row.id, brandId: row.brandId, family: row.family, model: row.model,
    description: row.description, specifications: row.specifications, controllers: JSON.parse(row.controllersJson),
    active: !!row.active, revision: row.revision, imageScope: row.imageScope, imageSource: row.imageSource,
    imageUrl: available.has(`${row.id}:image`) || row.imagePath ? `/api/equipment/models/${row.id}/assets?kind=image&v=${row.revision}` : null,
    datasheetUrl: available.has(`${row.id}:datasheet`) || row.datasheetPath ? `/api/equipment/models/${row.id}/assets?kind=datasheet&v=${row.revision}` : null,
    datasheetSource: row.datasheetSource,
  })) };
}

export function sourceUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 1000) throw new RequestValidationError("Invalid source URL.");
  try { const url = new URL(value); if (url.protocol !== "https:" || url.username || url.password) throw Error(); return url.href; }
  catch { throw new RequestValidationError("Source links must use HTTPS."); }
}
export function templateInput(value: unknown): "mve" | "taylor" | null {
  if (value == null || value === "") return null;
  if (value === "mve" || value === "taylor") return value;
  throw new RequestValidationError("Choose an existing PM template.");
}
export function modelInput(input: Record<string, unknown>) {
  function text(key: string, max: number, required = false) {
    const raw = input[key]; if (raw != null && typeof raw !== "string") throw new RequestValidationError(`${key} must be text.`);
    const result = String(raw ?? "").trim();
    if ((required && !result) || result.length > max) throw new RequestValidationError(`Invalid ${key}.`);
    return result;
  }
  const controllers = text("controllers", 1000).split(/\n|,/).map(s => s.trim()).filter(Boolean);
  if (controllers.length > 10 || controllers.some(s => s.length > 120)) throw new RequestValidationError("Use at most 10 controller options.");
  if (input.imageScope !== "model" && input.imageScope !== "family") throw new RequestValidationError("Choose the image scope.");
  if (typeof input.active !== "boolean") throw new RequestValidationError("Choose whether the model is available for PMs.");
  return { brandId: text("brandId", 80, true), family: text("family", 120, true), model: text("model", 120, true),
    description: text("description", 1200), specifications: text("specifications", 4000), controllersJson: JSON.stringify(controllers),
    imageScope: input.imageScope as "model" | "family", imageSource: sourceUrl(input.imageSource), datasheetSource: sourceUrl(input.datasheetSource), active: input.active ? 1 : 0 };
}
export async function auditCatalog(actorId: string, entityId: string, eventType: string) {
  await getDb().insert(equipmentEvents).values({ actorId, entityId, eventType });
}
type PmIdentity = { brand: "mve" | "taylor"; modelFamily: string; model: string; equipmentBrandId?: string | null; equipmentBrandName?: string | null };
export async function resolvePmIdentity(input: PmIdentity & { catalogModelId: string | null }, existing?: PmIdentity) {
  const unchanged = existing && input.brand === existing.brand && input.modelFamily === existing.modelFamily && input.model === existing.model;
  if (!input.catalogModelId) {
    if (unchanged) return { equipmentBrandId: existing.equipmentBrandId ?? null, equipmentBrandName: existing.equipmentBrandName ?? null };
    return { equipmentBrandId: input.brand, equipmentBrandName: input.brand === "mve" ? "MVE" : "Taylor-Wharton" };
  }
  const [entry] = await getDb().select({ model: equipmentModels, brand: equipmentBrands }).from(equipmentModels)
    .innerJoin(equipmentBrands, eq(equipmentModels.brandId, equipmentBrands.id)).where(eq(equipmentModels.id, input.catalogModelId));
  if (!entry || entry.model.family !== input.modelFamily || entry.model.model !== input.model) throw new RequestValidationError("Select an existing equipment model.");
  if (unchanged && (existing.equipmentBrandId || existing.brand) === entry.brand.id) {
    return { equipmentBrandId: existing.equipmentBrandId || existing.brand, equipmentBrandName: existing.equipmentBrandName || entry.brand.name };
  }
  if (!entry.model.active || entry.brand.pmTemplate !== input.brand) throw new RequestValidationError("This model is inactive or its PM template is not available. Reload the equipment catalog.");
  return { equipmentBrandId: entry.brand.id, equipmentBrandName: entry.brand.name };
}
