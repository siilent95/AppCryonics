"use client";
import { useCallback, useEffect, useState } from "react";
import type { EquipmentCatalog } from "./types";
async function loadCatalog(signal?: AbortSignal): Promise<EquipmentCatalog> {
 const response = await fetch("/api/equipment", { cache: "no-store", signal }); const result = await response.json();
 if (!response.ok) throw new Error(result.error || "Unable to load the equipment catalog."); return result;
}
export function useEquipmentCatalog() {
 const [catalog, setCatalog] = useState<EquipmentCatalog>({ brands: [], models: [] });
 const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading"); const [error, setError] = useState("");
 const apply = useCallback((result: EquipmentCatalog) => { setCatalog(result); setStatus("loaded"); setError(""); }, []);
 const fail = useCallback((error: unknown) => { setError(error instanceof Error ? error.message : "Unable to load the catalog."); setStatus("error"); }, []);
 const refresh = useCallback(async () => { try { apply(await loadCatalog()); } catch (error) { fail(error); } }, [apply, fail]);
 useEffect(() => { const controller = new AbortController(); loadCatalog(controller.signal).then(apply).catch(error => { if (!controller.signal.aborted) fail(error); }); return () => controller.abort(); }, [apply, fail]);
 return { catalog, status, error, refresh };
}
