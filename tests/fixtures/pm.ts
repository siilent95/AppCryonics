import sharp from "sharp";
import { constructionItems, operationItems, verificationItems } from "../../features/pm/catalogs";
import type { BrandKey } from "../../features/pm/types";
export function completeQaDraft(brand: BrandKey, date = "2026-10-23") {
  const responses: Record<string, string> = {};
  for (const [section, items] of [["construction", constructionItems], ["operation", operationItems[brand]], ["verification", verificationItems[brand]]] as const) for (const item of items) responses[`${brand}:${section}:${item.id}`] = "yes";
  responses[`${brand}:verification:temperature-resistance`] = "yes";
  if (brand === "mve") responses[`${brand}:operation:resistance-confirmed`] = "yes";
  return {
    brand, modelFamily: brand === "mve" ? "HEco 800 Series" : "K-Series", model: brand === "mve" ? "815P-190" : "38K",
    facility: "QA local facility", labName: "QA Laboratory - synthetic", clientOrganization: "CRYOPM QA - SYNTHETIC DATA", performedOn: date,
    firmwareVersion: brand === "mve" ? "QA-2.4.1" : null, freezerSerial: `QA-PDF-${brand.toUpperCase()}-001`, controllerSerial: `QA-CTRL-${brand.toUpperCase()}-001`,
    location: "Local test bench - no real equipment", controllerType: brand === "mve" ? "MVE Touch Screen" : "CS200", currentStep: "review", templateVersion: "0.2",
    payload: {
      responses,
      notes: { construction: "TEST ONLY. Visual and mechanical checks simulated; no physical equipment was inspected.", operation: "TEST ONLY. Simulated electrical, valve and battery readings. All values are synthetic.", verification: "TEST ONLY. Simulated resistance and level verification. Difference is 0.20 in.", examination: "TEST ONLY. Synthetic controller settings used to verify the PDF export.", general: "TEST RECORD ONLY - NO REAL MAINTENANCE. Technician and recipient marks are synthetic QA labels, not personal signatures. Created to verify persistent storage and direct PDF download." },
      measurements: { batteryVoltage: brand === "mve" ? "24.6" : "12.5", singleValveResistance: brand === "mve" ? "68" : null, dualValveResistance: brand === "mve" ? "33" : null, purgeValveResistance: brand === "mve" ? "140" : null, roomResistance: brand === "mve" ? "1050" : "6.8", cryoResistance: brand === "mve" ? "250" : "22", manualLevel: "3.2", controllerLevel: "3.4" },
      examination: { temperatureUnit: "°C", levelUnit: "in", highTemperature: "-170", lowTemperature: "-190", highLevelAlarm: "6", highLevelSetPoint: "5", lowLevelSetPoint: "2", lowLevelAlarm: "1", gasBypassTemperature: "-120", gasBypassDelay: "3", maximumFillTime: "20", eventLogInterval: "15" },
      flags: { gasBypassTemperatureNA: false, gasBypassDelayNA: false },
    },
  };
}
export async function qaSignature(role: "TECHNICIAN" | "RECIPIENT") {
  return sharp(Buffer.from(`<svg width="600" height="140" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="140" fill="white"/><rect x="5" y="5" width="590" height="130" fill="none" stroke="#165d78" stroke-width="3"/><text x="25" y="60" font-family="sans-serif" font-size="24" fill="#165d78">QA ${role} - TEST ONLY</text><text x="25" y="102" font-family="sans-serif" font-size="18" fill="#536879">Synthetic mark - no personal signature</text></svg>`)).png().toBuffer();
}
export async function qaSigningInput(expectedRevision: number) {
  const [technician, recipient] = await Promise.all([qaSignature("TECHNICIAN"), qaSignature("RECIPIENT")]);
  return { expectedRevision, technicianName: "QA Technician - synthetic", technicianResponsible: true, technicianAcceptanceVersion: "PM_TECHNICIAN_RESPONSIBILITY_V1", recipientAccepted: true, recipientAcceptanceVersion: "PM_RECEIPT_V1", technicianSignatureDataUrl: `data:image/png;base64,${technician.toString("base64")}`, recipientSignatureDataUrl: `data:image/png;base64,${recipient.toString("base64")}` };
}
