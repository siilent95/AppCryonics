import { activateOwner, clearOwner, deleteEntry, entries, metadata, readEntry, updateEntry, writeEntry } from "./vault";
import type { LocalDraft, OfflineUser, Preparation, SyncOperation, WorkspaceSnapshot } from "./types";
import type { ReportDetail, SavedRecord } from "../pm/types";

export type OfflineState = { ready: boolean; online: boolean; pending: number; error: string; blocked: boolean; progress: string; preparing: boolean; prepared: Preparation | null; revision: number; acknowledgements: number };
export function hasWork(s: WorkspaceSnapshot) {
  const b = s.body;
  return Boolean(b.facility || b.labName || b.clientOrganization || b.freezerSerial || b.controllerSerial || b.location || b.firmwareVersion || Object.keys(b.payload.responses || {}).length || Object.values(b.payload.notes || {}).some(Boolean) || Object.values(b.payload.measurements || {}).some(Boolean) || Object.values(b.payload.examination || {}).some(Boolean) || Object.values(b.payload.flags || {}).some(Boolean) || s.capture.technicianSignature || s.capture.recipientSignature || s.capture.technicianName || s.capture.technicianResponsible || s.capture.recipientAccepted || b.performedOn !== new Date().toLocaleDateString("sv-SE") || b.brand !== "taylor" || b.model !== "3K");
}
function operation(draft: LocalDraft): SyncOperation {
  return { operationId: crypto.randomUUID(), localId: draft.id, recordId: draft.server?.id || null, expectedRevision: draft.server?.revision || null, sequence: draft.sequence, mode: draft.closing ? (draft.snapshot.correctsRecordId ? "correction" : "complete") : "draft", body: structuredClone(draft.snapshot.body), capture: structuredClone(draft.snapshot.capture) };
}
export class OfflineEngine {
  user: OfflineUser | null = null;
  readonly tabId = typeof crypto !== "undefined" ? crypto.randomUUID() : "server";
  private state: OfflineState = { ready:false, online:true, pending:0, error:"", blocked:false, progress:"", preparing:false, prepared:null, revision:0, acknowledgements:0 };
  private listeners = new Set<() => void>();
  private writes: Promise<unknown> = Promise.resolve();
  private sending = false;
  private editingLocks = new Map<string, () => void>();
  private async claim(id: string) {
    if (typeof navigator === "undefined" || !navigator.locks) return false;
    if (this.editingLocks.has(id)) return true;
    const acquired = await new Promise<boolean>((resolve, reject) => {
      void navigator.locks.request(`cryopm-edit:${this.user?.id}:${id}`, {mode:"exclusive",ifAvailable:true}, async lock => {
        if (!lock) { resolve(false); return; }
        await new Promise<void>(release => { this.editingLocks.set(id,release); resolve(true); });
      }).catch(reject);
    });
    if (!acquired) throw new Error("This PM is being edited in another tab.");
    return true;
  }
  private timer?: ReturnType<typeof setTimeout>;
  constructor(readonly transport: typeof fetch = (...args) => fetch(...args)) {}
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getState = () => this.state;
  publish(update: Partial<OfflineState> = {}) { this.state = { ...this.state, ...update, revision:this.state.revision+1 }; this.listeners.forEach(fn=>fn()); }
  async activate(user: OfflineUser, offlineStart = false) {
    const active = await metadata<{ owner: string; generation?:string }>("active");
    if (active && active.owner !== user.id) {
      const drafts = await entries<LocalDraft>(active.owner, "draft:");
      if (drafts.some(d => d.sequence > d.syncedSequence)) { this.publish({ blocked:true, error:"This tablet has unsynchronized work from the previous technician. Sign back in as that technician before handing it over." }); return; }
      await clearOwner(active.owner,active.generation);
    }
    this.user = user;
    await activateOwner(user.id); await writeEntry(user.id,"profile",user);
    const prepared = await readEntry<Preparation>(user.id, "prepared");
    this.publish({ ready:true, blocked:false, prepared:prepared || null, online: !offlineStart && (typeof navigator === "undefined" || navigator.onLine), error:"" });
    await this.refreshCounts();
  }
  async drafts() { return this.user ? entries<LocalDraft>(this.user.id, "draft:") : []; }
  async draft(id: string) { return this.user ? readEntry<LocalDraft>(this.user.id, `draft:${id}`) : undefined; }
  async checkpoint() { return this.user ? readEntry<{ activeId: string | null }>(this.user.id, "workspace") : undefined; }
  async setActive(id: string | null) { if (this.user) await writeEntry(this.user.id, "workspace", { activeId:id }); }
  async refreshCounts() { const drafts = await this.drafts(); this.publish({ pending:drafts.filter(d=>d.sequence>d.syncedSequence).length }); }
  private serial<T>(fn: () => Promise<T>): Promise<T> { const job = this.writes.then(fn); this.writes=job.catch(()=>{}); return job; }
  async flush() { await this.writes; }
  persist(id: string, snapshot: WorkspaceSnapshot, options: { formal?: boolean; close?: boolean; server?: SavedRecord } = {}) {
    return this.serial(async () => {
      if (!this.user || this.state.blocked) throw new Error("Device storage is not ready.");
      const locked = await this.claim(id);
      const owner = this.user.id; const now = new Date().toISOString();
      const draft = await updateEntry<LocalDraft>(owner, `draft:${id}`, old => {
        if (old?.closing || old?.status === "completed") return old;
        if (!locked && old?.editor && old.editor !== this.tabId && (old.editorUntil || 0) > Date.now()) throw new Error("This PM is being edited in another tab. Continue in that tab or wait for its editing lease to expire.");
        const changed = !old || JSON.stringify(old.snapshot) !== JSON.stringify(snapshot) || Boolean(options.close && !old.closing);
        const sequence = (old?.sequence || 0) + Number(changed);
        const formal = Boolean(old?.formal || options.formal || options.server);
        const blocked = old?.status === "blocked" && [403,404,409].includes(old.errorCode || 0);
        return { ...old, version:1, id, ownerId:owner, snapshot:structuredClone(snapshot), sequence, syncedSequence:old?.syncedSequence || (options.server ? sequence : 0),
          formal, server:old?.server || options.server || null, status:blocked ? "blocked" : formal ? "pending" : "local", operation:old?.status === "blocked" && !blocked ? null : old?.operation || null,
          closing:!!options.close, error: blocked ? old!.error : "", errorCode:blocked ? old!.errorCode : undefined,
          updatedAt:changed ? now : old!.updatedAt, syncedAt:old?.syncedAt || null, editor:this.tabId, editorUntil:Date.now()+45_000 };
      });
      await this.setActive(id); await this.refreshCounts();
      if (draft?.formal && draft.status !== "blocked") this.schedule();
      return draft!;
    });
  }
  async resume(id: string) {
    if (!this.user) throw new Error("Device storage is not ready.");
    const locked = await this.claim(id);
    const draft = await updateEntry<LocalDraft>(this.user.id, `draft:${id}`, old => {
      if (!old) throw new Error("Local PM not found.");
      if (!locked && old.editor && old.editor !== this.tabId && (old.editorUntil || 0)>Date.now()) throw new Error("This PM is open in another tab.");
      return { ...old, editor:this.tabId, editorUntil:Date.now()+45_000 };
    });
    await this.setActive(id); return draft!;
  }
  adopt(snapshot: WorkspaceSnapshot, server: SavedRecord) {
    return this.serial(async () => {
      if (!this.user) throw new Error("Device storage is not ready.");
      const found=(await this.drafts()).find(d=>d.server?.id===server.id);
      if(found && found.sequence>found.syncedSequence) return this.resume(found.id);
      const id=found?.id || server.id;
      const locked=await this.claim(id);
      const draft=await updateEntry<LocalDraft>(this.user.id,`draft:${id}`,old=>{
        if(!locked&&old?.editor&&old.editor!==this.tabId&&(old.editorUntil||0)>Date.now())throw new Error("This PM is open in another tab.");
        if(old&&old.sequence>old.syncedSequence)return old;
        return {version:1,id,ownerId:this.user!.id,sequence:(old?.sequence||0)+1,syncedSequence:(old?.sequence||0)+1,snapshot:structuredClone(snapshot),server,formal:true,status:"synced",operation:null,closing:false,error:"",updatedAt:new Date().toISOString(),syncedAt:new Date().toISOString(),editor:this.tabId,editorUntil:Date.now()+45_000};
      });
      await this.setActive(id);await this.refreshCounts();return draft!;
    });
  }
  async release(id: string) {
    if (!this.user) return;
    await this.flush();
    await updateEntry<LocalDraft>(this.user.id, `draft:${id}`, old => old ? { ...old, editor:undefined, editorUntil:0 } : null);
    this.editingLocks.get(id)?.(); this.editingLocks.delete(id);
    await this.setActive(null); this.publish();
  }
  schedule() { clearTimeout(this.timer); this.timer=setTimeout(()=>{ void this.sync(); }, 1200); }
  async retry(id?: string) {
    if (this.user && id) await updateEntry<LocalDraft>(this.user.id, `draft:${id}`, old => old && old.errorCode !== 409 && old.errorCode !== 403 && old.errorCode !== 404 ? { ...old, status:"pending", error:"", errorCode:undefined } : old || null);
    await this.sync();
  }
  async sync() {
    await this.flush(); if (!this.user || !this.state.ready || this.state.blocked || this.sending) return;
    this.sending=true; const owner=this.user.id;
    try {
      let session: Response;
      try { session=await this.transport("/api/offline/session", { cache:"no-store", signal:AbortSignal.timeout(8000) }); }
      catch { this.publish({ online:false }); return; }
      if (!session.ok) { this.publish({ online:session.status<500, error:session.status===401 ? "Sign in again as the current technician to synchronize. Your device copy is preserved." : "The server is unavailable. Your work is saved on this device." }); return; }
      const identity=await session.json();
      if (identity.user.id !== owner) { this.publish({ blocked:true, error:"The server session belongs to another technician. Sign back in as the owner of this device's pending work." }); return; }
      this.publish({ online:true, error:"" });
      // At most one request at a time; conflicts in one PM do not stop another.
      for (const initial of await this.drafts()) {
        if (initial.sequence<=initial.syncedSequence || !initial.formal || initial.status==="blocked") continue;
        const selected=await updateEntry<LocalDraft>(owner, `draft:${initial.id}`, d => d && d.formal && d.sequence>d.syncedSequence && d.status!=="blocked" ? { ...d, operation:d.operation || operation(d) } : d || null);
        const op=selected?.operation; if (!op) continue;
        let response: Response;
        try { response=await this.transport("/api/pm-sync", { method:"POST", headers:{ "Content-Type":"application/json", "X-CryoPM-Actor":owner }, body:JSON.stringify(op), signal:AbortSignal.timeout(15000) }); }
        catch { this.publish({ online:false }); break; }
        const result=await response.json();
        if (!response.ok) {
          if (response.status>=500 || response.status===429) { this.publish({ error:"The server is busy. Pending work is preserved; synchronization will retry." }); break; }
          await updateEntry<LocalDraft>(owner, `draft:${op.localId}`, d=>d ? { ...d, status:"blocked", error:result.error || "Synchronization needs review.", errorCode:response.status } : null);
          continue;
        }
        if (result.localId !== op.localId || result.sequence !== op.sequence || !result.record?.id || !Number.isSafeInteger(result.record.revision)) throw new Error("The server returned an invalid synchronization acknowledgement. The operation has been retained.");
        await updateEntry<LocalDraft>(owner, `draft:${op.localId}`, d => {
          if (!d || d.operation?.operationId!==op.operationId) return d || null;
          return { ...d, server:result.record, syncedSequence:op.sequence, operation:null, status:op.mode!=="draft" ? "completed" : d.sequence>op.sequence ? "pending" : "synced", error:"", errorCode:undefined, syncedAt:new Date().toISOString(), completedAt:result.record.signatureCapturedAt || (op.mode!=="draft" ? new Date().toISOString() : undefined) };
        });
        this.publish({acknowledgements:this.state.acknowledgements+1});
      }
    } catch (error) { this.publish({ error:error instanceof Error ? error.message : "Synchronization failed. Your device copy is preserved." }); }
    finally {
      this.sending=false; await this.refreshCounts();
      if (this.state.online && !this.state.error && (await this.drafts()).some(d=>d.formal && d.status==="pending" && d.sequence>d.syncedSequence)) this.schedule();
    }
  }
  async reopen(id: string) {
    if (!this.user) return;
    await updateEntry<LocalDraft>(this.user.id, `draft:${id}`, d => {
      if (!d || d.status !== "blocked" || [403,404,409].includes(d.errorCode || 0)) throw new Error("Resolve this PM's access or version conflict before editing.");
      return {...d, closing:false, operation:null, status:"pending", error:"", errorCode:undefined};
    });
    await this.refreshCounts();
  }
  async resolve(id: string, detail: ReportDetail, keepLocal: boolean) {
    if (!this.user) return;
    const d=await this.draft(id); if (!d) return;
    await writeEntry(this.user.id, `recovery:${id}:${Date.now()}`, d);
    if (keepLocal && (detail.record.brand!==d.snapshot.body.brand || detail.record.modelFamily!==d.snapshot.body.modelFamily || detail.record.model!==d.snapshot.body.model || (detail.record.equipmentBrandId||detail.record.brand)!==d.snapshot.catalogBrandId)) throw new Error("The device and server copies refer to different equipment. They cannot be combined.");
    if (!keepLocal) { await deleteEntry(this.user.id, `draft:${id}`); await this.setActive(null); }
    else {
      if (!detail.record.canEdit || detail.record.status!=="draft") throw new Error("This PM is no longer editable.");
      await updateEntry<LocalDraft>(this.user.id, `draft:${id}`, old=>old ? { ...old, server:{ id:detail.record.id, recordNumber:detail.record.recordNumber, revision:detail.record.revision }, operation:null, closing:false, status:"pending", error:"", errorCode:undefined } : null);
      this.schedule();
    }
    await this.refreshCounts();
  }
  async handover() {
    await this.flush(); await this.sync(); await this.flush();
    if(this.state.blocked || this.state.error || !this.state.online)throw new Error(this.state.error || "Connect as the current technician to finish signing out.");
    const drafts = await this.drafts();
    if (drafts.some(d=>d.editor && d.editor!==this.tabId && (d.editorUntil||0)>Date.now())) throw new Error("Close other tabs editing this technician’s PMs before handing over the tablet.");
    if (drafts.some(d=>d.sequence>d.syncedSequence)) throw new Error("Synchronize all device drafts before handing this tablet to another technician. Your current work has been preserved.");
    if (!this.user) throw new Error("No active technician.");
    const active=await metadata<{owner:string;generation:string}>("active");
    if(active?.owner!==this.user.id)throw new Error("The active technician changed. Sign in again before signing out.");
    const response=await this.transport("/api/auth/logout", { method:"POST", headers:{"X-CryoPM-Actor":this.user.id}, signal:AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Connect to finish signing out safely.");
    for(const release of this.editingLocks.values())release();this.editingLocks.clear();
    await clearOwner(this.user.id,active.generation); this.user=null; this.publish({ ready:false });
  }
}
export const offlineEngine = new OfflineEngine();
