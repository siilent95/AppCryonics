"use client";
import { useEffect, useState } from "react";
import type { AnalyticsFilters } from "./types";
export function filterQuery(filters: AnalyticsFilters) {
  return new URLSearchParams({ days: String(filters.days), brand: filters.brand, end: filters.end }).toString();
}
export function useAnalyticsResource<T>(url: string) {
  const [response, setResponse] = useState<{ url: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async result => {
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || "Unable to load maintenance statistics.");
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
