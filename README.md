# CryoPM

This migration branch runs independently with Next.js, React, TypeScript, Node.js, PostgreSQL and Drizzle ORM. PostgreSQL stores PM records, audit history, accounts, sessions and signature images. Sites and Cloudflare are no longer runtime requirements.

See [local setup, deployment, data import and checks](docs/postgresql-migration.md).

For a persistent local test environment without Docker, see [local development](docs/local-development.md) and run `npm run dev:local` after installing dependencies.

The local app implements the approved full-window A2 interface with account-scoped maintenance analytics, shared date/brand filters and paginated chart details. See [interface decisions](docs/interface-study.md) and [metric definitions and validation](docs/overview-dashboard-research.md).

The published beta and its data are unchanged. Actual data transfer requires a beta export and ownership mapping. Completed PMs download directly as PDF through a protected endpoint; no browser print dialog is used. See [PDF downloads and local QA](docs/pdf-downloads.md).

Administrators can manage accounts through private activation links and assign PMs. Technicians can read records they created or currently own; only the current assignee can edit draft content. Administrators can read all records and analytics. See [accounts and permissions](docs/account-management-proposal.md).

Equipment is an independent shared model catalog with admin-managed brands, PM template assignments, model images and uploaded datasheets. PM selections come from the catalog; documents open in a self-hosted PDF.js viewer. See [equipment catalog and sources](docs/equipment-catalog.md).

Before a field pilot with real data, review the [security findings, verified fixes and deployment requirements](docs/security-review-2026-10-27.md). A reverse-proxy configuration example is in `deploy/nginx-cryopm.conf.example`; it has not been deployed or validated against a customer server.

License: GPL-3.0 for project code; manufacturer assets retain their respective rights. See LICENSE.
