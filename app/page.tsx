"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Result = "yes" | "no" | "na" | "any" | null;
type StepKey = "construction" | "operation" | "verification" | "examination" | "review";
type InspectionStep = Exclude<StepKey, "review">;
type BrandKey = "taylor" | "mve";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type CompletionStatus = "idle" | "completing" | "completed" | "error";
type WorkspaceView = "overview" | "orders" | "equipment" | "reports";
type RecordsStatus = "idle" | "loading" | "loaded" | "error";
type PmStatus = "draft" | "ready_for_signature" | "completed" | "archived";
type SavedRecord = {
  id: string;
  recordNumber: string;
  revision: number;
};
type PmRecordSummary = {
  id: string;
  recordNumber: string;
  brand: BrandKey;
  modelFamily: string;
  model: string;
  facility: string | null;
  labName: string | null;
  clientOrganization: string | null;
  technicianName: string | null;
  performedOn: string | null;
  freezerSerial: string | null;
  controllerSerial: string | null;
  location: string | null;
  controllerType: string | null;
  status: PmStatus;
  currentStep: string;
  revision: number;
  recipientSignatureCapturedAt: string | null;
  recipientSignatureRetentionUntil: string | null;
  recipientSignatureDeletedAt: string | null;
  technicianSignatureCapturedAt: string | null;
  technicianSignatureRetentionUntil: string | null;
  technicianSignatureDeletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
type ReportPayload = {
  responses?: Record<string, Result>;
  notes?: Partial<NotesState>;
  measurements?: Record<string, string | null>;
  examination?: Partial<ExamValues>;
  flags?: Record<string, boolean>;
};
type ReportDetail = {
  record: PmRecordSummary & {
    firmwareVersion: string | null;
    templateVersion: string;
    payload: ReportPayload;
  };
  events: Array<{
    eventType: string;
    revision: number;
    createdAt: string;
  }>;
};
type EquipmentRegistryItem = PmRecordSummary & {
  historyCount: number;
  completedCount: number;
};
type ModelFamily = {
  family: string;
  models: readonly string[];
};
type ChecklistItem = {
  id: string;
  label: string;
  help: string;
  batteryDependent?: boolean;
  allowNA?: boolean;
  anyInsteadOfNo?: boolean;
};
type NotesState = Record<InspectionStep | "general", string>;
type ExamValues = {
  highTemperature: string;
  lowTemperature: string;
  highLevelAlarm: string;
  highLevelSetPoint: string;
  lowLevelSetPoint: string;
  lowLevelAlarm: string;
  gasBypassTemperature: string;
  gasBypassDelay: string;
  maximumFillTime: string;
  eventLogInterval: string;
  temperatureUnit: string;
  levelUnit: string;
};

const steps: { key: StepKey; label: string; short: string }[] = [
  { key: "construction", label: "Construction", short: "01" },
  { key: "operation", label: "Operation", short: "02" },
  { key: "verification", label: "Verification", short: "03" },
  { key: "examination", label: "Examination", short: "04" },
  { key: "review", label: "Review", short: "05" },
];

const constructionItems: readonly ChecklistItem[] = [
  { id: "turn-tray", label: "Turn tray rotates without restrictions", help: "Check the complete rotation path." },
  { id: "neck-vacuum", label: "No signs of vacuum deterioration on the neck", help: "Inspect frost, condensation and visible deterioration." },
  { id: "relief-valve", label: "Relief valve is present between supply and unit", help: "Confirm placement and visible condition.", anyInsteadOfNo: true },
  { id: "lid-core", label: "Lid core is free of cracks", help: "Inspect the complete lid core." },
  { id: "folding-steps", label: "Folding steps are safe", help: "Check stability, movement and visible damage." },
  { id: "annular-lines", label: "Annular lines are free of blockage", help: "Verify that the lines are unobstructed." },
  { id: "casters", label: "Casters are free of cuts or abrasions", help: "Inspect every caster and its rolling surface." },
];

const operationItems: Record<BrandKey, readonly ChecklistItem[]> = {
  mve: [
    { id: "three-way-valve", label: "3-way valve inspected", help: "Perform visual and functional inspection." },
    { id: "bypass-sensor", label: "Bypass sensor inspected", help: "Inspect the sensor and its connection." },
    { id: "electrical-connections", label: "All electrical connections inspected", help: "Check visible connections and wiring." },
    { id: "solenoid-operation", label: "Solenoid valve operation confirmed", help: "Verify correct operation during the functional test." },
    { id: "battery-present", label: "Battery backup is present", help: "Select No when the unit has no battery backup." },
    { id: "battery-connections", label: "Battery backup connections inspected and tested", help: "Required when battery backup is present.", batteryDependent: true },
    { id: "battery-controller", label: "Controller runs on battery backup without main power", help: "Disconnect main power according to the approved procedure.", batteryDependent: true },
    { id: "battery-nominal", label: "Battery backup nominal value confirmed as 24 VDC", help: "The PM documents 24 VDC as the nominal MVE value.", batteryDependent: true },
    { id: "battery-voltage-confirmed", label: "Measured battery output voltage confirmed", help: "Record the measured voltage below.", batteryDependent: true },
  ],
  taylor: [
    { id: "asco-valve", label: "ASCO solenoid valve opens and closes", help: "Perform the complete open and close test." },
    { id: "unusual-noise", label: "Solenoid valve is free of unusual noise", help: "Listen during opening and closing." },
    { id: "electrical-connections", label: "All electrical connections inspected", help: "Check visible connections and wiring." },
    { id: "visual-deterioration", label: "Solenoid has no signs of visual deterioration", help: "Inspect the body, coil and connections." },
    { id: "solenoid-operation", label: "Solenoid valve operation confirmed", help: "Confirm the functional test result." },
    { id: "battery-present", label: "Battery backup is present", help: "Select No when the unit has no battery backup." },
    { id: "battery-connections", label: "Battery backup connections inspected and tested", help: "Required when battery backup is present.", batteryDependent: true },
    { id: "battery-controller", label: "Controller runs on battery backup without main power", help: "Disconnect main power according to the approved procedure.", batteryDependent: true },
    { id: "battery-nominal", label: "Battery backup nominal value confirmed as 12 VDC", help: "The PM documents 12 VDC as the nominal Taylor-Wharton value.", batteryDependent: true },
    { id: "battery-voltage-confirmed", label: "Measured battery output voltage confirmed", help: "Record the measured voltage below.", batteryDependent: true },
  ],
};

const verificationItems: Record<BrandKey, readonly ChecklistItem[]> = {
  mve: [
    { id: "temperature-correct", label: "Temperature A and B are correct", help: "Compare both displayed temperatures with the approved reference." },
    { id: "bypass-temperature", label: "Gas bypass temperature is correct", help: "Verify the bypass temperature reading." },
    { id: "alarms", label: "All pertinent alarms tested", help: "The PM technician determines the applicable alarms.", allowNA: false },
    { id: "automatic-low-fill", label: "Unit automatically fills at the low-level setpoint", help: "Verify the automatic fill start." },
    { id: "automatic-high-stop", label: "Unit automatically stops filling at the high-level setpoint", help: "Verify the automatic fill stop." },
  ],
  taylor: [
    { id: "temperature-correct", label: "Temperature is correct", help: "Compare the displayed temperature with the approved reference." },
    { id: "bypass-temperature", label: "Gas bypass temperature is correct", help: "Verify the bypass temperature reading." },
    { id: "alarms", label: "All pertinent alarms tested", help: "The PM technician determines the applicable alarms.", allowNA: false },
    { id: "automatic-low-fill", label: "Unit automatically fills at the low-level setpoint", help: "Verify the automatic fill start." },
    { id: "automatic-high-stop", label: "Unit automatically stops filling at the high-level setpoint", help: "Verify the automatic fill stop." },
  ],
};

const modelCatalog: Record<BrandKey, readonly ModelFamily[]> = {
  mve: [
    { family: "HEco 800 Series", models: ["815P-190", "818P-190", "819P-190"] },
    { family: "HEco 1500 Series", models: ["1536P-190", "1539P-190", "1542R-190"] },
    { family: "High Efficiency 800", models: ["815P-190", "819P-190"] },
    { family: "High Efficiency 1500", models: ["1536P-190", "1539P-190", "1542R-190"] },
    { family: "HE Series CryoVerse Connect", models: ["815P-190", "1536P-190", "1542R-190", "1892P-190", "1894R-190"] },
    { family: "MVE 1400 Series", models: ["MVE 1400 Series"] },
    { family: "MVE Series", models: ["205", "510", "616", "1426", "1839"] },
  ],
  taylor: [
    { family: "K-Series", models: ["3K", "10K", "24K", "38K"] },
    { family: "LABS Precision", models: ["20K", "38K", "40K", "80K", "94K"] },
  ],
};

const equipment = {
  taylor: {
    label: "Taylor-Wharton",
    initials: "TW",
    order: "PM-DRAFT-0047",
    template: "TW-KRYOS · v0.2",
    room: { min: 6, max: 7.5 },
    cryo: { min: 15, max: 30 },
    batteryNominal: 12,
  },
  mve: {
    label: "MVE",
    initials: "MV",
    order: "PM-DRAFT-0048",
    template: "MVE-HECO · v0.2",
    room: { min: 1000, max: 1100 },
    cryo: { min: 200, max: 300 },
    batteryNominal: 24,
  },
} as const;

const emptyNotes: NotesState = {
  construction: "",
  operation: "",
  verification: "",
  examination: "",
  general: "",
};

const emptyExam: ExamValues = {
  highTemperature: "",
  lowTemperature: "",
  highLevelAlarm: "",
  highLevelSetPoint: "",
  lowLevelSetPoint: "",
  lowLevelAlarm: "",
  gasBypassTemperature: "",
  gasBypassDelay: "",
  maximumFillTime: "",
  eventLogInterval: "",
  temperatureUnit: "",
  levelUnit: "",
};

function controllerOptions(brand: BrandKey, family: string, model: string): readonly string[] {
  if (brand === "mve") {
    if (family === "HE Series CryoVerse Connect") return ["CryoVerse Connect"];
    return family.startsWith("HEco") ? ["MVE Touch Screen", "TEC 3000"] : ["TEC 3000"];
  }
  if (family === "LABS Precision") return ["LABS Precision PLC"];
  if (model === "3K") return ["Not installed"];
  if (model === "38K") return ["CS200"];
  return ["CS100", "CS200"];
}

function hasNumber(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

function hasNonNegativeNumber(value: string) {
  return hasNumber(value) && Number(value) >= 0;
}

function hasNegativeNumber(value: string) {
  return hasNumber(value) && Number(value) < 0;
}

function inOpenRange(value: string, min: number, max: number) {
  return hasNumber(value) && Number(value) > min && Number(value) < max;
}

function normalizeDecimal(value: string, allowNegative: boolean) {
  const sign = allowNegative && value.trimStart().startsWith("-") ? "-" : "";
  const unsigned = value.replace(/[^\d.]/g, "");
  const [whole, ...decimals] = unsigned.split(".");
  const normalized = decimals.length > 0 ? `${whole}.${decimals.join("")}` : whole;
  return `${sign}${normalized}`;
}

function Choice({ value, onChange, label, disabled = false, allowNA = true, anyInsteadOfNo = false }: { value: Result; onChange: (value: Exclude<Result, null>) => void; label: string; disabled?: boolean; allowNA?: boolean; anyInsteadOfNo?: boolean }) {
  const options: Array<Exclude<Result, null>> = allowNA ? ["yes", anyInsteadOfNo ? "any" : "no", "na"] : ["yes", anyInsteadOfNo ? "any" : "no"];
  return (
    <div className="choiceGroup" aria-label={`${label} result`}>
      {options.map((option) => (
        <button
          aria-pressed={value === option}
          className={`choice ${value === option ? `active ${option}` : ""}`}
          disabled={disabled}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === "yes" ? "Yes" : option === "no" ? "No" : option === "any" ? "Any" : "N/A"}
        </button>
      ))}
    </div>
  );
}

function NavIcon({ label }: { label: string }) {
  return <span className="navIcon">{label.slice(0, 2).toUpperCase()}</span>;
}

function SignaturePad({
  ariaLabel,
  disabled,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function beginSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const start = point(event);
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(start.x, start.y);
  }

  function continueSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#172b3a";
    context.lineTo(next.x, next.y);
    context.stroke();
    hasInkRef.current = true;
  }

  function finishSignature(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (hasInkRef.current) onChange(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || disabled) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    hasInkRef.current = false;
    onChange("");
  }

  return (
    <div className={`signaturePad ${disabled ? "disabled" : ""}`}>
      <canvas
        aria-label={ariaLabel}
        height="240"
        onPointerCancel={finishSignature}
        onPointerDown={beginSignature}
        onPointerMove={continueSignature}
        onPointerUp={finishSignature}
        ref={canvasRef}
        role="img"
        width="900"
      />
      <div className="signatureLine"><span>Sign inside the box</span><button disabled={disabled} onClick={clearSignature} type="button">Clear</button></div>
    </div>
  );
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Not recorded";
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return "Not recorded";
  return includeTime ? parsed.toLocaleString() : parsed.toLocaleDateString();
}

