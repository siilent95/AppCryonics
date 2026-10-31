"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
export function PdfViewer({ url, title }: { url: string; title: string }) {
 const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
 const [error, setError] = useState(""); const [page, setPage] = useState(1); const [zoom, setZoom] = useState(1);
 const [width, setWidth] = useState(700); const viewport = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
 const textId = useId();
 const [showText, setShowText] = useState(false);
 const [pageText, setPageText] = useState<{ page: number; value: string } | null>(null);
 useEffect(() => {
  if (!document || !showText) return;
  let cancelled = false;
  document.getPage(page).then(pdfPage => pdfPage.getTextContent()).then(content => {
   if (!cancelled) setPageText({ page, value: content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim() || "This page has no selectable text. Use the original PDF or ask for an accessible document." });
  }).catch(() => { if (!cancelled) setPageText({ page, value: "Text could not be loaded. Open the original PDF to continue reading." }); });
  return () => { cancelled = true; };
 }, [document, page, showText]);
 useEffect(() => { const element = viewport.current; if (!element) return; const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 32))); observer.observe(element); return () => observer.disconnect(); }, []);
 useEffect(() => {
  let cancelled = false; let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
  async function load() {
   const moduleUrl = "/api/pdfjs/build/pdf.mjs";
   const pdfjs: typeof import("pdfjs-dist") = await import(/* webpackIgnore: true */ moduleUrl);
   if (cancelled) return;
   pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdfjs/build/pdf.worker.min.mjs";
   task = pdfjs.getDocument({ url, isEvalSupported: false, useSystemFonts: true, cMapUrl: "/api/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/api/pdfjs/standard_fonts/", wasmUrl: "/api/pdfjs/wasm/" });
   const result = await task.promise; if (!cancelled) setDocument(result);
  }
  load().catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Unable to display this PDF."); });
  return () => { cancelled = true; void task?.destroy(); };
 }, [url]);
 useEffect(() => {
  if (!document || !canvas.current) return;
  let cancelled = false; let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
  document.getPage(page).then(async pdfPage => {
   if (cancelled || !canvas.current) return;
   const base = pdfPage.getViewport({ scale: 1 }); const scale = Math.min(width, 1600) / base.width * zoom;
   const view = pdfPage.getViewport({ scale }); const outputScale = Math.min(window.devicePixelRatio || 1, 2);
   const target = canvas.current; target.width = Math.floor(view.width * outputScale); target.height = Math.floor(view.height * outputScale); target.style.width = `${view.width}px`; target.style.height = `${view.height}px`;
   const context = target.getContext("2d", { alpha: false }); if (!context) throw new Error("PDF rendering is unavailable.");
   render = pdfPage.render({ canvas: target, canvasContext: context, viewport: view, transform: [outputScale, 0, 0, outputScale, 0, 0] });
   await render.promise;
  }).catch(error => { if (!cancelled && error?.name !== "RenderingCancelledException") setError("This page could not be rendered. You can download the original PDF."); });
  return () => { cancelled = true; render?.cancel(); };
 }, [document, page, width, zoom]);
 return <div className="pdfViewer">
  <div className="pdfViewerControls" aria-label="PDF navigation"><button className="ghostButton" type="button" disabled={!document || page === 1} onClick={() => { setPage(page - 1); viewport.current?.scrollTo(0,0); }}>Previous</button><span aria-live="polite">{document ? `Page ${page} of ${document.numPages}` : "Loading document…"}</span><button className="ghostButton" type="button" disabled={!document || page === document.numPages} onClick={() => { setPage(page + 1); viewport.current?.scrollTo(0,0); }}>Next</button><label>Zoom<select value={zoom} onChange={event => setZoom(Number(event.target.value))}><option value={.75}>75%</option><option value={1}>Fit width</option><option value={1.25}>125%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label></div>
  {error && <p role="alert" className="accountError">{error}</p>}
  <div ref={viewport} className="pdfCanvasViewport" aria-busy={!document}><canvas ref={canvas} role="img" aria-label={`${title} · page ${page}`} /></div>
  <button className="ghostButton pdfTextToggle" disabled={!document} type="button" aria-expanded={showText} aria-controls={textId} onClick={() => setShowText(value => !value)}>{showText ? "Hide page text" : "Read page text"}</button>
  {showText && <section id={textId} aria-label={`Text of page ${page}`}><p className="documentHelp">Text from this page. Refer to the PDF for table layout and illustrations.</p><div className="pdfReadableText" tabIndex={0} aria-live="polite">{pageText?.page === page ? pageText.value : "Loading page text…"}</div></section>}
 </div>;
}
