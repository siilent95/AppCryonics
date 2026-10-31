# Reports: deletion, recovery and pagination

Reports uses server-side pagination of 25 latest logical PMs per page. The previous hard cap of 50 summaries is removed: text, brand, status, technician and PM-date filters run in PostgreSQL before the count and page queries. Search treats `%` and `_` literally. Page ordering uses update time and an ID tie-breaker. Invalid page/date/status input is rejected, and out-of-range pages clamp to the current last page. Brand choices cover the full visible collection, rather than only the current page. Reports loads its pages only while open; workspace actions invalidate that list without fetching an extra unused summary page.

The list maximum height increases from 580 px to an adaptive 760–1200 px on desktop and 680 px on narrow screens. Search stays visible; secondary filters expand when requested. The footer shows the page, result range and total. Filter requests are debounced and obsolete responses are cancelled. CSV export explicitly fetches all matching pages when requested, preserving filtered exports across pagination.

## Deletion and recovery

- `DELETE /api/pm-records/:id` moves the latest PM and all its earlier versions to Trash using the existing `deleted_at` column. The PM remains recoverable for 25 days from this server timestamp.
- `POST /api/pm-records/:id/restore` restores that full chain before the 25-day deadline. Expired recovery attempts return 410 even if the physical cleanup has not run yet.
- Both require an authenticated same-origin request and the latest `expectedRevision`. An admin or the current assigned technician can perform them. A creator who only retains read access after reassignment cannot delete/restore the PM.
- The current latest row is locked in the transaction. Older versions cannot be deleted independently. Every affected row gets a revision increment and a `deleted`/`restored` event recording the actor and chain size.
- Deleted chains are excluded from active reports, detail/PDF/signature endpoints, and analytics. Trash lists the latest version only. Restoration preserves version links, attribution and signature dates; signature retention still applies.
- The confirmation dialog names the PM, model and serial, explains the whole-chain operation, and states that permanent cleanup happens after 25 days, and initially focuses **Keep PM**. Cancel/Escape preserve the PM; Escape is blocked during submission. Errors stay in the dialog.
- If the deleted chain was open in PM workspace, its local form is cleared without saving it back. A selected report is also cleared. Stale tabs cannot save over a deleted or restored PM because of deletion/revision checks.
- Reports provides Active reports / Trash and Restore PM; permanent deletion runs automatically after the recovery period.

## Validation

`tests/reports-management-integration.ts` uses a temporary PostgreSQL database with 27 paginated fixtures, including a brand/model outside page one. It verifies page size and non-overlap, full-dataset filters, invalid input, ownership and origin checks, optimistic conflicts, draft deletion/recovery, complete version-chain deletion/recovery, analytics counts, blocked deleted downloads, unchanged original signatures/payload and audit attribution.

Local browser QA uses only synthetic PM `PM-8BA59282-R2`: cancel the dialog, delete its two-version chain, verify removal from active results, restore from Trash and inspect both versions again. The PM is restored after verification.


## Automatic Trash retention

- Recovery is exactly 25 × 24 hours from `deleted_at`, calculated in UTC. It does not depend on the PM service/creation date, the browser clock or the number of records. Restoring removes the deletion timestamp; deleting again starts a new period.
- The confirmation dialog explains the permanent removal of the PM, its versions and signatures. Each Trash row shows its recovery deadline in the viewer’s local date/time.
- `instrumentation.ts` starts maintenance in the running Node server: immediately at startup and once every 24 hours. The timer is registered once per process, does not overlap itself, and is excluded from production builds. A PostgreSQL transaction advisory lock coordinates different server instances.
- Entering Reports also runs a bounded cleanup after authentication (`maintenance=1` on the first page request of that visit). Filtering, pagination, refreshes and CSV export do not request another Trash cleanup during that visit. Expired rows are excluded from Trash even if another maintenance process currently holds the cleanup lock.
- Each transaction handles up to 25 logical PM chains; the periodic worker handles up to 10 batches per run. It locks the latest version and then its ancestors, skips locked chains, and rechecks that every version is deleted and expired. Active, recently deleted, restored or inconsistent partial chains are preserved.
- One atomic deletion removes all PM versions. The existing database constraint cascades their PM events; unreferenced signature blobs are then removed in that same transaction. A blob still referenced by a different retained PM is preserved. Cleanup logs aggregate counts only.
- Signature expiration now locks selected rows and updates metadata/events in one transaction, preventing races with permanent Trash cleanup.
- Migration `0005_pm_trash_retention.sql` adds the `deleted_at` index for the expiry scan.
- For deployment environments without a persistent Node process, schedule `npm run trash:purge` with the host’s scheduler. The command uses the same policy and database lock; repeated runs are safe. No public or unauthenticated purge endpoint is exposed.

`tests/trash-retention-integration.ts` verifies the exact boundary (including DST), deletion age rather than creation age, retained/shared signatures, cascading events, version chains, locks, concurrent workers, idempotence, 25-PM batches, entry-based cleanup without repeating it for filters/pagination, authenticated recovery deadlines and the new period after restoring/deleting again. Current full suite: 22 tests pass.