function pmDate(record: PmRecordSummary) {
  return record.performedOn || record.technicianSignatureCapturedAt || record.recipientSignatureCapturedAt;
}

function localDateKey(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("sv-SE");
}

function freezerImage(brand: BrandKey, family: string, model: string) {
  if (brand === "taylor") {
    return family === "LABS Precision"
      ? { src: "/freezers/taylor-labs.webp", exact: model === "94K" }
      : { src: "/freezers/taylor-k.webp", exact: false };
  }
  if (family === "HE Series CryoVerse Connect") {
    if (model === "815P-190") return { src: "/freezers/cryoverse-815.webp", exact: true };
    if (model === "1536P-190") return { src: "/freezers/cryoverse-1536.webp", exact: true };
    if (model === "1892P-190") return { src: "/freezers/cryoverse-1892.webp", exact: true };
    return { src: model === "1542R-190" ? "/freezers/cryoverse-1536.webp" : "/freezers/cryoverse-1892.webp", exact: false };
  }
  if (family === "HEco 800 Series") return { src: "/freezers/mve-heco-800.webp", exact: false };
  if (family === "HEco 1500 Series") return { src: "/freezers/mve-he-1500.webp", exact: false };
  if (family === "High Efficiency 800") return { src: "/freezers/mve-he-800.webp", exact: false };
  if (family === "High Efficiency 1500") return { src: "/freezers/mve-he-1500.webp", exact: false };
  return { src: "/freezers/mve-series.webp", exact: false };
}

function brandLabel(brand: BrandKey) {
  return brand === "mve" ? "MVE" : "Taylor-Wharton";
}

function statusLabel(status: PmStatus) {
  if (status === "completed") return "Completed";
  if (status === "ready_for_signature") return "Ready for signatures";
  if (status === "archived") return "Archived";
  return "Draft";
}

function RecordsMessage({
  error,
  onRetry,
  status,
}: {
  error: string;
  onRetry: () => void;
  status: RecordsStatus;
}) {
  if (status === "loading" || status === "idle") {
    return <div className="viewMessage"><strong>Loading PM records</strong><span>Retrieving the protected maintenance history.</span></div>;
  }
  if (status === "error") {
    return (
      <div className="viewMessage error">
        <strong>PM records could not be loaded</strong>
        <span>{error}</span>
        <button onClick={onRetry} type="button">Try again</button>
      </div>
    );
  }
  return null;
}

function OverviewView({
  error,
  onNavigate,
  onRetry,
  records,
  status,
}: {
  error: string;
  onNavigate: (view: WorkspaceView) => void;
  onRetry: () => void;
  records: PmRecordSummary[];
  status: RecordsStatus;
}) {
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const completed = records.filter((record) => record.status === "completed");
  const open = records.filter((record) => record.status !== "completed" && record.status !== "archived");
  const equipmentKeys = new Set(
    records.map((record) => `${record.brand}:${record.freezerSerial?.trim().toUpperCase() || record.id}`),
  );
  const completionRate = records.length === 0 ? 0 : Math.round((completed.length / records.length) * 100);
  const mveCount = records.filter((record) => record.brand === "mve").length;
  const taylorCount = records.filter((record) => record.brand === "taylor").length;
  const readyForExport = completed.filter((record) =>
    record.technicianSignatureCapturedAt && !record.technicianSignatureDeletedAt &&
    record.recipientSignatureCapturedAt && !record.recipientSignatureDeletedAt,
  );
  const signaturePending = records.filter((record) => record.status === "ready_for_signature");
  const featured = completed[0] ?? records[0];
  const featuredImage = featured
    ? freezerImage(featured.brand, featured.modelFamily, featured.model)
    : { src: "/freezers/mve-heco-800.webp", exact: false };
  const recent = records.filter((record) => record.status !== "archived").slice(0, 3);

  return (
    <div className="kairosOverview" aria-label="Maintenance overview">
      <div className="kairosOverviewGrid">
        <div className="kairosOverviewRail">
          <section className="kairosPanel kairosActivityPanel">
            <h1>Alerts &amp; service facts</h1>
            <div className="kairosActivityList">
              {recent.length === 0 ? <p className="kairosEmpty">No PM activity yet. Start a PM to populate this dashboard.</p> : recent.map((record) => (
                <button className="kairosActivity" key={record.id} onClick={() => onNavigate("reports")} type="button">
                  <span className="kairosDot" aria-hidden="true" />
                  <span><strong>{statusLabel(record.status)} · {record.recordNumber}</strong><small>{brandLabel(record.brand)} {record.model} · {record.labName || "Lab pending"}</small></span>
                </button>
              ))}
            </div>
            <div className="kairosFacts"><div><strong>{equipmentKeys.size}</strong><span>Equipment</span></div><div><strong>{records.length}</strong><span>PMs</span></div><div><strong>{open.length}</strong><span>Open</span></div></div>
          </section>
          <section className="kairosPanel kairosProgressPanel">
            <h2>PM completion</h2><p>Completed records</p>
            <div className="kairosProgressBody"><div className="kairosRing" style={{ background: `conic-gradient(var(--cyan) 0 ${completionRate}%, rgba(255,255,255,.15) ${completionRate}% 100%)` }}><span>{completionRate}%</span></div><div><strong>{completed.length} completed</strong><small>of {records.length} PM records</small></div></div>
            <button className="kairosCta" onClick={() => onNavigate("reports")} type="button">View reports</button>
          </section>
        </div>

        <section className="kairosProductStage" aria-label="Featured freezer">
          <div className="kairosProductTop"><span>Featured equipment / {featured?.modelFamily || "MVE and Taylor-Wharton"}</span>{featured && <b>{featured.model}</b>}</div>
          <div className="kairosProductHalo" aria-hidden="true" />
          <div className="kairosProductImage" role="img" aria-label={featured ? `${brandLabel(featured.brand)} ${featured.model} freezer reference` : "MVE freezer reference"} style={{ backgroundImage: `url("${featuredImage.src}")` }} />
          {featured && <div className="kairosProductDate"><span>LAST PM</span><strong>{formatDate(pmDate(featured))}</strong><small>{statusLabel(featured.status)}</small></div>}
          <div className="kairosProductFooter"><div><strong>{featured ? `${brandLabel(featured.brand)} ${featured.modelFamily}` : "MVE and Taylor-Wharton"}</strong><span>{featured ? `${featured.labName || "Lab pending"} · ${featured.freezerSerial || "Serial pending"} · ${statusLabel(featured.status)}` : "Start the first PM to see equipment details"}</span></div><button onClick={() => onNavigate(featured ? "equipment" : "orders")} type="button">{featured ? "View equipment" : "Start a PM"}</button></div>
        </section>

        <div className="kairosOverviewRail">
          <section className="kairosPanel kairosMetricPanel"><h2>PM activity</h2><strong className="kairosBigNumber">{completed.length}</strong><p>completed records</p><div className="kairosMeter" aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i className={index < Math.round(completionRate * 14 / 100) ? "" : "dim"} key={index} />)}</div></section>
          <section className="kairosPanel kairosBrandPanel"><h2>PM records by brand</h2><div className="kairosBrandRow"><span>MVE</span><strong>{mveCount}</strong><i><b style={{ width: `${records.length ? (mveCount / records.length) * 100 : 0}%` }} /></i></div><div className="kairosBrandRow"><span>Taylor-Wharton</span><strong>{taylorCount}</strong><i><b style={{ width: `${records.length ? (taylorCount / records.length) * 100 : 0}%` }} /></i></div></section>
          <section className="kairosPanel kairosClosurePanel"><h2>Report closure</h2><div><span>Signed reports ready</span><strong>{readyForExport.length}</strong></div><div><span>Pending signature</span><strong>{signaturePending.length}</strong></div><div><span>Open work</span><strong>{open.length}</strong></div><button onClick={() => onNavigate("reports")} type="button">Open report queue</button></section>
        </div>
      </div>
    </div>
  );
}

