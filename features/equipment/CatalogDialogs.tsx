"use client";
import { useDialogDismiss } from "@/features/shared/useDialogDismiss";
import { useEffect, useRef, useState } from "react";
import { PdfViewer } from "./PdfViewer";
import type { CatalogBrand, CatalogModel } from "./types";
function useModal() { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal(); }, []); return ref; }
async function send(url: string, method: string, body: unknown) {
 const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
 const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save the catalog."); return data;
}
export function DatasheetDialog({ model, brand, onClose }: { model: CatalogModel; brand: string; onClose: () => void }) {
 const ref = useModal(); const dismiss = useDialogDismiss();
 return <dialog {...dismiss} ref={ref} className="catalogDialog datasheetDialog" aria-labelledby="datasheet-title" onClose={onClose}>
  <header><div><p>{brand} · {model.family}</p><h2 id="datasheet-title">{model.model} · Datasheet</h2></div><button autoFocus className="ghostButton" onClick={() => ref.current?.close()} type="button">Close</button></header>
  <div className="documentLinks"><a href={model.datasheetUrl!} target="_blank" rel="noreferrer">Open PDF in a new tab</a><a href={`${model.datasheetUrl}&download=1`} download>Download PDF</a>{model.datasheetSource && <a href={model.datasheetSource} target="_blank" rel="noreferrer">Manufacturer source</a>}</div>
  <PdfViewer url={model.datasheetUrl!} title={`${brand} ${model.model} datasheet`} />
  <p className="documentHelp">If your browser cannot display the document, use Open PDF or Download PDF above.</p>
 </dialog>;
}
export function BrandDialog({ brand, onClose, onSaved }: { brand?: CatalogBrand; onClose: () => void; onSaved: () => Promise<void> }) {
 const ref = useModal(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const dismiss = useDialogDismiss(busy);
 return <dialog {...dismiss} ref={ref} className="catalogDialog catalogEditor" aria-labelledby="brand-title" onClose={onClose}>
  <header><h2 id="brand-title">{brand ? "Edit brand" : "Add a brand"}</h2><button className="ghostButton" onClick={() => ref.current?.close()} type="button" disabled={busy}>Cancel</button></header>
  <p>Choose the PM template used by models of this brand. Existing PMs keep the template and manufacturer recorded when they were created.</p>
  <form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); try { await send(brand ? `/api/equipment/brands/${brand.id}` : "/api/equipment/brands", brand ? "PATCH" : "POST", Object.fromEntries(form)); await onSaved(); ref.current?.close(); } catch(error) { setError(error instanceof Error ? error.message : "Unable to add brand."); } finally { setBusy(false); } }}>
   <label>Brand name<input name="name" required maxLength={120} defaultValue={brand?.name} autoFocus /></label><label>Official website (optional)<input name="website" type="url" placeholder="https://" maxLength={1000} defaultValue={brand?.website || ""} /></label>
   <label>PM template<select name="pmTemplate" required defaultValue={brand?.pmTemplate || ""}><option value="" disabled>Select an existing template</option>{(!brand || brand.id !== "taylor") && <option value="mve">MVE · current PM template</option>}{(!brand || brand.id !== "mve") && <option value="taylor">Taylor-Wharton · current PM template</option>}</select></label>
   {error && <p role="alert" className="accountError">{error}</p>}<button className="primaryAction" disabled={busy} type="submit">{busy ? "Saving…" : "Save brand"}</button>
  </form>
 </dialog>;
}
export function ModelDialog({ model, brands, onClose, onSaved }: { model?: CatalogModel; brands: CatalogBrand[]; onClose: () => void; onSaved: (id: string, notice: string) => Promise<void> }) {
 const ref = useModal(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const dismiss = useDialogDismiss(busy);
 async function save(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
  const body = { ...Object.fromEntries(form), brandId: model?.brandId || String(form.get("brandId")), active: form.get("active") === "on", expectedRevision: model?.revision };
  let id: string | undefined;
  try {
   const result = await send(model ? `/api/equipment/models/${model.id}` : "/api/equipment/models", model ? "PATCH" : "POST", body); id = result.id;
   for (const kind of ["image", "datasheet"] as const) {
    const file = form.get(kind); if (!(file instanceof File) || !file.size) continue;
    const response = await fetch(`/api/equipment/models/${id}/assets?kind=${kind}`, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || `Unable to upload ${kind}.`); }
   }
   await onSaved(id!, "Model saved. Its catalog data is available to the PM workspace."); ref.current?.close();
  } catch (error) {
   const message = error instanceof Error ? error.message : "Unable to save model.";
   if (id) { await onSaved(id, `Model details saved; a file could not be uploaded: ${message} Open Edit model to retry the file upload.`); ref.current?.close(); }
   else setError(message);
  } finally { setBusy(false); }
 }
 return <dialog {...dismiss} ref={ref} className="catalogDialog catalogEditor" aria-labelledby="model-title" onClose={onClose}>
  <header><h2 id="model-title">{model ? "Edit model" : "Add an equipment model"}</h2><button className="ghostButton" disabled={busy} onClick={() => ref.current?.close()} type="button">Cancel</button></header>
  <form onSubmit={save} className="catalogModelForm">
   <label>Brand<select name="brandId" defaultValue={model?.brandId || brands[0]?.id} disabled={!!model} required autoFocus>{brands.map(b => <option key={b.id} value={b.id}>{b.name}{!b.pmTemplate ? " · PM template pending" : ""}</option>)}</select></label>
   <label>Series or family<input name="family" defaultValue={model?.family} readOnly={!!model} required maxLength={120} placeholder="e.g. HEco 800 Series" /></label>
   <label>Model<input name="model" defaultValue={model?.model} readOnly={!!model} required maxLength={120} placeholder="e.g. 815P-190" /></label>
   <label>Controller options<input name="controllers" defaultValue={model?.controllers.join(", ")} maxLength={1000} placeholder="Comma-separated controller names" /></label>
   <label className="wide">Description<textarea name="description" defaultValue={model?.description} maxLength={1200} rows={3} /></label>
   <label className="wide">Basic specifications<textarea name="specifications" defaultValue={model?.specifications} maxLength={4000} rows={4} placeholder="Capacity, dimensions and other model information. Include units." /></label>
   <label>Equipment image (optional)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG or WebP · up to 6 MB. Images keep their proportions and are optimized automatically.</small></label>
   <label>Image represents<select name="imageScope" defaultValue={model?.imageScope || "model"}><option value="model">This exact model</option><option value="family">Series / family reference</option></select></label>
   <label>Image source (optional)<input name="imageSource" type="url" defaultValue={model?.imageSource || ""} maxLength={1000} placeholder="https://" /></label>
   <label>Datasheet PDF (optional)<input name="datasheet" type="file" accept="application/pdf" /><small>PDF · up to 12 MB. Replaces the current document.</small></label>
   <label className="wide">Datasheet source (optional)<input name="datasheetSource" type="url" defaultValue={model?.datasheetSource || ""} maxLength={1000} placeholder="https://" /></label>
   <label className="catalogCheck wide"><input name="active" type="checkbox" defaultChecked={model?.active ?? true} />Available for new PMs when its brand has a configured template</label>
   {model && <p className="wide">Brand, series and model identify this entry. Add a new entry for a different model; existing PM documents retain their recorded data.</p>}
   {error && <p className="accountError wide" role="alert">{error}</p>}
   <button type="submit" className="primaryAction" disabled={busy}>{busy ? "Saving model and files…" : "Save model"}</button>
  </form>
 </dialog>;
}
