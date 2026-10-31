import { RequestValidationError, parsePayload } from "@/app/api/pm-records/_shared";
import { constructionItems, operationItems, verificationItems, equipment } from "@/features/pm/catalogs";
import type { pmRecords } from "@/db/schema";
import type { ReportPayload } from "@/features/pm/types";
export function validateCorrectionCompletion(record: typeof pmRecords.$inferSelect) {
  const payload = parsePayload(record.payloadJson) as ReportPayload;
  const fail = (message: string): never => { throw new RequestValidationError(message); };
  const text = (value: unknown) => typeof value === "string" && !!value.trim();
  if (![record.clientOrganization, record.performedOn, record.labName, record.freezerSerial, record.controllerSerial, record.location, record.controllerType, ...(record.brand === "mve" ? [record.facility, record.firmwareVersion] : [])].every(text)) fail("Complete the equipment identification before finalizing the correction.");
  const answer = (section: string, id: string) => payload.responses?.[`${record.brand}:${section}:${id}`];
  for (const [section, items] of [["construction", constructionItems], ["operation", operationItems[record.brand]], ["verification", verificationItems[record.brand]]] as const) {
    for (const item of items) {
      const result = answer(section, item.id);
      if (!result || !["yes", "no", "na", "any"].includes(result) || (item.allowNA === false && result === "na")) fail(`Complete ${section} checks before finalizing.`);
      if (["no", "na", "any"].includes(result!) && !text(payload.notes?.[section])) fail(`Record the ${section} observation.`);
    }
  }
  const measurements = payload.measurements || {};
  const number = (key: string) => text(measurements[key]) && Number.isFinite(Number(measurements[key])) ? Number(measurements[key]) : Number.NaN;
  const range = (key: string, min: number, max: number) => number(key) > min && number(key) < max;
  const cfg = equipment[record.brand];
  if (!range("roomResistance", cfg.room.min, cfg.room.max) || !range("cryoResistance", cfg.cryo.min, cfg.cryo.max) || !Number.isFinite(number("manualLevel")) || !Number.isFinite(number("controllerLevel")) || number("manualLevel") < 0 || number("controllerLevel") < 0 || Math.abs(number("manualLevel") - number("controllerLevel")) > .5) fail("Complete the verification measurements within the PM limits.");
  if (!answer("verification", "temperature-resistance")) fail("Confirm the temperature resistance check.");
  if (["no", "na"].includes(answer("verification", "temperature-resistance") || "") && !text(payload.notes?.verification)) fail("Record the verification observation.");
  if (record.brand === "mve" && (!answer("operation", "resistance-confirmed") || !range("singleValveResistance", 62, 74) || !range("dualValveResistance", 28, 38) || !range("purgeValveResistance", 135, 145))) fail("Complete the solenoid resistance checks within the PM limits.");
  if (record.brand === "mve" && ["no", "na"].includes(answer("operation", "resistance-confirmed") || "") && !text(payload.notes?.operation)) fail("Record the operation observation.");
  if (!["yes", "no"].includes(answer("operation", "battery-present") || "")) fail("Confirm whether battery backup is installed.");
  if (answer("operation", "battery-present") === "yes" && (!Number.isFinite(number("batteryVoltage")) || number("batteryVoltage") > cfg.batteryNominal * 1.1 || (number("batteryVoltage") < cfg.batteryNominal && !text(payload.notes?.operation)))) fail("Complete the battery measurement and required observations.");
  const exam = payload.examination || {};
  const numeric = (key: keyof typeof exam) => text(exam[key]) && Number.isFinite(Number(exam[key]));
  if (!["highTemperature", "lowTemperature"].every(key => numeric(key as keyof typeof exam) && Number(exam[key as keyof typeof exam]) < 0) || !["highLevelAlarm", "highLevelSetPoint", "lowLevelSetPoint", "lowLevelAlarm", "maximumFillTime", "eventLogInterval"].every(key => numeric(key as keyof typeof exam) && Number(exam[key as keyof typeof exam]) >= 0) || !["°C", "°F"].includes(exam.temperatureUnit || "") || !["in", "cm", "%"].includes(exam.levelUnit || "")) fail("Complete all examination values.");
  if (!(payload.flags?.gasBypassTemperatureNA || (numeric("gasBypassTemperature") && Number(exam.gasBypassTemperature) < 0)) || !(payload.flags?.gasBypassDelayNA || (numeric("gasBypassDelay") && Number(exam.gasBypassDelay) >= 0))) fail("Complete gas bypass values.");
  if ((payload.flags?.gasBypassTemperatureNA || payload.flags?.gasBypassDelayNA) && !text(payload.notes?.examination)) fail("Record the examination observation.");
  validateExaminationOrder(payload as Record<string, unknown>);
}
export function validateExaminationOrder(payload: Record<string, unknown>) {
  const values = payload.examination;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new RequestValidationError("Examination values must be completed before signing.");
  }
  const exam = values as Record<string, unknown>;
  const pairs = [
    ["lowTemperature", "highTemperature"],
    ["lowLevelAlarm", "highLevelAlarm"],
    ["lowLevelSetPoint", "highLevelSetPoint"],
  ] as const;
  for (const [minimum, maximum] of pairs) {
    const low = Number(exam[minimum]);
    const high = Number(exam[maximum]);
    if (exam[minimum] === "" || exam[maximum] === "" || !Number.isFinite(low) || !Number.isFinite(high) || low >= high) {
      throw new RequestValidationError(`${minimum} must be lower than ${maximum}.`);
    }
  }
}
