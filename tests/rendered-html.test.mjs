import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the CryoPM PM v0.2 Taylor-Wharton questionnaire", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "CryoPM · Cryogenics Solution Inc\."/);
  assert.match(page, /Preventive maintenance · PM v0\.2/);
  assert.match(page, /Equipment identification/);
  assert.match(page, /Lab name/);
  assert.match(page, /placeholder="Enter controller type"/);
  assert.match(page, /brand === "mve" && \(/);
  assert.match(page, /Folding steps are safe/);
  assert.match(page, /Annular lines are free of blockage/);
  assert.match(page, /Casters are free of cuts or abrasions/);
  assert.match(page, /All identification fields are required/);
  assert.doesNotMatch(layout, /codex-preview/i);
});

test("keeps brand-specific controls and numeric rules without credential fields", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Battery backup nominal value confirmed as 24 VDC/);
  assert.match(page, /Battery backup nominal value confirmed as 12 VDC/);
  assert.match(page, /MVE 1400 Series/);
  assert.match(page, /All pertinent alarms tested.+allowNA: false/);
  assert.match(page, /batteryMaximum = selectedEquipment\.batteryNominal \* 1\.1/);
  assert.match(page, /Battery anomaly · Below nominal voltage/);
  assert.match(page, /Document the battery anomaly in Operation observations/);
  assert.match(page, /62, max: 74/);
  assert.match(page, /28, max: 38/);
  assert.match(page, /135, max: 145/);
  assert.match(page, /Difference ≤ 0\.5 in/);
  assert.match(page, /Thermocouple resistance confirmed/);
  assert.match(page, /Temperature resistance confirmed/);
  assert.match(page, /High Temperature A-B/);
  assert.match(page, /Temperature values must be negative/);
  assert.match(page, /Negative values are not allowed for this measurement/);
  assert.match(page, /Letters are not allowed/);
  assert.match(page, /Gas Bypass Time Delay/);
  assert.match(page, /Maximum Fill Time/);
  assert.match(page, /Event Log Interval/);
  assert.doesNotMatch(page, /Global Password/);
  assert.doesNotMatch(page, /globalPassword/);
  assert.doesNotMatch(page, /Controller credential verified/);
});

