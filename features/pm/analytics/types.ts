export type AnalyticsFilters = { days: 7 | 30 | 90; brand: string; end: string };
export type AnalyticsRecord = {
  id: string; recordNumber: string; equipmentBrandId?: string | null; equipmentBrandName?: string | null; brand: "mve" | "taylor"; modelFamily: string; model: string;
  freezerSerial: string | null; labName: string | null; performedOn: string; status: string; currentStep: string;
};
export type AnalyticsData = {
  start: string; end: string; previousStart: string; previousEnd: string;
  total: number; previousTotal: number; completed: number; review: number; draft: number;
  equipment: number; missingSerial: number; undated: number;
  daily: { date: string; completed: number; open: number }[];
  sections: { key: string; label: string; count: number }[];
  labs: { key: string; label: string; count: number }[];
  brands: { key: string; label: string; count: number }[];
  topModels: { key: string; brandId: string; brandName: string; family: string; model: string; count: number }[];
  featured: AnalyticsRecord | null;
};
export type Drill = { kind: "all" | "period" | "state" | "section" | "lab" | "brand" | "equipment" | "model"; value?: string; from?: string; to?: string; title: string };
export type AnalyticsDetails = { records: AnalyticsRecord[]; total: number; page: number; pageSize: number };
