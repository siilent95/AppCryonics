"use client";
import type { Result, StepKey, InspectionStep, BrandKey, SaveStatus, CompletionStatus, WorkspaceView, RecordsStatus, SavedRecord, PmRecordSummary, ReportDetail, EquipmentRegistryItem, ChecklistItem, NotesState, ExamValues } from "@/features/pm/types";
import { steps, constructionItems, operationItems, verificationItems, modelCatalog, equipment, emptyNotes, emptyExam } from "@/features/pm/catalogs";
import { controllerOptions, hasNumber, hasNonNegativeNumber, hasNegativeNumber, inOpenRange, normalizeDecimal, pmDate, brandLabel, statusLabel } from "@/features/pm/helpers";






import { useEffect, useMemo, useState } from "react";
export function usePmWorkspace() {
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
    const timer = setTimeout(() => setSaveStatus((current) => current === "saved" ? "idle" : current), 0);
    return () => clearTimeout(timer);
  }, [
    draftId,
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


 return {
    brand,
    family,
    model,
    facility,
    setFacility,
    labName,
    setLabName,
    clientOrganization,
    setClientOrganization,
    performedOn,
    setPerformedOn,
    firmwareVersion,
    setFirmwareVersion,
    freezerSerial,
    setFreezerSerial,
    controllerSerial,
    setControllerSerial,
    location,
    setLocation,
    controllerType,
    setControllerType,
    activeStep,
    setActiveStep,
    mobileMenu,
    setMobileMenu,
    responses,
    notes,
    setNotes,
    roomResistance,
    setRoomResistance,
    cryoResistance,
    setCryoResistance,
    singleValveResistance,
    setSingleValveResistance,
    dualValveResistance,
    setDualValveResistance,
    purgeValveResistance,
    setPurgeValveResistance,
    batteryVoltage,
    setBatteryVoltage,
    manualLevel,
    setManualLevel,
    controllerLevel,
    setControllerLevel,
    examValues,
    setExamValues,
    numericWarnings,
    setNumericWarnings,
    gasBypassTemperatureNA,
    setGasBypassTemperatureNA,
    gasBypassDelayNA,
    setGasBypassDelayNA,
    draftId,
    draftRecordNumber,
    saveStatus,
    saveError,
    technicianSignature,
    setTechnicianSignature,
    technicianName,
    setTechnicianName,
    technicianResponsible,
    setTechnicianResponsible,
    recipientSignature,
    setRecipientSignature,
    recipientAccepted,
    setRecipientAccepted,
    completionStatus,
    completionError,
    signatureCapturedAt,
    signatureRetentionUntil,
    workspaceView,
    pmRecords,
    recordsStatus,
    recordsError,
    reportDetail,
    reportDetailLoading,
    reportDetailError,
    selectedEquipment,
    selectedFamily,
    currentIndex,
    openRecordCount,
    equipmentRecords,
    getResponse,
    validation,
    identificationComplete,
    batteryPresent,
    batteryMaximum,
    batteryLowVoltage,
    batteryAboveMaximum,
    temperatureOrderValid,
    levelAlarmOrderValid,
    levelSetPointOrderValid,
    completionByStep,
    accessibleThrough,
    activeComplete,
    yesCount,
    noCount,
    naCount,
    passedMeasurements,
    updateNumericValue,
    updateExamNumeric,
    updateResponse,
    selectBrand,
    selectFamily,
    selectModel,
    refreshRecords,
    openWorkspaceView,
    openReport,
    exportReports,
    saveDraft,
    goNext,
    completePm,
    blockingMessage,
  };
}
