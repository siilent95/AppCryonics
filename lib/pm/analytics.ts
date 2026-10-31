import { getPool } from "@/db";
import { RequestValidationError } from "@/app/api/pm-records/_shared";
import type { AnalyticsData, AnalyticsDetails, AnalyticsFilters } from "@/features/pm/analytics/types";

function date(value: string | null, fallback?: string): string {
  if (value === null && fallback) return fallback;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + "T00:00:00Z")) || new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value) {
    throw new RequestValidationError("A valid YYYY-MM-DD date is required.");
  }
  return value;
}
function shift(day: string, days: number) {
  const result = new Date(day + "T00:00:00Z");
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function analyticsFilters(params: URLSearchParams): AnalyticsFilters {
  const days = Number(params.get("days") ?? 90);
  const brand = params.get("brand") ?? "all";
  if (![7, 30, 90].includes(days) || !/^[a-zA-Z0-9_-]{1,80}$/.test(brand)) throw new RequestValidationError("Invalid analytics filters.");
  return { days: days as AnalyticsFilters["days"], brand: brand as AnalyticsFilters["brand"], end: date(params.get("end"), new Date().toISOString().slice(0, 10)) };
}
function windowFor(filters: AnalyticsFilters) {
  const start = shift(filters.end, 1 - filters.days);
  return { start, end: filters.end, previousStart: shift(start, -filters.days), previousEnd: shift(start, -1) };
}
// Both summary and drill-down use the same account, date, state and note definitions.
// Invalid legacy dates/payloads are isolated rather than breaking the entire overview.
const cohort = `WITH owner_records AS MATERIALIZED (
  SELECT *, CASE WHEN performed_on ~ '^\\d{4}-\\d{2}-\\d{2}$' AND pg_input_is_valid(performed_on, 'date') THEN performed_on::date END AS pm_date,
    CASE WHEN payload_json IS JSON OBJECT AND pg_input_is_valid(payload_json, 'jsonb') THEN payload_json::jsonb ELSE '{}'::jsonb END AS payload,
    CASE WHEN status = 'completed' THEN 'completed' WHEN status = 'ready_for_signature' OR current_step = 'review' THEN 'review' ELSE 'draft' END AS state,
    coalesce(equipment_brand_id, brand) || ':' || upper(btrim(freezer_serial)) AS equipment_key,
    coalesce(nullif(btrim(lab_name), ''), 'Not recorded') AS lab,
    coalesce(equipment_brand_id, brand) AS manufacturer,
    coalesce(equipment_brand_name, CASE WHEN brand = 'mve' THEN 'MVE' ELSE 'Taylor-Wharton' END) AS manufacturer_name
  FROM pm_records WHERE ($1::text IS NULL OR owner_subject = $1 OR created_by = $1) AND deleted_at IS NULL AND status <> 'archived' AND ($2 = 'all' OR coalesce(equipment_brand_id, brand) = $2)
    AND NOT EXISTS (SELECT 1 FROM pm_records child WHERE child.corrects_record_id = pm_records.id AND child.deleted_at IS NULL)
), current_period AS (SELECT * FROM owner_records WHERE pm_date BETWEEN $3::date AND $4::date)`;
const recordJson = `jsonb_build_object('id', id, 'recordNumber', record_number, 'brand', brand, 'equipmentBrandId', equipment_brand_id, 'equipmentBrandName', equipment_brand_name, 'modelFamily', model_family, 'model', model, 'freezerSerial', freezer_serial, 'labName', lab_name, 'performedOn', pm_date::text, 'status', status, 'currentStep', current_step)`;
const sections = [ ["construction", "Construction"], ["operation", "Operation"], ["verification", "Verification"], ["examination", "Examination"] ];
function hasNote(alias: string) { return `jsonb_typeof(payload->'notes'->${alias}) = 'string' AND (payload->'notes'->>${alias}) ~ '[^[:space:]]'`; }

export async function getAnalytics(owner: string | null, filters: AnalyticsFilters): Promise<AnalyticsData> {
  const range = windowFor(filters);
  const result = await getPool().query(`${cohort}
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM current_period),
    'previousTotal', (SELECT count(*) FROM owner_records WHERE pm_date BETWEEN $5::date AND $6::date),
    'completed', (SELECT count(*) FROM current_period WHERE state = 'completed'),
    'review', (SELECT count(*) FROM current_period WHERE state = 'review'),
    'draft', (SELECT count(*) FROM current_period WHERE state = 'draft'),
    'equipment', (SELECT count(DISTINCT equipment_key) FROM current_period WHERE nullif(btrim(freezer_serial), '') IS NOT NULL),
    'missingSerial', (SELECT count(*) FROM current_period WHERE nullif(btrim(freezer_serial), '') IS NULL),
    'undated', (SELECT count(*) FROM owner_records WHERE pm_date IS NULL),
    'daily', coalesce((SELECT jsonb_agg(jsonb_build_object('date', day::text, 'completed', completed, 'open', open) ORDER BY day) FROM (
      SELECT pm_date AS day, count(*) FILTER (WHERE state = 'completed') AS completed, count(*) FILTER (WHERE state <> 'completed') AS open FROM current_period GROUP BY pm_date
    ) d), '[]'::jsonb),
    'sections', (SELECT jsonb_agg(jsonb_build_object('key', key, 'label', label, 'count', (SELECT count(*) FROM current_period WHERE ${hasNote("s.key")}))) FROM (VALUES ${sections.map(([key, label]) => `('${key}', '${label}')`).join(",")}) s(key, label)),
    'labs', coalesce((SELECT jsonb_agg(jsonb_build_object('key', lab, 'label', lab, 'count', n) ORDER BY n DESC, lab) FROM (SELECT lab, count(*) AS n FROM current_period GROUP BY lab) l), '[]'::jsonb),
    'brands', coalesce((SELECT jsonb_agg(jsonb_build_object('key', manufacturer, 'label', label, 'count', n) ORDER BY n DESC, manufacturer) FROM (SELECT manufacturer, max(manufacturer_name) AS label, count(*) AS n FROM current_period GROUP BY manufacturer) b), '[]'::jsonb),
    'topModels', coalesce((SELECT jsonb_agg(jsonb_build_object('key', jsonb_build_array(manufacturer, model_family, model)::text, 'brandId', manufacturer, 'brandName', label, 'family', model_family, 'model', model, 'count', n) ORDER BY n DESC, manufacturer, model_family, model) FROM (
      SELECT manufacturer, max(manufacturer_name) AS label, model_family, model, count(*) AS n FROM current_period
      WHERE nullif(btrim(model), '') IS NOT NULL GROUP BY manufacturer, model_family, model
      ORDER BY n DESC, manufacturer, model_family, model LIMIT 3
    ) m), '[]'::jsonb),
    'featured', (SELECT ${recordJson} FROM current_period ORDER BY pm_date DESC, updated_at DESC, id LIMIT 1)
  ) AS data`, [owner, filters.brand, range.start, range.end, range.previousStart, range.previousEnd]);
  return { ...range, ...result.rows[0].data };
}
export async function getAnalyticsRecords(owner: string | null, filters: AnalyticsFilters, params: URLSearchParams): Promise<AnalyticsDetails> {
  const kind = params.get("kind") ?? "all";
  const value = params.get("value") ?? "";
  const page = Number(params.get("page") ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || value.length > (kind === "model" ? 2000 : 300)) throw new RequestValidationError("Invalid record page or filter.");
  const range = windowFor(filters);
  const args: unknown[] = [owner, filters.brand, range.start, range.end];
  let condition = "TRUE";
  if (kind === "period") {
    const from = date(params.get("from")); const to = date(params.get("to"));
    if (from < range.start || to > range.end || from > to) throw new RequestValidationError("Record dates must be inside the selected period.");
    args.push(from, to); condition = "pm_date BETWEEN $5::date AND $6::date";
  } else if (kind === "model") {
    let identity: unknown;
    try { identity = JSON.parse(value); } catch { throw new RequestValidationError("Invalid equipment model filter."); }
    if (!Array.isArray(identity) || identity.length !== 3 || identity.some((part, i) => typeof part !== "string" || !part.trim() || part.length > (i === 0 ? 80 : 120))) throw new RequestValidationError("Invalid equipment model filter.");
    args.push(...identity); condition = "manufacturer = $5 AND model_family = $6 AND model = $7";
  } else if (kind !== "all") {
    const allowed: Record<string, string> = { state: "state", lab: "lab", brand: "manufacturer", equipment: "equipment_key" };
    if (kind === "section") {
      if (!sections.some(([key]) => key === value)) throw new RequestValidationError("Invalid observation section.");
      args.push(value); condition = hasNote("$5::text");
    } else {
      if (!allowed[kind] || !value || (kind === "state" && !["completed", "review", "draft"].includes(value)) || (kind === "brand" && !/^[a-zA-Z0-9_-]{1,80}$/.test(value))) throw new RequestValidationError("Invalid record filter.");
      args.push(value); condition = `${allowed[kind]} = $5`;
    }
  }
  args.push((page - 1) * 25);
  const result = await getPool().query(`${cohort}, matched AS (SELECT * FROM current_period WHERE ${condition})
    SELECT (SELECT count(*)::int FROM matched) AS total,
      coalesce((SELECT jsonb_agg(row ORDER BY day DESC, updated DESC, identifier) FROM (
        SELECT ${recordJson} AS row, pm_date AS day, updated_at AS updated, id AS identifier FROM matched ORDER BY pm_date DESC, updated_at DESC, id LIMIT 25 OFFSET $${args.length}
      ) p), '[]'::jsonb) AS records`, args);
  return { ...result.rows[0], page, pageSize: 25 };
}
export const analyticsHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
