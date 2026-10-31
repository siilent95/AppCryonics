export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startTrashMaintenance } = await import("./lib/pm/trash-maintenance");
    startTrashMaintenance();
  }
}
