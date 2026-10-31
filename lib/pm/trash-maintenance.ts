import { purgeExpiredTrash, TRASH_PURGE_BATCH_SIZE } from "./trash-retention";
export const TRASH_MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const maintenance = globalThis as unknown as { cryopmTrashTimer?: ReturnType<typeof setInterval> };
export function startTrashMaintenance() {
  if (maintenance.cryopmTrashTimer) return;
  console.info("[CryoPM] Trash maintenance enabled: 25-day recovery, checking daily (every 24 hours).");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // Catch up in short transactions, capped to keep startup and normal work responsive.
      let pms = 0, versions = 0, signatures = 0;
      for (let batch = 0; batch < 10; batch++) {
        const result = await purgeExpiredTrash();
        pms += result.pms; versions += result.versions; signatures += result.signatures;
        if (result.pms < TRASH_PURGE_BATCH_SIZE) break;
      }
      if (pms) console.info("[CryoPM] Expired Trash cleanup:", { pms, versions, signatures });
    } catch {
      console.error("[CryoPM] Trash cleanup failed; it will retry on the next maintenance run.");
    } finally { running = false; }
  };
  maintenance.cryopmTrashTimer = setInterval(() => void tick(), TRASH_MAINTENANCE_INTERVAL_MS);
  maintenance.cryopmTrashTimer.unref();
  void tick();
}
