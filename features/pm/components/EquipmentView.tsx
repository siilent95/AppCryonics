"use client";
import { useEffect, useRef, useState } from "react";
import type { CatalogModel } from "@/features/equipment/types";
import type { useEquipmentCatalog } from "@/features/equipment/useEquipmentCatalog";
import { BrandDialog, ModelDialog, DatasheetDialog } from "@/features/equipment/CatalogDialogs";
export function EquipmentView({ catalogState, isAdmin, onUseModel }: { catalogState: ReturnType<typeof useEquipmentCatalog>; isAdmin: boolean; onUseModel: (model: CatalogModel) => void }) {
 const { catalog, status, error, refresh } = catalogState;
 const [selectedId, setSelectedId] = useState("");
 const detailPanel = useRef<HTMLElement>(null);
 const familyCards = useRef<HTMLElement>(null);
 const selected = catalog.models.find(model => model.id === selectedId);
 const familyKey = selected ? JSON.stringify([selected.brandId, selected.family]) : "";
 useEffect(() => {
  if (familyKey) {
   detailPanel.current?.focus({ preventScroll: true });
   detailPanel.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
 }, [familyKey]);
 const [query, setQuery] = useState(""); const [brandFilter, setBrandFilter] = useState("all");
 const [editor, setEditor] = useState<"brand" | "editBrand" | "new" | "edit" | null>(null);
 const [document, setDocument] = useState<CatalogModel | null>(null); const [notice, setNotice] = useState("");
 const name = (id: string) => catalog.brands.find(b => b.id === id)?.name || id;
 const families = Array.from(catalog.models.reduce((groups, model) => {
  const key = JSON.stringify([model.brandId, model.family]);
  const family = groups.get(key);
  if (family) family.models.push(model);
  else groups.set(key, { key, brandId: model.brandId, name: model.family, models: [model] });
  return groups;
 }, new Map<string, { key: string; brandId: string; name: string; models: CatalogModel[] }>()).values()).sort((a, b) => name(a.brandId).localeCompare(name(b.brandId)) || a.name.localeCompare(b.name, "en", { numeric: true }));
 families.forEach(family => family.models.sort((a, b) => a.model.localeCompare(b.model, "en", { numeric: true })));
 const matches = (model: CatalogModel) => !query.trim() || [name(model.brandId), model.family, model.model, model.description].join(" ").toLowerCase().includes(query.trim().toLowerCase());
 const filtered = families.filter(family => (brandFilter === "all" || family.brandId === brandFilter) && family.models.some(matches));
 const selectedFamily = families.find(family => family.key === familyKey);
 const brand = catalog.brands.find(b => b.id === selected?.brandId);
 function backToFamilies() { setSelectedId(""); requestAnimationFrame(() => familyCards.current?.focus()); }
 async function saved(id: string, message: string) { setSelectedId(id); setQuery(""); setBrandFilter("all"); await refresh(); setNotice(message); }
 return <div className="managementView equipmentCatalog">
  <section className="viewHero"><div><div className="eyebrow">Equipment library</div><h1>Equipment</h1></div>{isAdmin && <div className="catalogActions"><button type="button" className="ghostButton" onClick={() => setEditor("brand")}>Add brand</button><button type="button" className="primaryAction" disabled={status !== "loaded" || !catalog.brands.length} onClick={() => setEditor("new")}>Add model</button></div>}</section>
  <div className="catalogSummary"><span><strong>{catalog.brands.length}</strong> brands</span><span><strong>{families.length}</strong> families</span><span><strong>{catalog.models.length}</strong> models</span></div>
  {notice && <p className="accountNotice" role="status">{notice}</p>}
  {status === "loading" && <p role="status">Loading the equipment catalog…</p>}
  {status === "error" && <div className="accountError" role="alert"><p>{error}</p><button className="ghostButton" onClick={() => void refresh()} type="button">Retry catalog</button></div>}
  {status === "loaded" && <>
   {!selected && <>
   <div className="catalogFilters"><label>Search models<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Brand, series or model" /></label><label>Brand<select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}><option value="all">All brands</option>{catalog.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button type="button" className="ghostButton" onClick={() => void refresh()}>Refresh catalog</button></div>
   <section ref={familyCards} tabIndex={-1} className="catalogCards catalogFamilyCards" aria-label="Equipment families">{filtered.map(family => {
    const image = family.models.find(model => model.imageUrl && model.imageScope === "family") || family.models.find(model => model.imageUrl);
    const matchingModels = family.models.filter(matches);
    return <button className="catalogCard" key={family.key} type="button" onClick={() => setSelectedId(matchingModels[0].id)}>
     <div className="catalogPhoto">{image?.imageUrl ? <img src={image.imageUrl} alt={`${family.name} equipment reference`} loading="lazy" /> : <span>No image yet</span>}</div>
     <div className="catalogCardText"><small>{name(family.brandId)}</small><strong>{family.name}</strong><span>{family.models.length} {family.models.length === 1 ? "model" : "models"}</span><div className="catalogFamilyPreview">{matchingModels.map(model => model.model).join(" · ")}</div><div className="catalogFamilyOpen">Explore models <span aria-hidden="true">→</span></div></div>
    </button>;
   })}{!filtered.length && <div className="viewMessage"><strong>No families match the filters</strong><span>Change the search or select another brand.</span></div>}</section>
   </>}
   {selected && selectedFamily && <section ref={detailPanel} tabIndex={-1} className="catalogFamilyDetail" aria-label="Selected equipment family">
    <button type="button" className="ghostButton catalogBack" onClick={backToFamilies}><span aria-hidden="true">← </span>All families</button>
    <div className="catalogFamilyHeading"><div><p>{brand?.name}</p><h2>{selectedFamily.name}</h2></div><span>{selectedFamily.models.length} {selectedFamily.models.length === 1 ? "model" : "models"}</span></div>
    <div className="catalogModelPicker" role="group" aria-label="Choose a model">{selectedFamily.models.map(model => <button type="button" className={model.id === selected.id ? "selected" : ""} key={model.id} aria-pressed={model.id === selected.id} onClick={() => setSelectedId(model.id)}>{model.model}{!model.active && <small>Inactive</small>}</button>)}</div>
    <aside className="catalogDetail analytics-panel" aria-label="Selected model details">
    <div className="catalogModelInformation">
    <div className="catalogDetailHeading"><div><p>{brand?.name}{isAdmin && <button type="button" className="catalogBrandEdit" onClick={() => setEditor("editBrand")}>Edit brand</button>}</p><h2>{selected.model}</h2><span>{selected.family}</span></div>{isAdmin && <button type="button" className="ghostButton" onClick={() => setEditor("edit")}>Edit model</button>}</div>
    <div className="catalogDetailActions">{selected.datasheetUrl ? <button type="button" className="primaryAction" onClick={() => setDocument(selected)}>View datasheet</button> : <p>No datasheet uploaded yet.</p>}{selected.active && brand?.pmTemplate && <button type="button" className="ghostButton" onClick={() => onUseModel(selected)}>Use model in PM</button>}</div>
    {selected.description && <p className="catalogDescription">{selected.description}</p>}
    {selected.specifications && <section className="catalogSpecs"><h3>Basic specifications</h3><p>{selected.specifications}</p></section>}
    {selected.controllers.length > 0 && <p className="catalogControllers"><strong>Controllers</strong>{selected.controllers.join(" · ")}</p>}

    {!brand?.pmTemplate && <p className="catalogPending">PM template pending. This model is available for consultation; it can be used in a PM after its template is configured.</p>}
    </div><div className="catalogModelVisual"><div className="catalogPhoto catalogDetailPhoto">{selected.imageUrl ? <img src={selected.imageUrl} alt={`${brand?.name} ${selected.model}`} /> : <span>No image yet</span>}</div>
    {selected.imageUrl && <p className="catalogImageNote">{selected.imageScope === "model" ? "Model image" : "Series reference image · verify the equipment label"}{selected.imageSource && <> · <a href={selected.imageSource} target="_blank" rel="noreferrer">Source</a></>}</p>}</div>
   </aside></section>}
  </>}
  {(editor === "brand" || editor === "editBrand") && <BrandDialog brand={editor === "editBrand" ? brand : undefined} onClose={() => setEditor(null)} onSaved={async () => { await refresh(); setNotice("Brand saved. Its PM template is available for new PM selections."); }} />}
  {(editor === "new" || (editor === "edit" && selected)) && <ModelDialog model={editor === "edit" ? selected : undefined} brands={catalog.brands} onClose={() => setEditor(null)} onSaved={saved} />}
  {document && <DatasheetDialog model={document} brand={name(document.brandId)} onClose={() => setDocument(null)} />}
 </div>;
}
