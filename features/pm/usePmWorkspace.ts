"use client";
import { escapeCsvCell } from "./csv";
import type { Result, StepKey, InspectionStep, BrandKey, SaveStatus, CompletionStatus, WorkspaceView, SavedRecord, PmRecordSummary, ReportDetail, ChecklistItem, NotesState, ExamValues } from "@/features/pm/types";
import { steps, constructionItems, operationItems, verificationItems, modelCatalog, equipment, emptyNotes, emptyExam } from "@/features/pm/catalogs";
import { controllerOptions, hasNumber, hasNonNegativeNumber, hasNegativeNumber, inOpenRange, normalizeDecimal, pmDate, recordBrandLabel, statusLabel } from "@/features/pm/helpers";






import { useEffect, useMemo, useRef, useState } from "react";
import { useEquipmentCatalog } from "@/features/equipment/useEquipmentCatalog";
import type { CatalogModel } from "@/features/equipment/types";
import { offlineEngine, hasWork } from "../offline/engine";
import { offlineJson, readLocal } from "../offline/data";
import { localDetail } from "../offline/reports";
import { emptyCapture, type LocalDraft, type OfflineUser, type WorkspaceSnapshot } from "../offline/types";
export function usePmWorkspace(user: OfflineUser) {
  const [localDraftId,setLocalDraftId]=useState<string|null>(null);
  const [localHydrated,setLocalHydrated]=useState(false);
  const [deviceSaving,setDeviceSaving]=useState(false);
  const [deviceSaveError,setDeviceSaveError]=useState("");
  const [localWritable,setLocalWritable]=useState(true);
  const localIdRef=useRef<string|null>(null);
  const catalogModelIdRef=useRef<string|undefined>(undefined);
  const localTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const catalogState = useEquipmentCatalog();
  const [catalogBrandId, setCatalogBrandId] = useState("taylor");
  const [catalogBrandName, setCatalogBrandName] = useState("Taylor-Wharton");
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
  const [requestedStep, setActiveStep] = useState<StepKey>("construction");
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
  const [correctsRecordId, setCorrectsRecordId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [closingPm, setClosingPm] = useState(false);
  const closeInFlight = useRef(false);
  const saveInFlight = useRef(false);
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
  const [recordsRefresh, setRecordsRefresh] = useState(0);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetailError, setReportDetailError] = useState("");

  const selectedEquipment = useMemo(() => ({ ...equipment[brand], label: catalogBrandName }), [brand, catalogBrandName]);
  const availableFamilies = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const item of catalogState.catalog.models) {
      if (item.brandId !== catalogBrandId || !item.active) continue;
      grouped.set(item.family, [...(grouped.get(item.family) || []), item.model]);
    }
    // A resumed PM keeps its recorded identity, including discontinued models.
    if (!grouped.has(family)) grouped.set(family, [model]);
    else if (!grouped.get(family)!.includes(model)) grouped.get(family)!.push(model);
    return Array.from(grouped, ([family, models]) => ({ family, models }));
  }, [catalogState.catalog.models, catalogBrandId, family, model]);
  const selectedFamily = availableFamilies.find(item => item.family === family)!;
  const selectedCatalogModel = catalogState.catalog.models.find(item => item.brandId === catalogBrandId && item.family === family && item.model === model);
  const modelControllers = selectedCatalogModel?.controllers.length ? selectedCatalogModel.controllers : controllerOptions(brand, family, model);

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
  const currentIndex = Math.min(steps.findIndex(step => step.key === requestedStep), accessibleThrough);
  const activeStep = steps[currentIndex].key;
  const activeComplete = completionByStep[activeStep];

  const draftBody = {
      brand,
      catalogModelId: selectedCatalogModel?.id || catalogModelIdRef.current,
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
      currentStep: activeStep,
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
    };
  const snapshot: WorkspaceSnapshot = {body:draftBody,capture:{technicianSignature,recipientSignature,technicianName,technicianResponsible,recipientAccepted},catalogBrandId,catalogBrandName,requestedStep,correctsRecordId,correctionReason};
  const snapshotRef=useRef(snapshot); snapshotRef.current=snapshot;
  const serializedSnapshot=JSON.stringify(snapshot);

  function applyLocal(d:LocalDraft) {
    const s=d.snapshot,b=s.body,m=b.payload.measurements||{};
    catalogModelIdRef.current=b.catalogModelId;
    localIdRef.current=d.id;setLocalDraftId(d.id);
    setBrand(b.brand);setCatalogBrandId(s.catalogBrandId);setCatalogBrandName(s.catalogBrandName);setFamily(b.modelFamily);setModel(b.model);
    setFacility(b.facility||"");setLabName(b.labName);setClientOrganization(b.clientOrganization);setPerformedOn(b.performedOn);setFirmwareVersion(b.firmwareVersion||"");
    setFreezerSerial(b.freezerSerial);setControllerSerial(b.controllerSerial);setLocation(b.location);setControllerType(b.controllerType);
    setResponses(b.payload.responses||{});setNotes({...emptyNotes,...b.payload.notes});setExamValues({...emptyExam,...b.payload.examination});
    setRoomResistance(m.roomResistance||"");setCryoResistance(m.cryoResistance||"");setSingleValveResistance(m.singleValveResistance||"");setDualValveResistance(m.dualValveResistance||"");setPurgeValveResistance(m.purgeValveResistance||"");
    setBatteryVoltage(m.batteryVoltage||"");setManualLevel(m.manualLevel||"");setControllerLevel(m.controllerLevel||"");
    setGasBypassTemperatureNA(!!b.payload.flags?.gasBypassTemperatureNA);setGasBypassDelayNA(!!b.payload.flags?.gasBypassDelayNA);
    setTechnicianSignature(s.capture.technicianSignature);setRecipientSignature(s.capture.recipientSignature);setTechnicianName(s.capture.technicianName);setTechnicianResponsible(s.capture.technicianResponsible);setRecipientAccepted(s.capture.recipientAccepted);
    setCorrectsRecordId(s.correctsRecordId);setCorrectionReason(s.correctionReason);setActiveStep(s.requestedStep);
    setDraftId(d.server?.id||(d.formal?`local:${d.id}`:null));setDraftRecordNumber(d.server?.recordNumber||(d.formal?`LOCAL-${d.id.slice(0,8).toUpperCase()}`:null));
    setSaveStatus(d.status==="blocked"?"error":d.sequence===d.syncedSequence?"saved":"idle");setSaveError(d.error);setDeviceSaveError("");
    setCompletionStatus(d.status==="completed"?"completed":d.closing?"queued":"idle");setSignatureCapturedAt(d.completedAt||null);
    setWorkspaceView("orders");
  }
  useEffect(()=>{
    let alive=true;
    offlineEngine.checkpoint().then(async checkpoint=>{
      if(checkpoint?.activeId){
        const d=await offlineEngine.draft(checkpoint.activeId);
        if(d&&alive){applyLocal(d);try{await offlineEngine.resume(d.id);}catch(e){setLocalWritable(false);setDeviceSaveError(e instanceof Error?e.message:"This PM is open in another tab.");}}
      }
      if(alive)setLocalHydrated(true);
    }).catch(e=>{if(alive){setDeviceSaveError(`Recovery failed: ${e.message}. Do not overwrite or clear device storage.`);setLocalWritable(false);}});
    const unsubscribe=offlineEngine.subscribe(()=>{
      const id=localIdRef.current;if(!id)return;
      offlineEngine.draft(id).then(d=>{
        if(!alive||localIdRef.current!==id)return;
        if(!d){clearCurrentPm();return;}
        if(d.server){setDraftId(d.server.id);setDraftRecordNumber(d.server.recordNumber);}
        setSaveError(d.error);
        setSaveStatus(d.status==="blocked"?"error":d.syncedSequence===d.sequence?"saved":"idle");
        if(d.status==="completed"){setCompletionStatus("completed");setSignatureCapturedAt(d.completedAt||null);}
      }).catch(e=>setDeviceSaveError(e.message));
    });
    return()=>{alive=false;unsubscribe();};
  // Recovery occurs once, before enabling writes; later acknowledgements update metadata only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user.id]);
  async function flushLocal() {
    if(localTimer.current){clearTimeout(localTimer.current);localTimer.current=null;}
    if(!localHydrated||!localWritable)throw new Error(deviceSaveError||"Device recovery is not ready.");
    if(completionStatus==="queued"||completionStatus==="completed"){await offlineEngine.flush();return;}
    if(!localIdRef.current&&!hasWork(snapshotRef.current))return;
    const id=localIdRef.current||crypto.randomUUID();localIdRef.current=id;setLocalDraftId(id);
    setDeviceSaving(true);
    try{const d=await offlineEngine.persist(id,snapshotRef.current);setSaveStatus(d.status==="blocked"?"error":d.sequence===d.syncedSequence?"saved":"idle");setDeviceSaveError("");}
    catch(e){const message=e instanceof Error?e.message:"Device save failed.";setDeviceSaveError(message);if(message.includes("another tab"))setLocalWritable(false);throw e;}
    finally{setDeviceSaving(false);}
  }
  useEffect(()=>{
    if(!localHydrated||!localWritable||completionStatus==="queued"||completionStatus==="completed")return;
    if(!localIdRef.current&&!hasWork(snapshotRef.current))return;
    localTimer.current=setTimeout(()=>{localTimer.current=null;void flushLocal().catch(()=>{});},0);
    return()=>{if(localTimer.current)clearTimeout(localTimer.current);};
  // Snapshot serialization is deliberate: no render-created object can restart recovery.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[serializedSnapshot,localHydrated,localWritable,catalogState.status]);
  useEffect(()=>{
    const leave=()=>{void flushLocal().catch(()=>{});};window.addEventListener("pagehide",leave);return()=>window.removeEventListener("pagehide",leave);
  // pagehide uses the current rendered snapshot; it must not reinstall on every keystroke.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[localHydrated,completionStatus,localWritable]);
  async function resumeLocal(id:string){
    try{if(localWritable)await flushLocal();const d=await offlineEngine.resume(id);applyLocal(d);setLocalWritable(true);}
    catch(e){setDeviceSaveError(e instanceof Error?e.message:"Unable to recover the local PM.");}
  }
  async function previewLocal(id:string){const d=await offlineEngine.draft(id);if(d){setReportDetail(localDetail(d));setWorkspaceView("reports");}}


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
    const attemptedNegative = kind === "nonnegative" && /[-−]/.test(rawValue);
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

  function selectBrand(nextBrandId: string) {
    if (draftId) return;
    const selectedBrand = catalogState.catalog.brands.find(b => b.id === nextBrandId);
    if (!selectedBrand?.pmTemplate) return;
    const nextBrand = selectedBrand.pmTemplate;
    const candidates = catalogState.catalog.models.filter(m => m.brandId === nextBrandId && m.active);
    if (!candidates.length) return;
    const nextFamily = { family: candidates[0].family, models: [candidates[0].model] };
    const nextModel = nextFamily.models[0];
    setBrand(nextBrand); setCatalogBrandId(nextBrandId); setCatalogBrandName(selectedBrand.name);
    setFamily(nextFamily.family);
    setModel(nextModel);
    setFirmwareVersion("");
    setFreezerSerial("");
    setControllerSerial("");
    setControllerType(candidates[0].controllers[0] || (nextBrand === "mve" ? controllerOptions(nextBrand, nextFamily.family, nextModel)[0] : ""));
    setSaveStatus("idle");
    setSaveError("");
    resetInspection();
  }

  function selectFamily(nextFamilyName: string) {
    if (draftId) return;
    const nextFamily = availableFamilies.find((item) => item.family === nextFamilyName);
    if (!nextFamily) return;
    const nextModel = nextFamily.models[0];
    setFamily(nextFamily.family);
    setModel(nextModel);
    const entry = catalogState.catalog.models.find(m => m.brandId === catalogBrandId && m.family === nextFamily.family && m.model === nextModel);
    if (brand === "mve") setControllerType(entry?.controllers[0] || controllerOptions(brand, nextFamily.family, nextModel)[0]);
  }

  function selectModel(nextModel: string) {
    if (draftId) return;
    setModel(nextModel);
    const entry = catalogState.catalog.models.find(m => m.brandId === catalogBrandId && m.family === family && m.model === nextModel);
    if (brand === "mve") setControllerType(entry?.controllers[0] || controllerOptions(brand, family, nextModel)[0]);
  }

  async function useCatalogModel(entry: CatalogModel) {
    if (!entry.active || !catalogState.catalog.brands.find(b => b.id === entry.brandId)?.pmTemplate) return;
    await closeCurrentPm("orders", entry);
  }

  function refreshRecords() { setRecordsRefresh(value => value + 1); }

  function openWorkspaceView(view: WorkspaceView) {
    setWorkspaceView(view);
    setMobileMenu(false);
    if (view !== "orders") void refreshRecords();
  }

  async function openReport(record: Pick<PmRecordSummary, "id">, resume = false) {
    setReportDetailLoading(true);
    setReportDetailError("");
    setReportDetail(null);
    try {
      const local=await readLocal(record.id.replace(/^local:/,""));
      if(local&&(local.sequence>local.syncedSequence||record.id.startsWith("local:"))){setReportDetail(localDetail(local));if(resume)await resumeLocal(local.id);return;}
      const result=await offlineJson<ReportDetail>(`/api/pm-records/${local?.server?.id || record.id}`);
      setReportDetail(result);
      if (resume) await resumeRecord(result);
    } catch (error) {
      setReportDetailError(error instanceof Error ? error.message : "Unable to retrieve the PM report.");
    } finally {
      setReportDetailLoading(false);
    }
  }

  async function resumeRecord(detail: ReportDetail) {
    try {
    const r=detail.record;if(!r.canEdit)return;
    const existing=await readLocal(r.id.replace(/^local:/,""));
    if(existing && (r.id.startsWith("local:") || existing.sequence>existing.syncedSequence)){await resumeLocal(existing.id);return;}
    await flushLocal();
    let capture={...emptyCapture};
    try{capture=(await offlineJson<{capture:typeof emptyCapture|null}>(`/api/pm-sync?recordId=${r.id}`)).capture||capture;}catch{/* A legacy draft may have no provisional capture. */}
    const snap:WorkspaceSnapshot={body:{catalogModelId:catalogState.catalog.models.find(m=>m.brandId===(r.equipmentBrandId||r.brand)&&m.family===r.modelFamily&&m.model===r.model)?.id,brand:r.brand,modelFamily:r.modelFamily,model:r.model,facility:r.facility,labName:r.labName||"",clientOrganization:r.clientOrganization||"",performedOn:r.performedOn||new Date().toLocaleDateString("sv-SE"),firmwareVersion:r.firmwareVersion,freezerSerial:r.freezerSerial||"",controllerSerial:r.controllerSerial||"",location:r.location||"",controllerType:r.controllerType||"",templateVersion:r.templateVersion,currentStep:(steps.find(s=>s.key===r.currentStep)?.key||"construction"),payload:r.payload},capture,catalogBrandId:r.equipmentBrandId||r.brand,catalogBrandName:recordBrandLabel(r),requestedStep:steps.find(s=>s.key===r.currentStep)?.key||"construction",correctsRecordId:r.correctsRecordId||null,correctionReason:r.correctionReason||""};
    const d=await offlineEngine.adopt(snap,{id:r.id,recordNumber:r.recordNumber,revision:r.revision});applyLocal(d);setLocalWritable(true);
    } catch(e) { setDeviceSaveError(e instanceof Error?e.message:"Unable to open this PM for editing."); }
  }

  function exportReports(records: PmRecordSummary[]) {
    const headers = ["PM Number", "Brand", "Model Family", "Model", "Freezer Serial", "Client", "Lab", "Location", "Technician", "PM Date", "Status", "Created", "Updated"];
    const rows = records.map((record) => [
      record.recordNumber,
      recordBrandLabel(record),
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
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsvCell(String(value))).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cryopm-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveDraft(step: StepKey = activeStep): Promise<SavedRecord | null> {
    if(saveInFlight.current||completionStatus==="completed"||completionStatus==="queued")return null;
    if(catalogState.status!=="loaded"){setSaveError("Load or prepare the equipment catalog before saving the PM.");return null;}
    if(!draftId&&(!selectedCatalogModel||!selectedCatalogModel.active)){setSaveError("Select an active equipment model before saving.");return null;}
    saveInFlight.current=true;setSaveStatus("saving");
    try{
      if(localTimer.current)clearTimeout(localTimer.current);
      const id=localIdRef.current||crypto.randomUUID();localIdRef.current=id;setLocalDraftId(id);
      const snap={...snapshotRef.current,body:{...snapshotRef.current.body,currentStep:step},requestedStep:step};
      const d=await offlineEngine.persist(id,snap,{formal:true});
      setDraftId(d.server?.id||`local:${id}`);setDraftRecordNumber(d.server?.recordNumber||`LOCAL-${id.slice(0,8).toUpperCase()}`);setSaveStatus(d.status==="blocked"?"error":d.sequence===d.syncedSequence?"saved":"idle");setSaveError(d.error);setDeviceSaveError("");
      return d.server||{id:`local:${id}`,recordNumber:`LOCAL-${id.slice(0,8).toUpperCase()}`,revision:0};
    }catch(e){setDeviceSaveError(e instanceof Error?e.message:"Could not save on this device.");setSaveStatus("error");return null;}
    finally{saveInFlight.current=false;}
  }

  async function goNext() {
    if (!activeComplete || currentIndex >= steps.length - 1) return;
    const nextStep = steps[currentIndex + 1].key;
    const saved = await saveDraft(nextStep);
    if (saved) setActiveStep(nextStep);
  }

  function clearCurrentPm(nextModel?: CatalogModel) {
      if(localTimer.current)clearTimeout(localTimer.current);
      localIdRef.current=null;catalogModelIdRef.current=undefined;setLocalDraftId(null);
      const entry = nextModel || catalogState.catalog.models.find(item => item.brandId === "taylor" && item.model === "3K" && item.active) || catalogState.catalog.models.find(item => item.active && catalogState.catalog.brands.some(b => b.id === item.brandId && b.pmTemplate));
      const nextBrand = catalogState.catalog.brands.find(item => item.id === entry?.brandId);
      if (entry && nextBrand?.pmTemplate) { setBrand(nextBrand.pmTemplate); setCatalogBrandId(nextBrand.id); setCatalogBrandName(nextBrand.name); setFamily(entry.family); setModel(entry.model); setControllerType(entry.controllers[0] || ""); }
      setFacility(""); setLabName(""); setClientOrganization(""); setPerformedOn(new Date().toLocaleDateString("sv-SE")); setFirmwareVersion(""); setFreezerSerial(""); setControllerSerial(""); setLocation("");
      resetInspection(); setDraftId(null); setDraftRecordNumber(null);  setCorrectsRecordId(null); setCorrectionReason("");
      setSaveStatus("idle"); setSaveError("");
  }

  function reportsChanged(ids: string[], deleted: boolean) {
    if (deleted && draftId && ids.includes(draftId)) clearCurrentPm();
    if (reportDetail && ids.includes(reportDetail.record.id)) { setReportDetail(null); setReportDetailError(""); }
    void refreshRecords();
  }

  async function closeCurrentPm(view: WorkspaceView = "reports", nextModel?: CatalogModel) {
    if (saveStatus === "saving" || completionStatus === "completing" || closeInFlight.current) return;
    closeInFlight.current = true;
    setClosingPm(true);
    try {
      const hasContent = !!localIdRef.current || hasWork(snapshotRef.current);
      if (!["completed","queued"].includes(completionStatus) && hasContent && !await saveDraft()) { openWorkspaceView("orders"); return; }
      if(localIdRef.current)await offlineEngine.release(localIdRef.current);
      clearCurrentPm(nextModel);
      setSaveStatus("idle"); setSaveError(""); setReportDetail(null); openWorkspaceView(view); void refreshRecords();
    } finally { closeInFlight.current = false; setClosingPm(false); }
  }

  async function completePm() {
    if(!completionByStep.review||["completing","queued","completed"].includes(completionStatus))return;
    if(!correctsRecordId&&(!technicianSignature||!technicianName.trim()||!technicianResponsible||!recipientSignature||!recipientAccepted))return;
    setCompletionStatus("completing");setCompletionError("");
    try{
      if(localTimer.current)clearTimeout(localTimer.current);
      const id=localIdRef.current||crypto.randomUUID();localIdRef.current=id;setLocalDraftId(id);
      const snap={...snapshotRef.current,body:{...snapshotRef.current.body,currentStep:"review" as const},capture:{...snapshotRef.current.capture,capturedAt:new Date().toISOString()},requestedStep:"review" as const};
      const d=await offlineEngine.persist(id,snap,{formal:true,close:true});
      setDraftId(d.server?.id||`local:${id}`);setDraftRecordNumber(d.server?.recordNumber||`LOCAL-${id.slice(0,8).toUpperCase()}`);setCompletionStatus("queued");setSaveStatus("idle");
      void offlineEngine.sync();
    }catch(e){setCompletionStatus("error");setCompletionError(e instanceof Error?e.message:"Could not preserve the completion on this device.");}
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
    localDraftId,localHydrated,localWritable,deviceSaving,deviceSaveError,flushLocal,resumeLocal,previewLocal,
    isCorrection: !!correctsRecordId,
    correctionReason,
    closingPm,
    closeCurrentPm,
    catalogBrandId,
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
    reportDetail,
    reportDetailLoading,
    reportDetailError,
    selectedEquipment,
    selectedFamily,
    currentIndex,
    catalogState,
    availableFamilies,
    selectedCatalogModel,
    modelControllers,
    useCatalogModel,
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
    recordsRefresh,
    reportsChanged,
    openWorkspaceView,
    openReport,
    exportReports,
    resumeRecord,
    saveDraft,
    goNext,
    completePm,
    blockingMessage,
  };
}