function EquipmentView({
  equipmentRecords,
  error,
  onNavigate,
  onRetry,
  status,
}: {
  equipmentRecords: EquipmentRegistryItem[];
  error: string;
  onNavigate: (view: WorkspaceView) => void;
  onRetry: () => void;
  status: RecordsStatus;
}) {
  const [query, setQuery] = useState("");
  const [serialFilter, setSerialFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState<"all" | BrandKey>("all");
  const [selectedKey, setSelectedKey] = useState("");
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = equipmentRecords.filter((record) => {
    const matchesBrand = brandFilter === "all" || record.brand === brandFilter;
    const searchable = [
      record.freezerSerial,
      record.modelFamily,
      record.model,
      record.labName,
      record.location,
      record.controllerType,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesBrand && (!normalizedQuery || searchable.includes(normalizedQuery)) && (!serialFilter.trim() || (record.freezerSerial || "").toLowerCase().includes(serialFilter.trim().toLowerCase()));
  });
  const selectedRecord = filtered.find((record) => `${record.brand}:${record.freezerSerial || record.id}` === selectedKey) ?? filtered[0];
  const selectedImage = selectedRecord ? freezerImage(selectedRecord.brand, selectedRecord.modelFamily, selectedRecord.model) : null;

  return (
    <div className="managementView">
      <section className="viewHero">
        <div>
          <div className="eyebrow">Equipment registry</div>
          <h1>Equipment</h1>
          <p>Freezers are created from saved PM identification records. Models remain controlled by the approved MVE and Taylor-Wharton lists.</p>
        </div>
        <div className="viewCount"><strong>{equipmentRecords.length}</strong><span>Tracked units</span></div>
      </section>

      <div className="kairosEquipmentLayout"><section className="dataPanel">
        <div className="filterBar">
          <label><span>Search equipment</span><input onChange={(event) => setQuery(event.target.value)} placeholder="Serial, model, lab or location" value={query} /></label>
          <label><span>Serial number</span><input aria-label="Filter equipment by serial number" onChange={(event) => setSerialFilter(event.target.value)} placeholder="Enter freezer serial" value={serialFilter} /></label>
          <label><span>Brand</span><select onChange={(event) => setBrandFilter(event.target.value as "all" | BrandKey)} value={brandFilter}><option value="all">All brands</option><option value="mve">MVE</option><option value="taylor">Taylor-Wharton</option></select></label>
        </div>
        <div className="tableWrap">
          <table className="recordsTable">
            <thead><tr><th>Equipment</th><th>Model</th><th>Lab and location</th><th>Controller</th><th>PM history</th><th>Latest status</th></tr></thead>
            <tbody>
              {filtered.map((record) => (
                <tr className={record.id === selectedRecord?.id ? "selectedEquipmentRow" : ""} key={`${record.brand}:${record.freezerSerial || record.id}`}>
                  <td><div className="tableIdentity"><span className={`brandToken ${record.brand}`}>{record.brand === "mve" ? "MV" : "TW"}</span><div><button aria-label={`View equipment ${record.freezerSerial || record.id}`} className="equipmentSelect" onClick={() => setSelectedKey(`${record.brand}:${record.freezerSerial || record.id}`)} type="button">{record.freezerSerial || "Serial not recorded"}</button><small>{brandLabel(record.brand)}</small></div></div></td>
                  <td><strong>{record.modelFamily}</strong><small>{record.model}</small></td>
                  <td><strong>{record.labName || "Lab pending"}</strong><small>{record.location || record.facility || "Location pending"}</small></td>
                  <td><strong>{record.controllerType || "Not recorded"}</strong><small>{record.controllerSerial || "Serial pending"}</small></td>
                  <td><strong>{record.historyCount} PM record{record.historyCount === 1 ? "" : "s"}</strong><small>{record.completedCount} completed</small></td>
                  <td><span className={`recordStatus ${record.status}`}>{statusLabel(record.status)}</span><small>Updated {formatDate(record.updatedAt)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="emptyState"><strong>No equipment matches the filters</strong><span>Change the search or brand selection.</span></div>}
        </div>
      </section>
      <aside className="kairosEquipmentDetail" aria-live="polite">
        {selectedRecord && selectedImage ? <>
          <div className="kairosEquipmentImage" role="img" aria-label={`${brandLabel(selectedRecord.brand)} ${selectedRecord.model} freezer reference`} style={{ backgroundImage: `url("${selectedImage.src}")` }} />
          <div className="kairosEquipmentInfo"><div className="eyebrow">Selected equipment</div><h2>{selectedRecord.modelFamily}</h2><p>{selectedRecord.model} · {selectedRecord.freezerSerial || "Serial not recorded"}</p>
            <dl><div><dt>Lab</dt><dd>{selectedRecord.labName || "Not recorded"}</dd></div><div><dt>Location</dt><dd>{selectedRecord.location || selectedRecord.facility || "Not recorded"}</dd></div><div><dt>Controller</dt><dd>{selectedRecord.controllerType || "Not recorded"}</dd></div><div><dt>PM history</dt><dd>{selectedRecord.historyCount} records</dd></div></dl>
            <button onClick={() => onNavigate("reports")} type="button">Open Reports</button>
          </div>
        </> : <div className="kairosEquipmentMissing">No equipment matches the filters.</div>}
      </aside></div>
    </div>
  );
}

function ReportPreview({
  detail,
  error,
  loading,
}: {
  detail: ReportDetail | null;
  error: string;
  loading: boolean;
}) {
  if (loading) return <div className="reportPreview empty"><strong>Loading report</strong><span>Retrieving PM details and signature status.</span></div>;
  if (error) return <div className="reportPreview empty error"><strong>Report could not be opened</strong><span>{error}</span></div>;
  if (!detail) return <div className="reportPreview empty"><strong>Select a PM report</strong><span>Choose a record to review its maintenance summary, signatures and audit history.</span></div>;

  const { record } = detail;
  const notes = record.payload.notes ?? {};
  const technicianSignatureAvailable = Boolean(record.technicianSignatureCapturedAt && !record.technicianSignatureDeletedAt);
  const recipientSignatureAvailable = Boolean(record.recipientSignatureCapturedAt && !record.recipientSignatureDeletedAt);
  const image = freezerImage(record.brand, record.modelFamily, record.model);
  const savedResponses = record.payload.responses ?? {};
  const measurements = record.payload.measurements ?? {};
  const exam = record.payload.examination ?? {};
  const flags = record.payload.flags ?? {};
  const answer = (section: InspectionStep, id: string) => {
    const result = savedResponses[`${record.brand}:${section}:${id}`];
    return result === "yes" ? "Yes" : result === "no" ? "No" : result === "na" ? "N/A" : result === "any" ? "Any" : "Not recorded";
  };
  const measure = (key: string, unit: string) => {
    const value = measurements[key];
    return value === null || value === undefined || value === "" ? "Not recorded" : `${value} ${unit}`;
  };
  const examValue = (key: keyof ExamValues, unit: string) => {
    if ((key === "gasBypassTemperature" && flags.gasBypassTemperatureNA) || (key === "gasBypassDelay" && flags.gasBypassDelayNA)) return "N/A";
    const value = exam[key];
    return value === undefined || value === "" ? "Not recorded" : `${value}${unit ? ` ${unit}` : ""}`;
  };
  const levelDifference = measurements.manualLevel && measurements.controllerLevel
    ? Math.abs(Number(measurements.manualLevel) - Number(measurements.controllerLevel)).toFixed(2)
    : null;
  const note = (section: keyof NotesState) => notes[section]?.trim() || "No observations recorded.";

  function checklistTable(section: InspectionStep, items: readonly ChecklistItem[]) {
    return <table className="pmReportTable"><thead><tr><th>Maintenance criterion</th><th>Result</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.label}</td><td>{answer(section, item.id)}</td></tr>)}</tbody></table>;
  }

  function measurementTable(rows: Array<{ label: string; value: string; reference?: string }>) {
    return <table className="pmReportTable"><thead><tr><th>Measured or configured value</th><th>Result</th><th>PM reference</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.value}</td><td>{row.reference || "-"}</td></tr>)}</tbody></table>;
  }

  function reportSectionHeading(number: string, title: string) {
    return <header className="pmReportSectionHeading"><img alt="Cryogenics Solution Inc." src="/brand/logo-primary.png" /><div><span>Preventive maintenance program</span><h2>{number} / {title}</h2><small>{record.recordNumber} · {brandLabel(record.brand)} · {record.freezerSerial || "Serial not recorded"}</small></div></header>;
  }

  function reportNote(section: keyof NotesState) {
    return <div className="pmReportNote"><strong>{section === "general" ? "General service notes" : `${section[0].toUpperCase()}${section.slice(1)} observations`}</strong><p>{note(section)}</p></div>;
  }

  return (
    <article className="reportPreview">
      <div className="reportToolbar">
        <div><span>Preventive maintenance report</span><h2>{record.recordNumber}</h2></div>
        <button disabled={record.status !== "completed"} onClick={() => window.print()} type="button">Print or save full PM PDF</button>
      </div>
      <section className="reportCover" aria-label="PM report summary">
        <img className="reportLogo" alt="Cryogenics Solution Inc." src="/brand/logo-primary.png" />
        <div className="reportCoverHeading"><span>Preventive maintenance</span><strong>{record.recordNumber}</strong><small>PM date {formatDate(pmDate(record))}</small></div>
        <figure className="reportFreezerImage"><img alt={`${brandLabel(record.brand)} ${record.model} freezer reference`} src={image.src} /><figcaption>{image.exact ? `Freezer model ${record.model}` : `Reference image for ${record.modelFamily}; verify the equipment label for ${record.model}`}</figcaption></figure>
      <dl className="reportCoverFacts">
          <div><dt>Technician</dt><dd>{record.technicianName || "Not recorded"}</dd></div>
          <div><dt>Freezer model</dt><dd>{brandLabel(record.brand)} {record.model}</dd></div>
          <div><dt>Serial number</dt><dd>{record.freezerSerial || "Not recorded"}</dd></div>
          <div><dt>Client</dt><dd>{record.clientOrganization || (record.labName ? `Lab: ${record.labName}` : "Not recorded")}</dd></div>
          <div><dt>Lab name</dt><dd>{record.labName || "Not recorded"}</dd></div>
          <div><dt>Location</dt><dd>{record.location || "Not recorded"}</dd></div>
          <div><dt>Controller serial</dt><dd>{record.controllerSerial || "Not recorded"}</dd></div>
          <div><dt>Controller type</dt><dd>{record.controllerType || "Not recorded"}</dd></div>
          {record.brand === "mve" && <div><dt>Firmware version</dt><dd>{record.firmwareVersion || "Not recorded"}</dd></div>}
        </dl>
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("01", "Construction")}
        <p className="pmReportIntro">Visual and mechanical inspection of the freezer construction.</p>
        {checklistTable("construction", constructionItems)}
        {reportNote("construction")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("02", "Operation")}
        <p className="pmReportIntro">Electrical, valve and battery backup inspection.</p>
        {checklistTable("operation", operationItems[record.brand])}
        {record.brand === "mve" && <>
          <h3 className="pmReportSubheading">Solenoid resistance</h3>
          {measurementTable([
            { label: "Solenoid valve resistance confirmed", value: answer("operation", "resistance-confirmed") },
            { label: "Single valve resistance", value: measure("singleValveResistance", "Ω"), reference: "62 < R < 74 Ω" },
            { label: "Dual valve resistance", value: measure("dualValveResistance", "Ω"), reference: "28 < R < 38 Ω" },
            { label: "Purge / 3-way valve resistance", value: measure("purgeValveResistance", "Ω"), reference: "135 < R < 145 Ω" },
          ])}
        </>}
        <h3 className="pmReportSubheading">Battery measurement</h3>
        {measurementTable([{ label: "Battery output voltage", value: measure("batteryVoltage", "VDC"), reference: `${equipment[record.brand].batteryNominal} to ${(equipment[record.brand].batteryNominal * 1.1).toFixed(1)} VDC` }])}
        {reportNote("operation")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("03", "Verification")}
        <p className="pmReportIntro">Temperature probes, liquid level and functional controls.</p>
        {measurementTable([
          { label: record.brand === "mve" ? "Temperature resistance confirmed" : "Thermocouple resistance confirmed", value: answer("verification", "temperature-resistance") },
          { label: "Room temperature resistance", value: measure("roomResistance", "Ω"), reference: `${equipment[record.brand].room.min} < R < ${equipment[record.brand].room.max} Ω` },
          { label: "Cryogenic temperature resistance", value: measure("cryoResistance", "Ω"), reference: `${equipment[record.brand].cryo.min} < R < ${equipment[record.brand].cryo.max} Ω` },
          { label: "Manually measured liquid level", value: measure("manualLevel", "in") },
          { label: "Controller displayed liquid level", value: measure("controllerLevel", "in") },
          { label: "Displayed vs. actual level difference", value: levelDifference === null ? "Not recorded" : `${levelDifference} in`, reference: "≤ 0.5 in" },
        ])}
        <h3 className="pmReportSubheading">Functional verification</h3>
        {checklistTable("verification", verificationItems[record.brand])}
        {reportNote("verification")}
      </section>
      <section className="pmReportPage">
        {reportSectionHeading("04", "Examination")}
        <p className="pmReportIntro">Controller readings and configured alarm, level and time values.</p>
        {measurementTable([
          { label: "Temperature unit", value: exam.temperatureUnit || "Not recorded" },
          { label: "Level unit", value: exam.levelUnit || "Not recorded" },
          { label: "High Temperature A-B", value: examValue("highTemperature", exam.temperatureUnit || "") },
          { label: "Low Temperature A-B", value: examValue("lowTemperature", exam.temperatureUnit || "") },
          { label: "High Level Alarm", value: examValue("highLevelAlarm", exam.levelUnit || "") },
          { label: "High Level Set Point", value: examValue("highLevelSetPoint", exam.levelUnit || "") },
          { label: "Low Level Set Point", value: examValue("lowLevelSetPoint", exam.levelUnit || "") },
          { label: "Low Level Alarm", value: examValue("lowLevelAlarm", exam.levelUnit || "") },
          { label: "Gas Bypass Temperature Set Point", value: examValue("gasBypassTemperature", exam.temperatureUnit || "") },
          { label: "Gas Bypass Time Delay", value: examValue("gasBypassDelay", "min") },
          { label: "Maximum Fill Time", value: examValue("maximumFillTime", "min") },
          { label: "Event Log Interval", value: examValue("eventLogInterval", "min") },
        ])}
        {reportNote("examination")}
      </section>
      <section className="pmReportPage pmReportClosing">
        {reportSectionHeading("05", "Service closure")}
        {reportNote("general")}
        <div className="pmReportAttestation"><strong>Maintenance record</strong><p>The technician signature documents responsibility for the work recorded in this PM. The recipient signature documents receipt of the PM.</p><p>PM date: {formatDate(pmDate(record))} · Record: {record.recordNumber} · Revision: {record.revision}</p></div>
        {record.status !== "completed" ? (
          <p>This PM is still a draft. Signatures have not been recorded.</p>
        ) : (
          <div className="reportSignatureGrid">
            <figure>
              <figcaption><strong>Responsible technician: {record.technicianName || "Not recorded"}</strong><span>Signed {formatDate(record.technicianSignatureCapturedAt, true)}</span></figcaption>
              {technicianSignatureAvailable ? <img alt="Responsible PM technician signature" src={`/api/pm-records/${record.id}/signature?role=technician`} /> : <div>Signature no longer available</div>}
            </figure>
            <figure>
              <figcaption><strong>PM recipient</strong><span>Signed {formatDate(record.recipientSignatureCapturedAt, true)}</span></figcaption>
              {recipientSignatureAvailable ? <img alt="PM recipient signature" src={`/api/pm-records/${record.id}/signature?role=recipient`} /> : <div>Signature no longer available</div>}
            </figure>
          </div>
        )}
        {record.status === "completed" && (
          <p className="retentionLine">Signature retention date: {formatDate(record.technicianSignatureRetentionUntil || record.recipientSignatureRetentionUntil)}</p>
        )}
      </section>
      <section className="reportSection reportAuditSection">
        <div className="reportSectionTitle"><span>Audit history</span><strong>Record activity</strong></div>
        <div className="auditList">
          {detail.events.map((event) => <div key={`${event.eventType}-${event.revision}-${event.createdAt}`}><span>{event.eventType.replaceAll("_", " ")}</span><strong>Revision {event.revision}</strong><small>{formatDate(event.createdAt, true)}</small></div>)}
        </div>
      </section>
    </article>
  );
}

