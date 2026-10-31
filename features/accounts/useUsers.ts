"use client";
import { useEffect, useState } from "react";
import type { ManagedUser } from "./types";
export function useUsers(version: number) {
  const [response, setResponse] = useState<{ version: number; users?: ManagedUser[]; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/users", { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load users."); return result; })
      .then(result => { if (!controller.signal.aborted) setResponse({ version, users: result.users }); })
      .catch(error => { if (!controller.signal.aborted) setResponse({ version, error: error instanceof Error ? error.message : "Unable to load users." }); });
    return () => controller.abort();
  }, [version]);
  return response?.version === version ? response : null;
}
export async function accountRequest(url: string, method: string, input: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to update the account.");
  return result;
}
