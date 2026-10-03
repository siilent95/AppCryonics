import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function readUi() {
 const paths = ["types.ts", "catalogs.ts", "helpers.ts", "usePmWorkspace.ts", "PmWorkspace.tsx", "MaintenanceForm.tsx", ...(await readdir(new URL("../features/pm/components/", import.meta.url))).map(n => "components/" + n)];
 return (await Promise.all(paths.map(p => readFile(new URL("../features/pm/" + p, import.meta.url), "utf8")))).join("\n");
}

test("defines the CryoPM PM v0.2 Taylor-Wharton questionnaire", async () => {
  const [page, layout] = await Promise.all([
    readUi(),
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
  const page = await readUi();

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

test("activates Overview, Equipment and Reports with protected PM records", async () => {
  const [page, collectionRoute, recordRoute] = await Promise.all([
    readUi(),
    readFile(new URL("../app/api/pm-records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/[id]/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type WorkspaceView = "overview" \| "orders" \| "equipment" \| "reports"/);
  assert.match(page, /function OverviewView/);
  assert.match(page, /function EquipmentView/);
  assert.match(page, /function ReportsView/);
  assert.match(page, /Alerts &amp; service facts/);
  assert.match(page, /kairosProductStage/);
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
    readUi(),
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
    readUi(),
    readFile(new URL("../app/api/pm-records/[id]/signature/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/pm-records/_retention.ts", import.meta.url), "utf8"),
    readFile(new URL("../legacy-sqlite/0003_pm_parties.sql", import.meta.url), "utf8"),
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
