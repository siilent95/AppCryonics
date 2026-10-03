# PostgreSQL migration branch

This branch replaces Sites/Cloudflare with Next.js on Node.js and PostgreSQL. It does not modify or delete the published beta, access its private data, or merge into the original branch.

## Local development

1. Install Node.js 22.13+ and PostgreSQL 17+, or Docker.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`; choose your local database password and update `DATABASE_URL`.
4. For Docker PostgreSQL, set `POSTGRES_PASSWORD` in the shell and run `docker compose up -d db`. Otherwise create a database and user in PostgreSQL.
5. Run `npm run db:migrate`. Drizzle tracks migrations; rerunning is safe.
6. Set `CRYOPM_BOOTSTRAP_PASSWORD` temporarily; run `npm run user:create -- technician@example.com "Technician name"`. Remove the variable afterward. Accounts have individual PM records. There is no public registration or password recovery in this initial migration.
7. Run `npm run dev`; open `http://localhost:3000`.

PostgreSQL stores signatures as `bytea`; database backups include them. No R2 or application filesystem volume is needed. Plan database capacity and backups as usage grows.

## Independent production

Use persistent PostgreSQL and a Node.js host, VM or container platform supporting Next.js. Configure `DATABASE_URL` with provider-required TLS (e.g. `sslmode=verify-full`) and `APP_ORIGIN=https://your-domain`. Terminate HTTPS at the host or reverse proxy. External identity headers are not trusted.

Run `npm ci` and `npm run db:migrate` from the release checkout with target database configuration before starting the application. Migrations are a release step. Create the first account using the CLI. Build with `npm run build`; run with `npm start`, or build the Dockerfile and pass environment variables to the container. The runtime image excludes migration tooling; execute migrations separately from the release checkout.

Random session tokens are stored hashed, expire after 12 hours, and use HttpOnly/SameSite cookies. Public production requires HTTPS. Mutations require an Origin matching `APP_ORIGIN`. Login has a database-backed account rate limit. Disabling an account invalidates its access immediately.

Back up PostgreSQL before migrations. Do not switch production until beta exports have been imported and reconciled. Retiring the old beta is a separate action.

## Import existing D1/R2 data

The repository contains code, not private beta records or signatures. Data transfer requires an authorized export.

1. Export D1 as a SQLite snapshot or SQLite SQL dump; export R2 objects preserving key paths (`pm-signatures/...`). Keep source exports unchanged.
2. Apply the PostgreSQL schema and create destination accounts.
3. Create a private JSON mapping from every old `owner_subject`/`actor_subject` to an existing destination account UUID. Include historical actors and confirm assignments with the owner.
4. Run `npm run db:import -- --source backup.sqlite --owners owners.json --signatures exported-r2`. A `.sql` dump is also accepted.
5. Default mode validates an empty target, ownership, contained signature paths, checksums and constraints, then rolls back inserts. Timestamps become UTC ISO; event IDs and revisions are preserved; old email columns are cleared.
6. Repeat with `--apply` to import. Reconcile counts and test each account. Missing or mismatched active signatures abort the import without partial data.

The old SQLite migrations in `legacy-sqlite/` are reference only; do not run them against PostgreSQL.

## Verification and interface

Run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test`. Tests launch real PostgreSQL 17 on loopback port 15432, apply migrations twice, and exercise accounts, ownership, origin checks, revision conflicts, signatures and retention. The server stops after tests; temporary database files stay in ignored `work/`. Docker build and deployment are separate host-specific checks.

Run `npm run test:http` to build and verify real production HTTP login, protected pages/API, and logout against the temporary PostgreSQL database. The application listens on loopback port 3100 only during that test.

Validation on Windows with Node.js 24: production build and strict TypeScript checks passed; real PostgreSQL API, data import and production HTTP authentication tests passed. Lint has no errors and retains warnings for the existing native image markup. Production dependency audit reports no vulnerabilities. The development-tool audit still reports nine advisories in ESLint/Drizzle transitive dependencies; automatic forced fixes propose incompatible downgrades and were not applied. Docker packaging is supplied but not executed because Docker is unavailable on this host.

- `app/page.tsx`: server-side account guard and entry.
- `features/pm/PmWorkspace.tsx`: navigation and workspace layout.
- `features/pm/MaintenanceForm.tsx`: maintenance forms and service closure.
- `features/pm/usePmWorkspace.ts`: workflow state, validation, API calls and actions.
- `features/pm/components/`: Overview, Equipment, Reports, full report preview, signature pad and controls.
- `features/pm/catalogs.ts`: model catalogue and questionnaires.
- `features/pm/types.ts`: domain types.
- `features/pm/helpers.ts`: numeric rules, labels and formatting.

Questionnaires, signature consent and complete printable reports retain existing behavior. PDF generation remains browser printing; automatic PDF archival is outside this migration.
