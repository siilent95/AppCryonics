import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/db";
import { equipmentModels, equipmentAssets } from "@/db/schema";
import { freezerImage } from "@/features/pm/helpers";
import type { PmRecordSummary } from "@/features/pm/types";
export async function imageForPm(record: Pick<PmRecordSummary, "brand" | "equipmentBrandId" | "modelFamily" | "model">) {
 const [model] = await getDb().select().from(equipmentModels).where(and(eq(equipmentModels.brandId, record.equipmentBrandId || record.brand),eq(equipmentModels.family,record.modelFamily),eq(equipmentModels.model,record.model))).limit(1);
 if(model) {
  const [asset] = await getDb().select().from(equipmentAssets).where(and(eq(equipmentAssets.modelId,model.id),eq(equipmentAssets.kind,"image")));
  if(asset)return {data:asset.data,exact:model.imageScope==="model"};
  if(model.imagePath && /^\/(equipment-assets|freezers)\/[a-z0-9_.-]+\.(webp|png|jpg)$/.test(model.imagePath))return {data:await readFile(path.join(process.cwd(),"public",model.imagePath)),exact:model.imageScope==="model"};
 }
 if(record.equipmentBrandId && record.equipmentBrandId!==record.brand)return null;
 const fallback=freezerImage(record.brand,record.modelFamily,record.model);
 return {data:await readFile(path.join(process.cwd(),"public",fallback.src)),exact:fallback.exact};
}
