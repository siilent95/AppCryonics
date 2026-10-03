"use client";
import type { InspectionStep, ChecklistItem, ExamValues } from "@/features/pm/types";
import { steps, constructionItems, operationItems, verificationItems, modelCatalog } from "@/features/pm/catalogs";
import { controllerOptions, freezerImage } from "@/features/pm/helpers";
import { Choice } from "@/features/pm/components/Choice";

import { SignaturePad } from "@/features/pm/components/SignaturePad";





import type { usePmWorkspace } from "./usePmWorkspace";
export function MaintenanceForm({ workspace }: { workspace: ReturnType<typeof usePmWorkspace> }) {
  const {
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
    selectedEquipment,
    selectedFamily,
    currentIndex,
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
    goNext,
    completePm,
    blockingMessage,
  } = workspace;
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
);
}
