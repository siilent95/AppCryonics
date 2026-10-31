import type { BrandKey } from "@/features/pm/types";
export type CatalogBrand = { id: string; name: string; website: string | null; pmTemplate: BrandKey | null };
export type CatalogModel = {
  id: string; brandId: string; family: string; model: string;
  description: string; specifications: string; controllers: string[];
  imageUrl: string | null; imageScope: "model" | "family"; imageSource: string | null;
  datasheetUrl: string | null; datasheetSource: string | null;
  active: boolean; revision: number;
};
export type EquipmentCatalog = { brands: CatalogBrand[]; models: CatalogModel[] };
