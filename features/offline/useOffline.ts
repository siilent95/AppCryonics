"use client";
import { useSyncExternalStore } from "react";
import { offlineEngine } from "./engine";
export function useOffline() { return useSyncExternalStore(offlineEngine.subscribe,offlineEngine.getState,offlineEngine.getState); }