function ReportsView({
  detail,
  detailError,
  detailLoading,
  error,
  onExport,
  onOpenReport,
  onRetry,
  records,
  status,
}: {
  detail: ReportDetail | null;
  detailError: string;
  detailLoading: boolean;
  error: string;
  onExport: (records: PmRecordSummary[]) => void;
  onOpenReport: (record: PmRecordSummary) => void;
  onRetry: () => void;
  records: PmRecordSummary[];
  status: RecordsStatus;
}) {
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<"all" | BrandKey>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | PmStatus>("all");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  if (status !== "loaded") return <RecordsMessage error={error} onRetry={onRetry} status={status} />;

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const matchesBrand = brandFilter === "all" || record.brand === brandFilter;
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    const performed = localDateKey(pmDate(record));
    const searchable = [record.recordNumber, record.freezerSerial, record.modelFamily, record.model, record.labName, record.clientOrganization, record.location].filter(Boolean).join(" ").toLowerCase();
    return matchesBrand && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery)) && (!technicianFilter.trim() || (record.technicianName || "").toLowerCase().includes(technicianFilter.trim().toLowerCase())) && (!dateFrom || (performed !== "" && performed >= dateFrom)) && (!dateTo || (performed !== "" && performed <= dateTo));
  });

  return (
    <div className="managementView reportsView">
      <section className="viewHero">
        <div>
          <div className="eyebrow">PM documentation</div>
          <h1>Reports</h1>
          <p>Search PM records, review stored signatures and print a completed maintenance report.</p>
        </div>
        <button className="primaryAction" disabled={filtered.length === 0} onClick={() => onExport(filtered)} type="button">Export filtered CSV</button>
      </section>

      <div className="reportsGrid">
        <section className="dataPanel reportListPane">
          <div className="filterBar compact">
            <label className="wideFilter"><span>Search reports</span><input onChange={(event) => setQuery(event.target.value)} placeholder="PM number, serial, model or lab" value={query} /></label>
            <label><span>Brand</span><select onChange={(event) => setBrandFilter(event.target.value as "all" | BrandKey)} value={brandFilter}><option value="all">All</option><option value="mve">MVE</option><option value="taylor">Taylor-Wharton</option></select></label>
            <label><span>Status</span><select onChange={(event) => setStatusFilter(event.target.value as "all" | PmStatus)} value={statusFilter}><option value="all">All</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
            <label><span>Technician</span><input aria-label="Filter reports by technician" onChange={(event) => setTechnicianFilter(event.target.value)} placeholder="Technician name" value={technicianFilter} /></label>
            <label><span>PM from</span><input aria-label="PM date from" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
            <label><span>PM to</span><input aria-label="PM date to" min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
          </div>
          <div className="reportList">
            {filtered.map((record) => (
              <button className={detail?.record.id === record.id ? "selected" : ""} key={record.id} onClick={() => onOpenReport(record)} type="button">
                <span className={`brandToken ${record.brand}`}>{record.brand === "mve" ? "MV" : "TW"}</span>
                <div><strong>{record.recordNumber}</strong><span>{record.freezerSerial || "Serial pending"} · {record.model}</span><small>{record.technicianName || "Technician not recorded"} · PM {formatDate(pmDate(record))}</small></div>
                <span className={`recordStatus ${record.status}`}>{statusLabel(record.status)}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="emptyState"><strong>No reports match the filters</strong><span>Change the search, brand or status selection.</span></div>}
          </div>
        </section>
        <ReportPreview detail={detail} error={detailError} loading={detailLoading} />
      </div>
    </div>
  );
}

export default function Home() {
  const [brand, setBrand] = useState<BrandKey>("taylor");
  const [family, setFamily] = useState(modelCatalog.taylor[0].family);
  const [model, setModel] = useState(modelCatalog.taylor[0].models[0]);
  const [facility, setFacility] = useState("");
  const [labName, setLabName] = useState("");
  const [clientOrganization, setClientOrganization] = useState("");
  const [performedOn, setPerformedOn] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [freezerSerial, setFreezerSerial] = useState("");
  const [controllerSerial, setControllerSerial] = useState("");
  const [location, setLocation] = useState("");
  const [controllerType, setControllerType] = useState("");
  const [activeStep, setActiveStep] = useState<StepKey>("construction");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [responses, setResponses] = useState<Record<string, Result>>({});
  const [notes, setNotes] = useState<NotesState>(emptyNotes);
  const [roomResistance, setRoomResistance] = useState("");
  const [cryoResistance, setCryoResistance] = useState("");
  const [singleValveResistance, setSingleValveResistance] = useState("");
  const [dualValveResistance, setDualValveResistance] = useState("");
  const [purgeValveResistance, setPurgeValveResistance] = useState("");
  const [batteryVoltage, setBatteryVoltage] = useState("");
  const [manualLevel, setManualLevel] = useState("");
  const [controllerLevel, setControllerLevel] = useState("");
  const [examValues, setExamValues] = useState<ExamValues>(emptyExam);
  const [numericWarnings, setNumericWarnings] = useState<Record<string, string>>({});
  const [gasBypassTemperatureNA, setGasBypassTemperatureNA] = useState(false);
  const [gasBypassDelayNA, setGasBypassDelayNA] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftRecordNumber, setDraftRecordNumber] = useState<string | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [technicianSignature, setTechnicianSignature] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [technicianResponsible, setTechnicianResponsible] = useState(false);
  const [recipientSignature, setRecipientSignature] = useState("");
  const [recipientAccepted, setRecipientAccepted] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>("idle");
  const [completionError, setCompletionError] = useState("");
  const [signatureCapturedAt, setSignatureCapturedAt] = useState<string | null>(null);
  const [signatureRetentionUntil, setSignatureRetentionUntil] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("overview");
  const [pmRecords, setPmRecords] = useState<PmRecordSummary[]>([]);
  const [recordsStatus, setRecordsStatus] = useState<RecordsStatus>("idle");
  const [recordsError, setRecordsError] = useState("");
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetailError, setReportDetailError] = useState("");

  const selectedEquipment = equipment[brand];
  const selectedFamily = modelCatalog[brand].find((item) => item.family === family) ?? modelCatalog[brand][0];
  const currentIndex = steps.findIndex((step) => step.key === activeStep);
  const openRecordCount = pmRecords.filter((record) => record.status !== "completed" && record.status !== "archived").length;
  const equipmentRecords = useMemo<EquipmentRegistryItem[]>(() => {
    const registry = new Map<string, EquipmentRegistryItem>();
    for (const record of pmRecords) {
      const key = `${record.brand}:${record.freezerSerial?.trim().toUpperCase() || record.id}`;
      const current = registry.get(key);
      if (!current) {
        registry.set(key, {
          ...record,
          historyCount: 1,
          completedCount: record.status === "completed" ? 1 : 0,
        });
      } else {
        current.historyCount += 1;
        if (record.status === "completed") current.completedCount += 1;
      }
    }
    return Array.from(registry.values());
  }, [pmRecords]);

  useEffect(() => {
    if (!draftId) return;
    setSaveStatus((current) => current === "saved" ? "idle" : current);
  }, [
    brand,
    family,
    model,
    facility,
    labName,
    clientOrganization,
    performedOn,
    firmwareVersion,
    freezerSerial,
    controllerSerial,
    location,
    controllerType,
    responses,
    notes,
    roomResistance,
    cryoResistance,
    singleValveResistance,
    dualValveResistance,
    purgeValveResistance,
    batteryVoltage,
    manualLevel,
    controllerLevel,
    examValues,
    gasBypassTemperatureNA,
    gasBypassDelayNA,
  ]);

  useEffect(() => {
    void refreshRecords();
  }, []);

  const responseKey = (section: InspectionStep, id: string) => `${brand}:${section}:${id}`;
  const getResponse = (section: InspectionStep, id: string) => responses[responseKey(section, id)] ?? null;

  const validation = useMemo(() => {
    const manual = Number(manualLevel);
    const controller = Number(controllerLevel);
    const levelsEntered = hasNumber(manualLevel) && hasNumber(controllerLevel);
    const difference = levelsEntered ? Math.abs(manual - controller) : Number.NaN;
    return {
      roomValid: inOpenRange(roomResistance, selectedEquipment.room.min, selectedEquipment.room.max),
      cryoValid: inOpenRange(cryoResistance, selectedEquipment.cryo.min, selectedEquipment.cryo.max),
      levelValid: Number.isFinite(difference) && difference <= 0.5,
      difference: Number.isFinite(difference) ? difference.toFixed(1) : "—",
      singleValveValid: inOpenRange(singleValveResistance, 62, 74),
      dualValveValid: inOpenRange(dualValveResistance, 28, 38),
      purgeValveValid: inOpenRange(purgeValveResistance, 135, 145),
    };
  }, [
    roomResistance,
    cryoResistance,
    manualLevel,
    controllerLevel,
    selectedEquipment,
    singleValveResistance,
    dualValveResistance,
    purgeValveResistance,
  ]);

  const identificationComplete = [
    ...(brand === "mve" ? [facility, firmwareVersion] : []),
    labName,
    freezerSerial,
    controllerSerial,
    location,
    controllerType,
  ].every((value) => value.trim() !== "");

  function checklistComplete(section: InspectionStep, items: readonly ChecklistItem[]) {
    const allAnswered = items.every((item) => getResponse(section, item.id) !== null);
    const requiresObservation = items.some((item) => {
      const answer = getResponse(section, item.id);
      return answer === "no" || answer === "na" || answer === "any";
    });
    return allAnswered && (!requiresObservation || notes[section].trim() !== "");
  }

  const constructionComplete = identificationComplete && checklistComplete("construction", constructionItems);
  const batteryPresent = getResponse("operation", "battery-present");
  const batteryMaximum = selectedEquipment.batteryNominal * 1.1;
  const batteryVoltageEntered = hasNumber(batteryVoltage);
  const batteryLowVoltage = batteryPresent === "yes" && batteryVoltageEntered && Number(batteryVoltage) < selectedEquipment.batteryNominal;
  const batteryAboveMaximum = batteryPresent === "yes" && batteryVoltageEntered && Number(batteryVoltage) > batteryMaximum;
  const batteryMeasurementComplete =
    batteryPresent === "no" ||
    (
      batteryPresent === "yes" &&
      batteryVoltageEntered &&
      !batteryAboveMaximum &&
      (!batteryLowVoltage || notes.operation.trim() !== "")
    );
  const operationMeasurementsComplete =
    brand === "taylor" ||
    (validation.singleValveValid && validation.dualValveValid && validation.purgeValveValid);
  const operationComplete =
    checklistComplete("operation", operationItems[brand]) &&
    (brand === "taylor" || (
      getResponse("operation", "resistance-confirmed") !== null &&
      (!["no", "na"].includes(getResponse("operation", "resistance-confirmed") ?? "") || notes.operation.trim() !== "")
    )) &&
    operationMeasurementsComplete &&
    batteryMeasurementComplete;
  const verificationComplete =
    checklistComplete("verification", verificationItems[brand]) &&
    getResponse("verification", "temperature-resistance") !== null &&
    (!["no", "na"].includes(getResponse("verification", "temperature-resistance") ?? "") || notes.verification.trim() !== "") &&
    validation.roomValid &&
    validation.cryoValid &&
    validation.levelValid;
  const temperatureOrderValid = !hasNumber(examValues.lowTemperature) || !hasNumber(examValues.highTemperature) || Number(examValues.lowTemperature) < Number(examValues.highTemperature);
  const levelAlarmOrderValid = !hasNumber(examValues.lowLevelAlarm) || !hasNumber(examValues.highLevelAlarm) || Number(examValues.lowLevelAlarm) < Number(examValues.highLevelAlarm);
  const levelSetPointOrderValid = !hasNumber(examValues.lowLevelSetPoint) || !hasNumber(examValues.highLevelSetPoint) || Number(examValues.lowLevelSetPoint) < Number(examValues.highLevelSetPoint);
  const examinationFieldsComplete =
    hasNegativeNumber(examValues.highTemperature) &&
    hasNegativeNumber(examValues.lowTemperature) &&
    hasNonNegativeNumber(examValues.highLevelAlarm) &&
    hasNonNegativeNumber(examValues.highLevelSetPoint) &&
    hasNonNegativeNumber(examValues.lowLevelSetPoint) &&
    hasNonNegativeNumber(examValues.lowLevelAlarm) &&
    (gasBypassTemperatureNA || hasNegativeNumber(examValues.gasBypassTemperature)) &&
    (gasBypassDelayNA || hasNonNegativeNumber(examValues.gasBypassDelay)) &&
    hasNonNegativeNumber(examValues.maximumFillTime) &&
    hasNonNegativeNumber(examValues.eventLogInterval) &&
    examValues.temperatureUnit !== "" &&
    examValues.levelUnit !== "" &&
    temperatureOrderValid &&
    levelAlarmOrderValid &&
    levelSetPointOrderValid;
  const examinationComplete =
    examinationFieldsComplete &&
    (!(gasBypassTemperatureNA || gasBypassDelayNA) || notes.examination.trim() !== "");

  const completionByStep: Record<StepKey, boolean> = {
    construction: constructionComplete,
    operation: operationComplete,
    verification: verificationComplete,
    examination: examinationComplete,
    review: constructionComplete && operationComplete && verificationComplete && examinationComplete,
  };
  const firstIncompleteIndex = steps.findIndex((step) => !completionByStep[step.key]);
  const accessibleThrough = firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex;
  const activeComplete = completionByStep[activeStep];

  const brandResponses = Object.entries(responses)
    .filter(([key, value]) => key.startsWith(`${brand}:`) && value !== null)
    .map(([, value]) => value);
  const yesCount = brandResponses.filter((value) => value === "yes").length;
  const noCount = brandResponses.filter((value) => value === "no").length;
  const naCount = brandResponses.filter((value) => value === "na").length;
  const passedMeasurements =
    Number(validation.roomValid) +
    Number(validation.cryoValid) +
    Number(validation.levelValid) +
    (brand === "mve"
      ? Number(validation.singleValveValid) + Number(validation.dualValveValid) + Number(validation.purgeValveValid)
      : 0);

  function updateNumericValue(
    key: string,
    rawValue: string,
    setter: (value: string) => void,
    kind: "temperature" | "nonnegative" | "signed",
  ) {
    const hasLetters = /[a-z]/i.test(rawValue);
    const attemptedNegative = kind === "nonnegative" && rawValue.includes("-");
    const normalized = normalizeDecimal(rawValue, kind !== "nonnegative");
    let warning = "";

    if (hasLetters) warning = "Letters are not allowed. Enter numbers only.";
    else if (attemptedNegative) warning = "Negative values are not allowed for this measurement.";
    else if (kind === "temperature" && hasNumber(normalized) && Number(normalized) >= 0) {
      warning = "Temperature values must be negative.";
    }

    setter(normalized);
    setNumericWarnings((current) => ({ ...current, [key]: warning }));
  }

  function updateExamNumeric(key: keyof ExamValues, rawValue: string, kind: "temperature" | "nonnegative") {
    updateNumericValue(
      `exam-${key}`,
      rawValue,
      (value) => setExamValues((current) => ({ ...current, [key]: value })),
      kind,
    );
  }

  function updateResponse(section: InspectionStep, id: string, value: Exclude<Result, null>) {
    setResponses((current) => {
      const next = { ...current, [responseKey(section, id)]: value };
      if (section === "operation" && id === "battery-present") {
        for (const item of operationItems[brand].filter((candidate) => candidate.batteryDependent)) {
          next[responseKey("operation", item.id)] = value === "no" ? "na" : null;
        }
        if (value === "no") setBatteryVoltage("");
      }
      return next;
    });
  }

  function resetInspection() {
    setResponses({});
    setNotes(emptyNotes);
    setRoomResistance("");
    setCryoResistance("");
    setSingleValveResistance("");
    setDualValveResistance("");
    setPurgeValveResistance("");
    setBatteryVoltage("");
    setManualLevel("");
    setControllerLevel("");
    setExamValues(emptyExam);
    setNumericWarnings({});
    setGasBypassTemperatureNA(false);
    setGasBypassDelayNA(false);
    setTechnicianSignature("");
    setTechnicianName("");
    setTechnicianResponsible(false);
    setRecipientSignature("");
    setRecipientAccepted(false);
    setCompletionStatus("idle");
    setCompletionError("");
    setSignatureCapturedAt(null);
    setSignatureRetentionUntil(null);
    setActiveStep("construction");
  }

  function selectBrand(nextBrand: BrandKey) {
    const nextFamily = modelCatalog[nextBrand][0];
    const nextModel = nextFamily.models[0];
    setBrand(nextBrand);
    setFamily(nextFamily.family);
    setModel(nextModel);
    setFirmwareVersion("");
    setFreezerSerial("");
    setControllerSerial("");
    setControllerType(nextBrand === "mve" ? controllerOptions(nextBrand, nextFamily.family, nextModel)[0] : "");
    setDraftId(null);
    setDraftRecordNumber(null);
    setDraftRevision(null);
    setSaveStatus("idle");
    setSaveError("");
    resetInspection();
  }

  function selectFamily(nextFamilyName: string) {
    const nextFamily = modelCatalog[brand].find((item) => item.family === nextFamilyName);
    if (!nextFamily) return;
    const nextModel = nextFamily.models[0];
    setFamily(nextFamily.family);
    setModel(nextModel);
    if (brand === "mve") setControllerType(controllerOptions(brand, nextFamily.family, nextModel)[0]);
  }

  function selectModel(nextModel: string) {
    setModel(nextModel);
    if (brand === "mve") setControllerType(controllerOptions(brand, family, nextModel)[0]);
  }

  async function refreshRecords() {
    setRecordsStatus("loading");
    setRecordsError("");
    try {
      const response = await fetch("/api/pm-records", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const result = await response.json() as { error?: string; records?: PmRecordSummary[] };
      if (!response.ok || !result.records) {
        throw new Error(result.error || "Unable to retrieve PM records.");
      }
      setPmRecords(result.records);
      setRecordsStatus("loaded");
    } catch (error) {
      setRecordsStatus("error");
      setRecordsError(error instanceof Error ? error.message : "Unable to retrieve PM records.");
    }
  }

  function openWorkspaceView(view: WorkspaceView) {
    setWorkspaceView(view);
    setMobileMenu(false);
    if (view !== "orders") void refreshRecords();
  }

  async function openReport(record: PmRecordSummary) {
    setReportDetailLoading(true);
    setReportDetailError("");
    setReportDetail(null);
    try {
      const response = await fetch(`/api/pm-records/${record.id}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const result = await response.json() as ReportDetail & { error?: string };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Unable to retrieve the PM report.");
      }
      setReportDetail(result);
    } catch (error) {
      setReportDetailError(error instanceof Error ? error.message : "Unable to retrieve the PM report.");
    } finally {
      setReportDetailLoading(false);
    }
  }

  function exportReports(records: PmRecordSummary[]) {
    const headers = ["PM Number", "Brand", "Model Family", "Model", "Freezer Serial", "Client", "Lab", "Location", "Technician", "PM Date", "Status", "Created", "Updated"];
    const rows = records.map((record) => [
      record.recordNumber,
      brandLabel(record.brand),
      record.modelFamily,
      record.model,
      record.freezerSerial || "",
      record.clientOrganization || "",
      record.labName || "",
      record.location || record.facility || "",
      record.technicianName || "",
      pmDate(record) || "",
      statusLabel(record.status),
      record.createdAt,
      record.updatedAt,
    ]);
    const escapeCell = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCell(String(value))).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cryopm-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveDraft(step: StepKey = activeStep): Promise<SavedRecord | null> {
    setSaveStatus("saving");
    setSaveError("");
    const body = {
      brand,
      modelFamily: family,
      model,
      facility: brand === "mve" ? facility : null,
      labName,
      clientOrganization,
      performedOn,
      firmwareVersion: brand === "mve" ? firmwareVersion : null,
      freezerSerial,
      controllerSerial,
      location,
      controllerType,
      templateVersion: "0.2",
      currentStep: step,
      payload: {
        responses,
        notes,
        measurements: {
          roomResistance,
          cryoResistance,
          singleValveResistance: brand === "mve" ? singleValveResistance : null,
          dualValveResistance: brand === "mve" ? dualValveResistance : null,
          purgeValveResistance: brand === "mve" ? purgeValveResistance : null,
          batteryVoltage,
          manualLevel,
          controllerLevel,
        },
        examination: examValues,
        flags: {
          gasBypassTemperatureNA,
          gasBypassDelayNA,
        },
      },
      expectedRevision: draftRevision,
    };

    try {
      const response = await fetch(draftId ? `/api/pm-records/${draftId}` : "/api/pm-records", {
        method: draftId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as {
        error?: string;
        record?: { id: string; recordNumber: string; revision: number };
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Unable to save the PM draft.");
      }
      setDraftId(result.record.id);
      setDraftRecordNumber(result.record.recordNumber);
      setDraftRevision(result.record.revision);
      setSaveStatus("saved");
      return result.record;
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Unable to save the PM draft.");
      return null;
    }
  }

  async function goNext() {
    if (!activeComplete || currentIndex >= steps.length - 1) return;
    const nextStep = steps[currentIndex + 1].key;
    const saved = await saveDraft(nextStep);
    if (saved) setActiveStep(nextStep);
  }

  async function completePm() {
    if (
      !completionByStep.review ||
      !technicianSignature ||
      !technicianName.trim() ||
      !technicianResponsible ||
      !recipientSignature ||
      !recipientAccepted ||
      completionStatus === "completing"
    ) return;
    setCompletionStatus("completing");
    setCompletionError("");
    const saved = await saveDraft("review");
    if (!saved) {
      setCompletionStatus("error");
      setCompletionError("Save the PM before recording the signatures.");
      return;
    }

    try {
      const response = await fetch(`/api/pm-records/${saved.id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianSignatureDataUrl: technicianSignature,
          technicianName: technicianName.trim(),
          technicianResponsible: true,
          technicianAcceptanceVersion: "PM_TECHNICIAN_RESPONSIBILITY_V1",
          recipientSignatureDataUrl: recipientSignature,
          recipientAccepted: true,
          recipientAcceptanceVersion: "PM_RECEIPT_V1",
          expectedRevision: saved.revision,
        }),
      });
      const result = await response.json() as {
        error?: string;
        record?: SavedRecord & {
          status: "completed";
          signatureCapturedAt: string;
          signatureRetentionUntil: string;
        };
      };
      if (!response.ok || !result.record) {
        throw new Error(result.error || "Unable to complete the PM.");
      }
      setDraftRevision(result.record.revision);
      setSignatureCapturedAt(result.record.signatureCapturedAt);
      setSignatureRetentionUntil(result.record.signatureRetentionUntil);
      setCompletionStatus("completed");
      setSaveStatus("saved");
      void refreshRecords();
    } catch (error) {
      setCompletionStatus("error");
      setCompletionError(error instanceof Error ? error.message : "Unable to complete the PM.");
    }
  }

  function blockingMessage() {
    if (activeStep === "construction" && !identificationComplete) return "Complete equipment identification";
    if (activeStep === "operation" && brand === "mve" && !operationMeasurementsComplete) return "Complete all in-range resistance measurements";
    if (activeStep === "operation" && batteryAboveMaximum) return "Battery voltage exceeds the documented +10% range";
    if (activeStep === "operation" && batteryLowVoltage && notes.operation.trim() === "") return "Document the battery anomaly in Operation observations";
    if (activeStep === "operation" && !batteryMeasurementComplete) return "Record the battery voltage";
    if (activeStep === "verification" && (!validation.roomValid || !validation.cryoValid || !validation.levelValid)) return "Complete all in-range verification measurements";
    if (activeStep === "examination" && (!temperatureOrderValid || !levelAlarmOrderValid || !levelSetPointOrderValid)) return "Minimum values must be lower than maximum values";
    if (activeStep === "examination" && !examinationFieldsComplete) return "Complete all examination values";
    return "Answer every question and add required observations";
  }

  function renderChecklist(section: InspectionStep, items: readonly ChecklistItem[], includeNotes = true) {
    const hasException = items.some((item) => {
      const answer = getResponse(section, item.id);
      return answer === "no" || answer === "na" || answer === "any";
    });
    return (
      <>
        <div className="questionList">
          {items.map((item, index) => {
            const answer = getResponse(section, item.id);
            const disabled = item.batteryDependent && batteryPresent !== "yes";
            return (
              <article className={`questionCard ${disabled ? "disabledCard" : ""}`} key={item.id}>
                <div className="questionCopy">
                  <span className="questionNumber">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{item.label}</h3><p>{item.help}</p></div>
                </div>
                <Choice
                  allowNA={item.allowNA !== false}
                  anyInsteadOfNo={item.anyInsteadOfNo}
                  disabled={disabled}
                  label={item.label}
                  onChange={(value) => updateResponse(section, item.id, value)}
                  value={answer}
                />
                {(answer === "no" || answer === "na" || answer === "any") && (
                  <div className="inlineAlert">
                    <strong>Observation required</strong>
                    <span>Explain this {answer === "no" ? "result" : answer === "any" ? "Any selection" : "N/A selection"} in the section observations.</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {includeNotes && renderSectionNotes(section, hasException)}
      </>
    );
  }

  function renderSectionNotes(section: InspectionStep, required: boolean) {
    return (
      <label className={`sectionNotes ${required && notes[section].trim() === "" ? "requiredNotes" : ""}`}>
        <span>{steps.find((step) => step.key === section)?.label} observations {required ? "· Required" : "· Optional"}</span>
        <textarea
          aria-label={`${section} observations`}
          onChange={(event) => setNotes((current) => ({ ...current, [section]: event.target.value }))}
          placeholder="Document findings, corrective actions and the reason for any N/A selection. Do not enter patient, sample or clinical data."
          value={notes[section]}
        />
      </label>
    );
  }

  function examField(
    key: keyof ExamValues,
    label: string,
    unit: string,
    placeholder: string,
    kind: "temperature" | "nonnegative",
  ) {
    const warning = numericWarnings[`exam-${key}`];
    return (
      <label className="dataField">
        <span>{label}</span>
        <div className="dataInput">
          <input
            aria-label={label}
            inputMode="decimal"
            onChange={(event) => updateExamNumeric(key, event.target.value, kind)}
            placeholder={placeholder}
            value={examValues[key]}
          />
          <b>{unit}</b>
        </div>
        {warning && <small className="numericWarning">{warning}</small>}
      </label>
    );
  }

  return (
    <main className="appShell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand"><img alt="Cryogenics Solution Inc." src="/brand/logo-light.png" /><small>CryoPM · Field Maintenance</small></div>
        <nav className="primaryNav" aria-label="Primary navigation">
          <button className={workspaceView === "overview" ? "active" : ""} onClick={() => openWorkspaceView("overview")} type="button"><NavIcon label="Overview" />Overview</button>
          <button className={workspaceView === "orders" ? "active" : ""} onClick={() => openWorkspaceView("orders")} type="button"><NavIcon label="Work" />PM workspace{openRecordCount > 0 && <span className="navBadge">{openRecordCount}</span>}</button>
          <button className={workspaceView === "equipment" ? "active" : ""} onClick={() => openWorkspaceView("equipment")} type="button"><NavIcon label="Assets" />Equipment</button>
          <button className={workspaceView === "reports" ? "active" : ""} onClick={() => openWorkspaceView("reports")} type="button"><NavIcon label="Reports" />Reports</button>
        </nav>
        <div className="sidebarBottom">
          <div className="demoNotice"><span className="statusDot" /><div><strong>Protected demo</strong><small>Synthetic data only</small></div></div>
          <div className="userCard"><span className="avatar">DT</span><div><strong>Demo Technician</strong><small>Authentication prepared, hidden in MVP</small></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="menuButton" onClick={() => setMobileMenu((value) => !value)} type="button">Menu</button>
          <div className="breadcrumb">
            <span>{workspaceView === "orders" ? "PM workspace" : workspaceView === "overview" ? "Overview" : workspaceView === "equipment" ? "Equipment" : "Reports"}</span>
            {workspaceView === "orders" && <><b>/</b><strong>{draftRecordNumber ?? selectedEquipment.order}</strong></>}
          </div>
          {workspaceView === "orders" ? (
            <div className="topActions">
              <span className={`saveState ${saveStatus}`}>
                <i />
                {saveStatus === "saving" ? "Saving draft" : saveStatus === "saved" ? "Draft saved" : saveStatus === "error" ? "Save failed" : draftId ? "Unsaved changes" : "New draft"}
              </span>
              <button className="ghostButton" disabled={saveStatus === "saving"} onClick={() => void saveDraft()} type="button">
                {saveStatus === "saving" ? "Saving..." : "Save draft"}
              </button>
            </div>
          ) : (
            <div className="topActions">
              <span className={`saveState ${recordsStatus === "error" ? "error" : recordsStatus === "loading" ? "saving" : "saved"}`}><i />{recordsStatus === "loading" ? "Refreshing records" : recordsStatus === "error" ? "Refresh failed" : "Records current"}</span>
              <button className="ghostButton" disabled={recordsStatus === "loading"} onClick={() => void refreshRecords()} type="button">Refresh</button>
            </div>
          )}
        </header>

        <div className={`content ${workspaceView === "orders" ? "workOrderContent" : "managementContent"}`}>
          {workspaceView === "overview" && <OverviewView error={recordsError} onNavigate={openWorkspaceView} onRetry={() => void refreshRecords()} records={pmRecords} status={recordsStatus} />}
          {workspaceView === "equipment" && <EquipmentView equipmentRecords={equipmentRecords} error={recordsError} onNavigate={openWorkspaceView} onRetry={() => void refreshRecords()} status={recordsStatus} />}
          {workspaceView === "reports" && (
            <ReportsView
              detail={reportDetail}
              detailError={reportDetailError}
              detailLoading={reportDetailLoading}
              error={recordsError}
              onExport={exportReports}
              onOpenReport={(record) => void openReport(record)}
              onRetry={() => void refreshRecords()}
              records={pmRecords}
              status={recordsStatus}
            />
          )}
          {workspaceView === "orders" && (
            <>
          <section className="orderHero">
            <div>
              <div className="eyebrow">Preventive maintenance · PM v0.2</div>
              <div className="titleRow"><h1>{selectedEquipment.label} {model}</h1><span className={completionStatus === "completed" ? "completedStatus" : "inProgress"}>{completionStatus === "completed" ? "Completed" : "In progress"}</span></div>
              <p>Complete every applicable PM field before review.</p>
              <div className="brandSelector" aria-label="Equipment brand">
                <span>Equipment:</span>
                <button className={brand === "taylor" ? "active" : ""} onClick={() => selectBrand("taylor")} type="button">Taylor-Wharton</button>
                <button className={brand === "mve" ? "active" : ""} onClick={() => selectBrand("mve")} type="button">MVE</button>
              </div>
            </div>
            <div className="assetIdentity">
              <div className="assetVisual"><img alt="" src={freezerImage(brand, family, model).src} /></div>
              <div><small>Selected equipment</small><strong>{family} · {model}</strong><span>{controllerType}</span></div>
            </div>
          </section>

          <section className="equipmentIdentification" aria-labelledby="equipment-identification-title">
            <div className="identificationHeading">
              <div><span>ID</span><div><p>Required before inspection</p><h2 id="equipment-identification-title">Equipment identification</h2></div></div>
              <small>Use equipment labels only. Do not enter patient, sample or clinical data.</small>
            </div>
            <div className="identificationGrid">
              {brand === "mve" && (
                <label className="identificationField">
                  <span>Facility</span>
                  <input aria-label="Facility" onChange={(event) => setFacility(event.target.value)} placeholder="Facility name" value={facility} />
                </label>
              )}
              <label className="identificationField">
                <span>Lab name</span>
                <input aria-label="Lab name" onChange={(event) => setLabName(event.target.value)} placeholder="Laboratory or department" value={labName} />
              </label>
              <label className="identificationField">
                <span>Client organization</span>
                <input aria-label="Client organization" onChange={(event) => setClientOrganization(event.target.value)} placeholder="Company or institution" required value={clientOrganization} />
              </label>
              <label className="identificationField">
                <span>PM execution date</span>
                <input aria-label="PM execution date" onChange={(event) => setPerformedOn(event.target.value)} required type="date" value={performedOn} />
              </label>
              <div className="identificationField modelField">
                <span>Freezer model</span>
                <div className="nestedSelects">
                  <select aria-label="Equipment series or family" onChange={(event) => selectFamily(event.target.value)} value={family}>
                    {modelCatalog[brand].map((item) => <option key={item.family} value={item.family}>{item.family}</option>)}
                  </select>
                  <select aria-label="Equipment model" onChange={(event) => selectModel(event.target.value)} value={model}>
                    {selectedFamily.models.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              {brand === "mve" && (
                <label className="identificationField">
                  <span>Firmware version</span>
                  <input aria-label="Firmware version" onChange={(event) => setFirmwareVersion(event.target.value)} placeholder="Example: V 2.03" value={firmwareVersion} />
                </label>
              )}
              <label className="identificationField">
                <span>Freezer serial number</span>
                <input aria-label="Freezer serial number" onChange={(event) => setFreezerSerial(event.target.value)} placeholder="Serial on equipment label" value={freezerSerial} />
              </label>
              <label className="identificationField">
                <span>Controller serial number</span>
                <input aria-label="Controller serial number" onChange={(event) => setControllerSerial(event.target.value)} placeholder="Controller serial" value={controllerSerial} />
              </label>
              <label className="identificationField">
                <span>Location</span>
                <input aria-label="Equipment location" onChange={(event) => setLocation(event.target.value)} placeholder="Building, floor or room" value={location} />
              </label>
              <label className="identificationField">
                <span>Controller type</span>
                {brand === "taylor"
                  ? <input aria-label="Controller type" onChange={(event) => setControllerType(event.target.value)} placeholder="Enter controller type" value={controllerType} />
                  : (
                    <select aria-label="Controller type" onChange={(event) => setControllerType(event.target.value)} value={controllerType}>
                      {controllerOptions(brand, family, model).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
              </label>
            </div>
            {!identificationComplete && <div className="identificationNotice">All identification fields are required before Construction can be completed.</div>}
          </section>

          <section className="stepper" aria-label="Maintenance progress">
            {steps.map((step, index) => (
              <button
                className={`${activeStep === step.key ? "current" : ""} ${completionByStep[step.key] ? "complete" : ""}`}
                disabled={index > accessibleThrough}
                key={step.key}
                onClick={() => setActiveStep(step.key)}
                type="button"
              >
                <span>{completionByStep[step.key] ? "OK" : step.short}</span>
                <div><small>Step {index + 1}</small><strong>{step.label}</strong></div>
              </button>
            ))}
          </section>

          <div className="mainGrid">
            <section className="formPanel">
              <div className="sectionHeading">
                <div><span className="sectionCode">{steps[currentIndex].short}</span><div><p>COVE inspection</p><h2>{steps[currentIndex].label}</h2></div></div>
                <span className="requiredLabel">Required fields</span>
              </div>

              {activeStep === "construction" && renderChecklist("construction", constructionItems)}

              {activeStep === "operation" && (
                <>
                  {renderChecklist("operation", operationItems[brand], false)}
                  {brand === "mve" && (
                    <div className="measurementStack operationMeasurements">
                      <div className="instructionBand"><div className="instructionMark">i</div><div><strong>MVE solenoid resistance checks</strong><p>All three values must remain inside the PM limits.</p></div></div>
                      <article className="questionCard groupedConfirmation">
                        <div className="questionCopy">
                          <span className="questionNumber">10</span>
                          <div><h3>Solenoid valve resistance confirmed</h3><p>Confirm the resistance check, then enter the three measurements directly below.</p></div>
                        </div>
                        <Choice
                          label="Solenoid valve resistance confirmed"
                          onChange={(value) => updateResponse("operation", "resistance-confirmed", value)}
                          value={getResponse("operation", "resistance-confirmed")}
                        />
                        {(getResponse("operation", "resistance-confirmed") === "no" || getResponse("operation", "resistance-confirmed") === "na") && (
                          <div className="inlineAlert"><strong>Observation required</strong><span>Document this result in Operation observations.</span></div>
                        )}
                      </article>
                      {[
                        { key: "single-valve-resistance", title: "Single valve resistance", min: 62, max: 74, value: singleValveResistance, setValue: setSingleValveResistance, valid: validation.singleValveValid },
                        { key: "dual-valve-resistance", title: "Dual valve resistance", min: 28, max: 38, value: dualValveResistance, setValue: setDualValveResistance, valid: validation.dualValveValid },
                        { key: "purge-valve-resistance", title: "Purge / 3-way valve resistance", min: 135, max: 145, value: purgeValveResistance, setValue: setPurgeValveResistance, valid: validation.purgeValveValid },
                      ].map((measurement, index) => {
                        const invalid = measurement.value.trim() !== "" && !measurement.valid;
                        const numericWarning = numericWarnings[measurement.key];
                        return (
                          <article className={`measurementCard ${invalid ? "invalid" : ""}`} key={measurement.title}>
                            <div className="measurementTop"><div><span className="questionNumber">{String(index + 11).padStart(2, "0")}</span><h3>{measurement.title}</h3></div><span className="rangePill">{measurement.min} &lt; R &lt; {measurement.max} Ω</span></div>
                            <label className="measureInput"><span>Measured value</span><div><input aria-label={measurement.title} inputMode="decimal" onChange={(event) => updateNumericValue(measurement.key, event.target.value, measurement.setValue, "nonnegative")} placeholder="Required" value={measurement.value} /><b>Ω</b></div></label>
                            {numericWarning && <div className="inputWarning">{numericWarning}</div>}
                            {invalid && <div className="hardStopAlert"><span>!</span><div><strong>Hard stop · Value outside approved range</strong><p>Enter a value greater than {measurement.min} Ω and less than {measurement.max} Ω.</p></div></div>}
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="batteryMeasurement">
                    <div>
                      <strong>Battery output voltage</strong>
                      <p>Normal range: {selectedEquipment.batteryNominal.toFixed(1)} to {batteryMaximum.toFixed(1)} VDC. A value below nominal requires an anomaly observation.</p>
                    </div>
                    <label className="measureInput">
                      <span>Measured value</span>
                      <div><input aria-label="Battery output voltage" disabled={batteryPresent !== "yes"} inputMode="decimal" onChange={(event) => updateNumericValue("battery-voltage", event.target.value, setBatteryVoltage, "signed")} placeholder={batteryPresent === "yes" ? "Required" : "Battery must be present"} value={batteryVoltage} /><b>VDC</b></div>
                      {numericWarnings["battery-voltage"] && <small className="numericWarning">{numericWarnings["battery-voltage"]}</small>}
                    </label>
                    <span className="nominalPill">{selectedEquipment.batteryNominal.toFixed(1)}–{batteryMaximum.toFixed(1)} VDC</span>
                    {batteryLowVoltage && <div className="batteryStatusWarning"><strong>Battery anomaly · Below nominal voltage</strong><span>Document the anomaly in Operation observations before continuing.</span></div>}
                    {batteryAboveMaximum && <div className="hardStopAlert batteryHardStop"><span>!</span><div><strong>Hard stop · Value exceeds the documented range</strong><p>Verify the measurement. The maximum expected value is {batteryMaximum.toFixed(1)} VDC.</p></div></div>}
                  </div>
                  {renderSectionNotes(
                    "operation",
                    getResponse("operation", "resistance-confirmed") === "no" ||
                    getResponse("operation", "resistance-confirmed") === "na" ||
                    batteryLowVoltage ||
                    operationItems[brand].some((item) => {
                      const answer = getResponse("operation", item.id);
                      return answer === "no" || answer === "na";
                    }),
                  )}
                </>
              )}

              {activeStep === "verification" && (
                <>
                  <div className="measurementStack">
                    <div className="instructionBand"><div className="instructionMark">i</div><div><strong>Enter the measured values</strong><p>Values are checked against the approved PM limits for this brand.</p></div></div>

                    <article className="questionCard groupedConfirmation">
                      <div className="questionCopy">
                        <span className="questionNumber">01</span>
                        <div>
                          <h3>{brand === "taylor" ? "Thermocouple resistance confirmed" : "Temperature resistance confirmed"}</h3>
                          <p>Confirm the resistance check, then enter both measurements directly below.</p>
                        </div>
                      </div>
                      <Choice
                        label={brand === "taylor" ? "Thermocouple resistance confirmed" : "Temperature resistance confirmed"}
                        onChange={(value) => updateResponse("verification", "temperature-resistance", value)}
                        value={getResponse("verification", "temperature-resistance")}
                      />
                      {(getResponse("verification", "temperature-resistance") === "no" || getResponse("verification", "temperature-resistance") === "na") && (
                        <div className="inlineAlert"><strong>Observation required</strong><span>Document this result in Verification observations.</span></div>
                      )}
                    </article>

                    {[
                      { key: "room-resistance", title: "Room temperature resistance", min: selectedEquipment.room.min, max: selectedEquipment.room.max, value: roomResistance, setValue: setRoomResistance, valid: validation.roomValid },
                      { key: "cryo-resistance", title: "Cryogenic temperature resistance", min: selectedEquipment.cryo.min, max: selectedEquipment.cryo.max, value: cryoResistance, setValue: setCryoResistance, valid: validation.cryoValid },
                    ].map((measurement, index) => {
                      const invalid = measurement.value.trim() !== "" && !measurement.valid;
                      const numericWarning = numericWarnings[measurement.key];
                      return (
                        <article className={`measurementCard ${invalid ? "invalid" : ""}`} key={measurement.title}>
                          <div className="measurementTop"><div><span className="questionNumber">{String(index + 2).padStart(2, "0")}</span><h3>{measurement.title}</h3></div><span className="rangePill">{measurement.min} &lt; R &lt; {measurement.max} Ω</span></div>
                          <label className="measureInput"><span>Measured value</span><div><input aria-label={measurement.title} inputMode="decimal" onChange={(event) => updateNumericValue(measurement.key, event.target.value, measurement.setValue, "nonnegative")} placeholder="Required" value={measurement.value} /><b>Ω</b></div></label>
                          {numericWarning && <div className="inputWarning">{numericWarning}</div>}
                          {invalid && <div className="hardStopAlert"><span>!</span><div><strong>Hard stop · Value outside approved range</strong><p>Enter a value greater than {measurement.min} Ω and less than {measurement.max} Ω.</p></div></div>}
                        </article>
                      );
                    })}

                    <article className={`measurementCard ${manualLevel && controllerLevel && !validation.levelValid ? "invalid" : ""}`}>
                      <div className="measurementTop"><div><span className="questionNumber">04</span><h3>Liquid level verification</h3></div><span className="rangePill">Difference ≤ 0.5 in</span></div>
                      <div className="pairedInputs">
                        <label className="measureInput"><span>Manually measured liquid level</span><div><input aria-label="Manual liquid level" inputMode="decimal" onChange={(event) => updateNumericValue("manual-level", event.target.value, setManualLevel, "nonnegative")} placeholder="Required" value={manualLevel} /><b>in</b></div>{numericWarnings["manual-level"] && <small className="numericWarning">{numericWarnings["manual-level"]}</small>}</label>
                        <label className="measureInput"><span>Controller displayed level</span><div><input aria-label="Controller liquid level" inputMode="decimal" onChange={(event) => updateNumericValue("controller-level", event.target.value, setControllerLevel, "nonnegative")} placeholder="Required" value={controllerLevel} /><b>in</b></div>{numericWarnings["controller-level"] && <small className="numericWarning">{numericWarnings["controller-level"]}</small>}</label>
                        <div className={`calculation ${validation.levelValid ? "pass" : "fail"}`}><span>Recorded difference</span><strong>{validation.difference} in</strong><small>{validation.levelValid ? "Within tolerance" : "Incomplete or hard stop"}</small></div>
                      </div>
                      {manualLevel && controllerLevel && !validation.levelValid && <div className="hardStopAlert"><span>!</span><div><strong>Hard stop · Difference exceeds tolerance</strong><p>The maximum permitted difference is 0.5 in.</p></div></div>}
                    </article>
                  </div>
                  {renderChecklist("verification", verificationItems[brand], false)}
                  {renderSectionNotes(
                    "verification",
                    getResponse("verification", "temperature-resistance") === "no" ||
                    getResponse("verification", "temperature-resistance") === "na" ||
                    verificationItems[brand].some((item) => {
                      const answer = getResponse("verification", item.id);
                      return answer === "no" || answer === "na";
                    }),
                  )}
                </>
              )}

              {activeStep === "examination" && (
                <>
                  <div className="examContent">
                    <div className="instructionBand"><div className="instructionMark">i</div><div><strong>Record controller configuration</strong><p>Select temperature and level units first, then enter the actual settings.</p></div></div>
                    <section className="numericGroup" aria-labelledby="temperature-values-title">
                      <div className="numericGroupHeader"><span>T</span><div><strong id="temperature-values-title">Temperature values</strong><p>Numbers only. Every temperature value must be negative.</p></div></div>
                      <div className="numericFieldStack">
                        {examField("highTemperature", "High Temperature A-B", examValues.temperatureUnit || "unit", "Negative value required", "temperature")}
                        {examField("lowTemperature", "Low Temperature A-B", examValues.temperatureUnit || "unit", "Negative value required", "temperature")}
                        {!temperatureOrderValid && <p className="rangeOrderWarning" role="alert">Low Temperature A-B must be lower than High Temperature A-B.</p>}
                        <label className="dataField">
                          <span>Gas Bypass Temperature Set Point</span>
                          <div className="dataInput"><input aria-label="Gas bypass temperature set point" disabled={gasBypassTemperatureNA} inputMode="decimal" onChange={(event) => updateExamNumeric("gasBypassTemperature", event.target.value, "temperature")} placeholder={gasBypassTemperatureNA ? "Not applicable" : "Negative value required"} value={examValues.gasBypassTemperature} /><b>{examValues.temperatureUnit || "unit"}</b></div>
                          {numericWarnings["exam-gasBypassTemperature"] && <small className="numericWarning">{numericWarnings["exam-gasBypassTemperature"]}</small>}
                          <label className="naToggle"><input checked={gasBypassTemperatureNA} onChange={(event) => { setGasBypassTemperatureNA(event.target.checked); if (event.target.checked) { setExamValues((current) => ({ ...current, gasBypassTemperature: "" })); setNumericWarnings((current) => ({ ...current, "exam-gasBypassTemperature": "" })); } }} type="checkbox" />Not applicable</label>
                        </label>
                      </div>
                    </section>

                    <section className="numericGroup" aria-labelledby="level-values-title">
                      <div className="numericGroupHeader"><span>L</span><div><strong id="level-values-title">Level values</strong><p>Numbers only. Negative values are not accepted.</p></div></div>
                      <div className="numericFieldStack">
                        {examField("highLevelAlarm", "High Level Alarm", examValues.levelUnit || "unit", "Non-negative value required", "nonnegative")}
                        {examField("highLevelSetPoint", "High Level Set Point", examValues.levelUnit || "unit", "Non-negative value required", "nonnegative")}
                        {examField("lowLevelSetPoint", "Low Level Set Point", examValues.levelUnit || "unit", "Non-negative value required", "nonnegative")}
                        {examField("lowLevelAlarm", "Low Level Alarm", examValues.levelUnit || "unit", "Non-negative value required", "nonnegative")}
                        {!levelAlarmOrderValid && <p className="rangeOrderWarning" role="alert">Low Level Alarm must be lower than High Level Alarm.</p>}
                        {!levelSetPointOrderValid && <p className="rangeOrderWarning" role="alert">Low Level Set Point must be lower than High Level Set Point.</p>}
                      </div>
                    </section>

                    <section className="numericGroup" aria-labelledby="time-values-title">
                      <div className="numericGroupHeader"><span>TM</span><div><strong id="time-values-title">Time values</strong><p>Numbers only. Negative time values are not accepted.</p></div></div>
                      <div className="numericFieldStack">
                        <label className="dataField">
                          <span>Gas Bypass Time Delay</span>
                          <div className="dataInput"><input aria-label="Gas bypass time delay" disabled={gasBypassDelayNA} inputMode="decimal" onChange={(event) => updateExamNumeric("gasBypassDelay", event.target.value, "nonnegative")} placeholder={gasBypassDelayNA ? "Not applicable" : "Non-negative value required"} value={examValues.gasBypassDelay} /><b>min</b></div>
                          {numericWarnings["exam-gasBypassDelay"] && <small className="numericWarning">{numericWarnings["exam-gasBypassDelay"]}</small>}
                          <label className="naToggle"><input checked={gasBypassDelayNA} onChange={(event) => { setGasBypassDelayNA(event.target.checked); if (event.target.checked) { setExamValues((current) => ({ ...current, gasBypassDelay: "" })); setNumericWarnings((current) => ({ ...current, "exam-gasBypassDelay": "" })); } }} type="checkbox" />Not applicable</label>
                        </label>
                        {examField("maximumFillTime", "Maximum Fill Time", "min", "Non-negative value required", "nonnegative")}
                        {examField("eventLogInterval", "Event Log Interval", "min", "Non-negative value required", "nonnegative")}
                      </div>
                    </section>

                    <section className="configurationGroup" aria-labelledby="configuration-values-title">
                      <div className="numericGroupHeader"><span>U</span><div><strong id="configuration-values-title">Units and controller</strong><p>Select the displayed units and record the controller field from the PM.</p></div></div>
                      <div className="configurationGrid">
                        <label className="dataField">
                          <span>Temperature Unit</span>
                          <select aria-label="Temperature unit" onChange={(event) => setExamValues((current) => ({ ...current, temperatureUnit: event.target.value }))} value={examValues.temperatureUnit}>
                            <option value="">Select unit</option><option value="°C">°C</option><option value="°F">°F</option><option value="K">K</option>
                          </select>
                        </label>
                        <label className="dataField">
                          <span>Level Unit</span>
                          <select aria-label="Level unit" onChange={(event) => setExamValues((current) => ({ ...current, levelUnit: event.target.value }))} value={examValues.levelUnit}>
                            <option value="">Select unit</option><option value="in">in</option><option value="cm">cm</option><option value="%">%</option>
                          </select>
                        </label>
                      </div>
                    </section>
                  </div>
                  {renderSectionNotes(
                    "examination",
                    gasBypassTemperatureNA ||
                    gasBypassDelayNA,
                  )}
                </>
              )}

              {activeStep === "review" && (
                <div className="reviewContent">
                  <div className="reviewBanner"><span>Ready</span><div><strong>PM questionnaire complete</strong><p>Review the recorded information before the signatures phase.</p></div></div>
                  <div className="summaryGrid">
                    <div><small>Equipment</small><strong>{freezerSerial}</strong><span>{selectedEquipment.label} · {family} · {model}</span></div>
                    <div><small>Completed sections</small><strong>4 of 4</strong><span>COVE inspection</span></div>
                    <div><small>Measurements</small><strong>{passedMeasurements} passed</strong><span>No active hard stops</span></div>
                    <div><small>Responses</small><strong>{yesCount} Yes · {noCount} No</strong><span>{naCount} N/A</span></div>
                  </div>
                  <div className="reviewSections">
                    {(["construction", "operation", "verification", "examination"] as const).map((section) => (
                      <div key={section}><span>{steps.find((step) => step.key === section)?.label}</span><strong>{notes[section] || "No observations recorded"}</strong></div>
                    ))}
                  </div>
                  <label className="notesField"><span>Overall service notes · Optional</span><textarea onChange={(event) => setNotes((current) => ({ ...current, general: event.target.value }))} placeholder="Final service summary. Do not enter patient, sample or clinical data." value={notes.general} /></label>
                  {completionStatus === "completed" ? (
                    <div className="signatureComplete">
                      <span>Completed</span>
                      <div>
                        <strong>Technician responsibility and PM receipt recorded</strong>
                        <p>
                          Signed {signatureCapturedAt ? new Date(signatureCapturedAt).toLocaleString() : ""}
                          {signatureRetentionUntil ? ` · Signatures retained until ${new Date(signatureRetentionUntil).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="signatureSections">
                      <section className="recipientSignatureSection" aria-labelledby="technician-signature-title">
                        <div className="signatureHeading">
                          <div>
                            <span>Service responsibility</span>
                            <h2 id="technician-signature-title">Responsible PM technician signature</h2>
                          </div>
                          <small>Required to certify responsibility for the work recorded in this PM.</small>
                        </div>
                        <label className="technicianNameField"><span>Responsible technician name</span><input aria-label="Responsible technician name" autoComplete="name" maxLength={120} onChange={(event) => setTechnicianName(event.target.value)} placeholder="Full name" required value={technicianName} /></label>
                        <SignaturePad
                          ariaLabel="Responsible PM technician signature area"
                          disabled={completionStatus === "completing"}
                          onChange={setTechnicianSignature}
                        />
                        <label className="signatureConsent">
                          <input
                            checked={technicianResponsible}
                            disabled={completionStatus === "completing"}
                            onChange={(event) => setTechnicianResponsible(event.target.checked)}
                            type="checkbox"
                          />
                          <span>I certify that I performed or supervised the preventive maintenance documented in this PM and that the recorded information is accurate.</span>
                        </label>
                      </section>
                      <section className="recipientSignatureSection" aria-labelledby="recipient-signature-title">
                        <div className="signatureHeading">
                          <div>
                            <span>Service receipt</span>
                            <h2 id="recipient-signature-title">PM recipient signature</h2>
                          </div>
                          <small>Required to confirm receipt of the completed preventive maintenance.</small>
                        </div>
                        <SignaturePad
                          ariaLabel="PM recipient signature area"
                          disabled={completionStatus === "completing"}
                          onChange={setRecipientSignature}
                        />
                        <label className="signatureConsent">
                          <input
                            checked={recipientAccepted}
                            disabled={completionStatus === "completing"}
                            onChange={(event) => setRecipientAccepted(event.target.checked)}
                            type="checkbox"
                          />
                          <span>I confirm receipt of the preventive maintenance documented in this PM.</span>
                        </label>
                      </section>
                      <div className="signaturePrivacy">
                        The technician name and both signatures are retained for six years. Recipient names, email addresses, IP addresses, drawing pressure, speed and timing are not collected.
                      </div>
                    </div>
                  )}
                </div>
              )}

              <footer className="formFooter">
                <button className="backButton" disabled={currentIndex === 0} onClick={() => setActiveStep(steps[currentIndex - 1].key)} type="button">Back</button>
                <div className="footerRight">
                  {!activeComplete && <span className="blockingMessage">{blockingMessage()}</span>}
                  {saveStatus === "error" && <span className="blockingMessage" role="alert">{saveError}</span>}
                  {completionStatus === "error" && <span className="blockingMessage" role="alert">{completionError}</span>}
                  {activeStep !== "review"
                    ? <button className="nextButton" disabled={!activeComplete || saveStatus === "saving"} onClick={() => void goNext()} type="button">{saveStatus === "saving" ? "Saving..." : "Save and continue"}</button>
                    : <button
                        className="nextButton"
                        disabled={
                          !activeComplete ||
                          !technicianSignature ||
                          !technicianName.trim() ||
                          !technicianResponsible ||
                          !recipientSignature ||
                          !recipientAccepted ||
                          completionStatus === "completing" ||
                          completionStatus === "completed"
                        }
                        onClick={() => void completePm()}
                        type="button"
                      >
                        {completionStatus === "completing" ? "Completing PM..." : completionStatus === "completed" ? "PM completed" : "Complete PM"}
                      </button>}
                </div>
              </footer>
            </section>

            <aside className="contextPanel">
              <div className="contextHeader"><span>Order details</span><strong>{draftRecordNumber ?? selectedEquipment.order}</strong></div>
              <dl>
                <div><dt>PM template</dt><dd>{selectedEquipment.template}</dd></div>
                {brand === "mve" && <div><dt>Facility</dt><dd>{facility || "Pending"}</dd></div>}
                <div><dt>Equipment model</dt><dd>{family} · {model}</dd></div>
                {brand === "mve" && <div><dt>Firmware</dt><dd>{firmwareVersion || "Pending"}</dd></div>}
                <div><dt>Controller</dt><dd>{controllerType}{controllerSerial ? ` · ${controllerSerial}` : ""}</dd></div>
                <div><dt>Lab and location</dt><dd>{labName || "Pending"}{location ? ` · ${location}` : ""}</dd></div>
                <div><dt>PM frequency</dt><dd>Annual</dd></div>
              </dl>
              <div className="privacyCard"><span className="lockMark">P</span><div><strong>Privacy guard</strong><p>Do not enter patient, sample, clinical or credential information.</p></div></div>
              <div className="findingCard">
                <div className="findingHeader"><span>Recorded results</span><b>{noCount}</b></div>
                <strong>{noCount === 0 ? "No failed checks recorded" : `${noCount} failed check${noCount === 1 ? "" : "s"}`}</strong>
                <p>Failed and N/A responses require a section observation before continuing.</p>
              </div>
              <div className="helpCard"><strong>Sequential validation active</strong><p>Later sections unlock only after the current section is complete.</p></div>
            </aside>
          </div>
            </>
          )}
        </div>
      </section>
      {mobileMenu && <button className="backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} type="button" />}
    </main>
  );
}
