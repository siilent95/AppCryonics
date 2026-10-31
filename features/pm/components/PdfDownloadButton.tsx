"use client";
import { useState } from "react";
export function PdfDownloadButton({ id, completed, requiresSignatures = true }: { id: string; completed: boolean; requiresSignatures?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/pm-records/${id}/pdf`, { cache: "no-store", headers: { Accept: "application/pdf" } });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Unable to download the PDF."); }
      if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The server did not return a PDF.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "CryoPM-report.pdf";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to download the PDF."); }
    finally { setBusy(false); }
  }
  return <div className="pdfDownload"><button type="button" disabled={!completed || busy} onClick={() => void download()}>{busy ? "Preparing PDF…" : "Download PDF"}</button>{!completed && <small>{requiresSignatures ? "Available after completion and signatures." : "Available after finalizing the correction."}</small>}{error && <small role="alert">{error}</small>}</div>;
}