test("includes D1 draft persistence, audit history and data minimization", async () => {
  const [page, schema, sharedRoute, collectionRoute, recordRoute, signatureRoute, identityRoute, retentionRoute, hosting, migration, signatureMigration, technicianSignatureMigration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/_shared.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/[id]/signature/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/_identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/_retention.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_initial_pm_backend.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_signature_privacy.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_technician_signature.sql", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "SIGNATURES"/);
  assert.match(schema, /sqliteTable\(\s*"pm_records"/);
  assert.match(schema, /sqliteTable\(\s*"pm_events"/);
  assert.match(schema, /recipientSignatureRetentionUntil/);
  assert.match(schema, /technicianSignatureRetentionUntil/);
  assert.match(schema, /ownerSubject/);
  assert.match(sharedRoute, /MAX_PAYLOAD_BYTES = 128_000/);
  assert.match(sharedRoute, /password\|credential\|patient\|sample\|clinical/);
  assert.match(collectionRoute, /eventType: "created"/);
  assert.doesNotMatch(collectionRoute, /ownerEmail:\s*actor/);
  assert.doesNotMatch(recordRoute, /actorEmail,\s*revision/);
  assert.match(recordRoute, /eventType: "draft_saved"/);
  assert.match(recordRoute, /status: 409/);
  assert.match(recordRoute, /A signed PM cannot be edited/);
  assert.match(identityRoute, /HMAC/);
  assert.match(identityRoute, /IDENTITY_HMAC_SECRET/);
  assert.match(signatureRoute, /PM_RECEIPT_V1/);
  assert.match(signatureRoute, /PM_TECHNICIAN_RESPONSIBILITY_V1/);
  assert.match(signatureRoute, /setUTCFullYear\(retentionUntil\.getUTCFullYear\(\) \+ SIX_YEARS\)/);
  assert.match(signatureRoute, /image\/png/);
  assert.match(signatureRoute, /signature_captured/);
  assert.match(signatureRoute, /A signed PM cannot be signed again/);
  assert.match(retentionRoute, /signature_deleted/);
  assert.match(page, /PM recipient signature/);
  assert.match(page, /Responsible PM technician signature/);
  assert.match(page, /I performed or supervised the preventive maintenance/);
  assert.match(page, /The technician name and both signatures are retained for six years/);
  assert.match(page, /Recipient names, email addresses, IP addresses, drawing pressure, speed and timing are not collected/);
  assert.match(page, /I confirm receipt of the preventive maintenance documented in this PM/);
  assert.match(page, /fetch\(draftId \? `\/api\/pm-records\/\$\{draftId\}` : "\/api\/pm-records"/);
  assert.match(page, /Draft saved/);
  assert.match(migration, /CREATE TABLE `pm_records`/);
  assert.match(migration, /CREATE TABLE `pm_events`/);
  assert.match(signatureMigration, /SET `owner_email` = NULL/);
  assert.match(signatureMigration, /SET `actor_email` = NULL/);
  assert.match(signatureMigration, /recipient_signature_retention_until/);
  assert.match(technicianSignatureMigration, /technician_signature_retention_until/);
  assert.match(technicianSignatureMigration, /pm_records_technician_signature_retention_idx/);
});

test("activates Overview, Equipment and Reports with protected PM records", async () => {
  const [page, collectionRoute, recordRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/[id]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type WorkspaceView = "overview" \| "orders" \| "equipment" \| "reports"/);
  assert.match(page, /function OverviewView/);
  assert.match(page, /function EquipmentView/);
  assert.match(page, /function ReportsView/);
  assert.match(page, /Maintenance control center/);
  assert.match(page, /Equipment registry/);
  assert.match(page, /Export filtered CSV/);
  assert.match(page, /Print or save full PM PDF/);
  assert.match(page, /signature\?role=technician/);
  assert.match(page, /signature\?role=recipient/);
  assert.match(page, /fetch\("\/api\/pm-records"/);
  assert.match(page, /fetch\(`\/api\/pm-records\/\$\{record\.id\}`/);
  assert.match(collectionRoute, /technicianSignatureCapturedAt/);
  assert.match(collectionRoute, /recipientSignatureCapturedAt/);
  assert.match(collectionRoute, /controllerType/);
  assert.match(collectionRoute, /location/);
  assert.match(recordRoute, /await purgeExpiredSignatures\(\)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
});

test("prints a complete brand-specific PM rather than a summary-only PDF", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const section of ["Construction", "Operation", "Verification", "Examination", "Service closure"]) {
    assert.match(page, new RegExp(`reportSectionHeading\\(\\"\\d{2}\\", \\"${section}\\"\\)`));
  }
  assert.match(page, /checklistTable\("construction", constructionItems\)/);
  assert.match(page, /checklistTable\("operation", operationItems\[record\.brand\]\)/);
  assert.match(page, /checklistTable\("verification", verificationItems\[record\.brand\]\)/);
  assert.match(page, /singleValveResistance/);
  assert.match(page, /thermocouple resistance confirmed/i);
  assert.match(page, /examValue\("highTemperature"/);
  assert.match(page, /examValue\("eventLogInterval"/);
  assert.match(page, /signature\?role=technician/);
  assert.match(page, /signature\?role=recipient/);
  assert.match(css, /\.pmReportPage \{ min-height: 245mm/);
  assert.match(css, /\.reportAuditSection \{ display: none !important; \}/);
});

test("includes CryoVerse models, report identity, and ordered examination limits", async () => {
  const [page, signatureRoute, collectionRoute, retentionRoute, partiesMigration] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/[id]/signature/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/_retention.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_pm_parties.sql", import.meta.url), "utf8"),
  ]);

  assert.match(page, /HE Series CryoVerse Connect/);
  assert.match(page, /1894R-190/);
  assert.match(page, /anyInsteadOfNo: true/);
  assert.match(page, /"battery-voltage", event\.target\.value, setBatteryVoltage, "signed"/);
  assert.match(page, /temperatureOrderValid &&/);
  assert.match(page, /levelAlarmOrderValid &&/);
  assert.match(page, /levelSetPointOrderValid;/);
  assert.match(page, /Filter equipment by serial number/);
  assert.match(page, /Filter reports by technician/);
  assert.match(page, /PM date from/);
  assert.match(page, /PM execution date/);
  assert.match(page, /reportCoverFacts/);
  assert.match(signatureRoute, /validateExaminationOrder\(parsePayload\(record\.payloadJson\)\)/);
  assert.match(signatureRoute, /technicianName: input\.technicianName/);
  assert.match(collectionRoute, /technicianName: pmRecords\.technicianName/);
  assert.match(retentionRoute, /technicianName: null/);
  assert.match(partiesMigration, /client_organization/);
  assert.match(partiesMigration, /technician_name/);
  assert.match(partiesMigration, /performed_on/);
});
