import type { StepKey, ChecklistItem, BrandKey, ModelFamily, NotesState, ExamValues } from "./types";
export const steps: { key: StepKey; label: string; short: string }[] = [
  { key: "construction", label: "Construction", short: "01" },
  { key: "operation", label: "Operation", short: "02" },
  { key: "verification", label: "Verification", short: "03" },
  { key: "examination", label: "Examination", short: "04" },
  { key: "review", label: "Review", short: "05" },
];

export const constructionItems: readonly ChecklistItem[] = [
  { id: "turn-tray", label: "Turn tray rotates without restrictions", help: "Check the complete rotation path." },
  { id: "neck-vacuum", label: "No signs of vacuum deterioration on the neck", help: "Inspect frost, condensation and visible deterioration." },
  { id: "relief-valve", label: "Relief valve is present between supply and unit", help: "Confirm placement and visible condition.", anyInsteadOfNo: true },
  { id: "lid-core", label: "Lid core is free of cracks", help: "Inspect the complete lid core." },
  { id: "folding-steps", label: "Folding steps are safe", help: "Check stability, movement and visible damage." },
  { id: "annular-lines", label: "Annular lines are free of blockage", help: "Verify that the lines are unobstructed." },
  { id: "casters", label: "Casters are free of cuts or abrasions", help: "Inspect every caster and its rolling surface." },
];

export const operationItems: Record<BrandKey, readonly ChecklistItem[]> = {
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

export const verificationItems: Record<BrandKey, readonly ChecklistItem[]> = {
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

export const modelCatalog: Record<BrandKey, readonly ModelFamily[]> = {
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

export const equipment = {
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

export const emptyNotes: NotesState = {
  construction: "",
  operation: "",
  verification: "",
  examination: "",
  general: "",
};

export const emptyExam: ExamValues = {
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
