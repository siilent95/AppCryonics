"use client";
import { useEffect, useRef, useState } from "react";
import { OfflineBoundary } from "../offline/OfflineBoundary";
import { OfflineStatus } from "../offline/OfflineStatus";
import { LocalDraftList } from "../offline/LocalDraftList";
import { offlineEngine } from "../offline/engine";
import { useOffline } from "../offline/useOffline";
import type { OfflineUser } from "../offline/types";
import { UsersView } from "@/features/accounts/UsersView";
import { NavIcon } from "./components/NavIcon";
import { OverviewView } from "./components/OverviewView";
import { EquipmentView } from "./components/EquipmentView";
import { ReportsView } from "./components/ReportsView";
import { usePmWorkspace } from "./usePmWorkspace";
import { MaintenanceForm } from "./MaintenanceForm";
import type { WorkspaceView } from "./types";
const navigation: { view: WorkspaceView; label: string; icon: string }[] = [
  { view: "overview", label: "Overview", icon: "Overview" }, { view: "orders", label: "PM workspace", icon: "Work" },
  { view: "equipment", label: "Equipment", icon: "Assets" }, { view: "reports", label: "Reports", icon: "Reports" },
];
function WorkspaceBrand({ compact = false, user }: { compact?: boolean; user?: { displayName: string; role: "admin" | "technician" } }) {
  return <div className={`brand${compact ? " brandCompact" : ""}`}><img alt="Cryogenics Solution Inc." src="/brand/logo-light.png" /><div><strong>CryoPM</strong><small className="brandDescription">Field maintenance</small>{compact && user && <small className="brandSession" title={`Signed in as ${user.displayName} · ${user.role === "admin" ? "Admin" : "Technician"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg><span className="srOnly">Signed in as </span><span>{user.displayName}</span></small>}</div></div>;
}
export function PmWorkspace({user,offlineStart=false}:{user:OfflineUser;offlineStart?:boolean}) { return <OfflineBoundary user={user} offlineStart={offlineStart}><WorkspaceContent user={user} /></OfflineBoundary>; }
function WorkspaceContent({ user }: { user: OfflineUser }) {
  const offline=useOffline();
  const [handoverError,setHandoverError]=useState("");
  const [handingOver,setHandingOver]=useState(false);
  async function signOut() {
    setHandingOver(true);setHandoverError("");
    try { await workspace.flushLocal(); await offlineEngine.handover(); window.location.assign("/login"); }
    catch(e){setHandoverError(e instanceof Error ? e.message : "Connect to synchronize before changing technician.");}
    finally{setHandingOver(false);}
  }
  const items: typeof navigation = user.role === "admin" ? [...navigation, { view: "users", label: "Users", icon: "Users" }] : navigation;
  const workspace = usePmWorkspace(user);
  const { draftRecordNumber, saveStatus, workspaceView, reportDetail, reportDetailLoading, reportDetailError, refreshRecords, openWorkspaceView, openReport, exportReports, saveDraft } = workspace;
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);
  const main = useRef<HTMLElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        const editing = active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select');
        const keyboardOpen = editing && viewport.scale <= 1.05 && window.innerHeight - viewport.height > 160;
        shell.current?.toggleAttribute("data-keyboard-open", keyboardOpen);
        if (keyboardOpen && active instanceof HTMLElement) {
          const rect = active.getBoundingClientRect();
          if (rect.bottom > viewport.offsetTop + viewport.height - 24 || rect.top < viewport.offsetTop + 72) active.scrollIntoView({ block: "center", behavior: "instant" });
        }
      });
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener("resize", update); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); };
  }, []);
  const previousView = useRef(workspaceView);
  useEffect(() => {
    if (previousView.current !== workspaceView) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); previousView.current = workspaceView; }
  }, [workspaceView]);
  const acknowledged = useRef(offline.acknowledgements);
  useEffect(() => {
    if(acknowledged.current===offline.acknowledgements)return;
    acknowledged.current=offline.acknowledgements;
    if(reportDetail?.localState)void openReport(reportDetail.record);
  // Refresh only on a server acknowledgement, not while another PM is being typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[offline.acknowledgements]);
  const initials = user.displayName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <div ref={shell} className="appShell">
    <a className="skipLink" href="#workspace-main">Skip to content</a>
    <aside className="sidebar">
      <WorkspaceBrand />
      <nav className="primaryNav" aria-label="Primary navigation">{items.map(item => <button className={workspaceView === item.view ? "active" : ""} data-view={item.view} aria-label={item.label} aria-current={workspaceView === item.view ? "page" : undefined} onClick={() => openWorkspaceView(item.view)} type="button" key={item.view}><NavIcon label={item.icon} /><span className="navLabel">{item.label}</span><span className="mobileNavLabel" aria-hidden="true">{item.view === "orders" ? "PMs" : item.label}</span></button>)}</nav>
      <div className="sidebarBottom"><strong>Preventive maintenance</strong><small>MVE &amp; Taylor-Wharton<br />PM v0.2</small></div>
    </aside>
    <section className="workspace">
      <header className="topbar">
        <WorkspaceBrand compact user={user} />
        <div className="breadcrumb"><span>{items.find(item => item.view === workspaceView)?.label}</span>{workspaceView === "orders" && draftRecordNumber && <><b>/</b><strong>{draftRecordNumber}</strong></>}</div>
        <div className="topActions">
        {workspaceView !== "orders" && <button className="ghostButton refreshButton" title="Refresh" onClick={() => { setAnalyticsRefresh(value => value + 1); if (workspaceView === "equipment") void workspace.catalogState.refresh(); else void refreshRecords(); }} type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 17.9 17" /></svg><span>Refresh</span></button>}

          <div className="accountIdentity"><span className="avatar" aria-hidden="true">{initials}</span><span>{user.displayName}<small className="accountRole"> · {user.role === "admin" ? "Admin" : "Technician"}</small></span></div><form onSubmit={event=>{event.preventDefault();void signOut();}}><button className="signOut" disabled={handingOver} type="submit" title="Synchronize and sign out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H5v14h4m5-14 7 7-7 7m-4-7h11" /></svg><span>Sign out</span></button></form>
        </div>
        {workspaceView === "orders" && <div className="pmHeaderActions" role="group" aria-label="PM actions"><span className={`saveState ${saveStatus}`} role="status"><i />{workspace.deviceSaveError ? "Device save failed" : workspace.deviceSaving ? "Saving on device…" : workspace.completionStatus === "queued" ? "Completion pending sync" : workspace.completionStatus === "completed" ? "PM completed" : saveStatus === "saved" ? "Synchronized" : workspace.localDraftId ? "Saved on device · pending sync" : "New draft"}</span><div className="pmSaveButtons">{!(["completed","queued"].includes(workspace.completionStatus)) && <button className="ghostButton" disabled={saveStatus === "saving" || workspace.closingPm || workspace.completionStatus === "completing"} onClick={() => void saveDraft()} type="button">{saveStatus === "saving" ? "Saving…" : "Save draft"}</button>}<button className="ghostButton saveExitButton" disabled={saveStatus === "saving" || workspace.closingPm || workspace.completionStatus === "completing"} onClick={() => void workspace.closeCurrentPm()} type="button">{workspace.closingPm ? "Closing…" : ["completed","queued"].includes(workspace.completionStatus) ? "Close PM" : "Save & exit"}</button></div></div>}
      </header>
      <main id="workspace-main" ref={main} tabIndex={-1} className={`content ${workspaceView === "orders" ? "workOrderContent" : "managementContent"}`}>
        <OfflineStatus />
        {handoverError&&<p className="accountError" role="alert">{handoverError}</p>}
        {workspace.saveError&&<p className="accountError" role="alert">{workspace.saveError} <button type="button" className="ghostButton" onClick={()=>openWorkspaceView("reports")}>Review device drafts</button></p>}
        {workspace.deviceSaveError&&<p className="accountError" role="alert">{workspace.deviceSaveError}</p>}
        {workspaceView === "reports"&&<LocalDraftList onResume={workspace.resumeLocal} onPreview={workspace.previewLocal} />}
        {workspaceView === "overview" && <OverviewView models={workspace.catalogState.catalog.models} brands={workspace.catalogState.catalog.brands} scopeLabel={user.role === "admin" ? "All technicians" : "Created by or assigned to you"} refresh={analyticsRefresh + offline.acknowledgements} onWorkspace={() => openWorkspaceView("orders")} onOpenRecord={record => { openWorkspaceView("reports"); void openReport(record); }} />}
        {workspaceView === "equipment" && <EquipmentView catalogState={workspace.catalogState} isAdmin={user.role === "admin" && offline.online} onUseModel={workspace.useCatalogModel} />}
        {workspaceView === "reports" && <ReportsView refreshKey={analyticsRefresh + workspace.recordsRefresh} onReportsChanged={(ids, deleted) => { workspace.reportsChanged(ids, deleted); setAnalyticsRefresh(value => value + 1); }} onNewPm={() => void workspace.closeCurrentPm("orders")} newPmBusy={workspace.closingPm || saveStatus === "saving"} catalogModels={workspace.catalogState.catalog.models} isAdmin={user.role === "admin" && offline.online} onAssigned={() => { if (reportDetail) void openReport(reportDetail.record); void refreshRecords(); setAnalyticsRefresh(v => v + 1); }} onResume={record => void openReport(record, true)} onCorrectionCreated={async id => { await openReport({ id }, true); await refreshRecords(); setAnalyticsRefresh(v => v + 1); }} onContinue={record => workspace.resumeRecord(record)} detail={reportDetail} detailError={reportDetailError} detailLoading={reportDetailLoading} onExport={exportReports} onOpenReport={record => void openReport(record)} />}
        {workspaceView === "users" && user.role === "admin" && (offline.online ? <UsersView /> : <section className="dataPanel"><h1>Users</h1><p>Connect to manage users, invitations and permissions. No account changes are queued offline.</p></section>)}
        {workspaceView === "orders" && <MaintenanceForm workspace={workspace} />}
      </main>
    </section>
  </div>;
}
