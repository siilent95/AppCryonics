"use client";




import { NavIcon } from "@/features/pm/components/NavIcon";

import { OverviewView } from "@/features/pm/components/OverviewView";
import { EquipmentView } from "@/features/pm/components/EquipmentView";
import { ReportsView } from "@/features/pm/components/ReportsView";

import { usePmWorkspace } from "./usePmWorkspace";
import { MaintenanceForm } from "./MaintenanceForm";
export function PmWorkspace() {
  const workspace = usePmWorkspace();
  const {
    mobileMenu,
    setMobileMenu,
    draftId,
    draftRecordNumber,
    saveStatus,
    workspaceView,
    pmRecords,
    recordsStatus,
    recordsError,
    reportDetail,
    reportDetailLoading,
    reportDetailError,
    selectedEquipment,
    openRecordCount,
    equipmentRecords,
    refreshRecords,
    openWorkspaceView,
    openReport,
    exportReports,
    saveDraft,
  } = workspace;

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
          {workspaceView === "orders" && <MaintenanceForm workspace={workspace} />}
        </div>
      </section>
      {mobileMenu && <button className="backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} type="button" />}
    </main>
  );
}
