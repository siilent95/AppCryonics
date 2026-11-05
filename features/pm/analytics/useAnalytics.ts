"use client";
import { offlineJson } from "@/features/offline/data";
import { useEffect, useState } from "react";
import type { AnalyticsFilters } from "./types";
export function filterQuery(filters: AnalyticsFilters) {
  return new URLSearchParams({ days: String(filters.days), brand: filters.brand, end: filters.end }).toString();
}
export function useAnalyticsResource<T>(url: string) {
  const [response, setResponse] = useState<{ url: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    offlineJson<T>(url,controller.signal).then(data => {
        if (!controller.signal.aborted) setResponse({ url, data });
      }).catch(error => {
        if (!controller.signal.aborted) setResponse({ url, error: error instanceof Error ? error.message : "Unable to load statistics." });
      });
    return () => controller.abort();
  }, [url]);
  return response?.url === url ? response : null;
}
export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function shortDate(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
