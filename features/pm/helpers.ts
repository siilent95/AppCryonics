import type { BrandKey, PmStatus, PmRecordSummary } from "@/features/pm/types";

export function controllerOptions(brand: BrandKey, family: string, model: string): readonly string[] {
  if (brand === "mve") {
    if (family === "HE Series CryoVerse Connect") return ["CryoVerse Connect"];
    return family.startsWith("HEco") ? ["MVE Touch Screen", "TEC 3000"] : ["TEC 3000"];
  }
  if (family === "LABS Precision") return ["LABS Precision PLC"];
  if (model === "3K") return ["Not installed"];
  if (model === "38K") return ["CS200"];
  return ["CS100", "CS200"];
}


export function hasNumber(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}


export function hasNonNegativeNumber(value: string) {
  return hasNumber(value) && Number(value) >= 0;
}


export function hasNegativeNumber(value: string) {
  return hasNumber(value) && Number(value) < 0;
}


export function inOpenRange(value: string, min: number, max: number) {
  return hasNumber(value) && Number(value) > min && Number(value) < max;
}


export function normalizeDecimal(value: string, allowNegative: boolean) {
  const sign = allowNegative && value.trimStart().startsWith("-") ? "-" : "";
  const unsigned = value.replace(/[^\d.]/g, "");
  const [whole, ...decimals] = unsigned.split(".");
  const normalized = decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
  return `${sign}${normalized}`;
}


export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Not recorded";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return includeTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
}


export function pmDate(record: PmRecordSummary) {
  return record.performedOn || record.technicianSignatureCapturedAt || record.recipientSignatureCapturedAt;
}


export function localDateKey(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE");
}


export function freezerImage(brand: BrandKey, family: string, model: string) {
  if (brand === "taylor") {
    return family === "LABS Precision"
      ? { src: "/freezers/taylor-labs.webp", exact: model === "94K" }
      : { src: "/freezers/taylor-k.webp", exact: false };
  }
  if (family === "HE Series CryoVerse Connect") {
    if (model === "815P-190") return { src: "/freezers/cryoverse-815.webp", exact: true };
    if (model === "1536P-190") return { src: "/freezers/cryoverse-1536.webp", exact: true };
    if (model === "1892P-190") return { src: "/freezers/cryoverse-1892.webp", exact: true };
    return { src: model === "1542R-190" ? "/freezers/cryoverse-1536.webp" : "/freezers/cryoverse-1892.webp", exact: false };
  }
  if (family === "HEco 800 Series") return { src: "/freezers/mve-heco-800.webp", exact: false };
  if (family === "HEco 1500 Series") return { src: "/freezers/mve-he-1500.webp", exact: false };
  if (family === "High Efficiency 800") return { src: "/freezers/mve-he-800.webp", exact: false };
  if (family === "High Efficiency 1500") return { src: "/freezers/mve-he-1500.webp", exact: false };
  return { src: "/freezers/mve-series.webp", exact: false };
}


export function brandLabel(brand: BrandKey) {
  return brand === "mve" ? "MVE" : "Taylor-Wharton";
}


export function statusLabel(status: PmStatus) {
  if (status === "completed") return "Completed";
  if (status === "ready_for_signature") return "Ready for signatures";
  if (status === "archived") return "Archived";
  return "Draft";
}

