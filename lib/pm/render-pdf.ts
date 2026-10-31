import { imageForPm } from "@/lib/equipment/images";
import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { reportDocument, type ReportRow } from "@/features/pm/report-document";
import { recordBrandLabel } from "@/features/pm/helpers";
import type { ReportDetail } from "@/features/pm/types";

const root = process.cwd();
const regular = path.join(root, "lib/pm/pdf-assets/DejaVuSans.ttf");
const bold = path.join(root, "lib/pm/pdf-assets/DejaVuSans-Bold.ttf");
const colors = { ink: "#172f43", muted: "#526879", cyan: "#0899ba", line: "#d6e1e8", soft: "#f2f7fa" };
const date = (value: string | null | undefined) => value ? value.slice(0, 10) : "Not recorded";
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[\u2011\u2013\u2014]/g, "-");
export type PdfSignatures = { technician: Buffer | null; recipient: Buffer | null };

export async function renderPmPdf(record: ReportDetail["record"], signatures: PdfSignatures): Promise<Buffer> {
  const content = reportDocument(record);
  const signing = record.signatureReference || record;
  const logo = await readFile(path.join(root, "public/brand/logo-primary.png"));
  const image = await imageForPm(record);
  const freezer = image ? await sharp(image.data).resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).png().toBuffer() : null;
  const doc = new PDFDocument({ size: "LETTER", margins: { top: 120, left: 42, right: 42, bottom: 56 }, font: regular, bufferPages: true, autoFirstPage: false,
    info: { Title: `${record.recordNumber} - Preventive maintenance`, Author: "Cryogenics Solution Inc.", Subject: `${recordBrandLabel(record)} ${record.model} | ${record.freezerSerial || "Serial not recorded"}`, Creator: "CryoPM" } });
  doc.registerFont("Body", regular); doc.registerFont("Bold", bold);
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const width = 528, bottom = 736;
  let title = "Equipment identification";
  let continued = false;
  function body() { doc.font("Body").fontSize(9).fillColor(colors.ink); }
  function header() {
    doc.image(logo, 42, 28, { fit: [175, 50] });
    doc.font("Bold").fontSize(8).fillColor(colors.muted).text("PREVENTIVE MAINTENANCE", 295, 32, { width: 275, align: "right" });
    doc.fontSize(13).fillColor(colors.ink).text(record.recordNumber, 295, 47, { width: 275, align: "right" });
    doc.font("Body").fontSize(8).fillColor(colors.muted).text(`PM date ${date(record.performedOn)} | Version ${record.documentVersion || 1}`, 280, 66, { width: 290, align: "right" });
    doc.moveTo(42, 90).lineTo(570, 90).lineWidth(1.5).strokeColor(colors.cyan).stroke();
    doc.font("Bold").fontSize(15).fillColor(colors.ink).text(`${title}${continued ? " (continued)" : ""}`, 42, 103, { width });
    doc.x = 42; doc.y = 135; body();
  }
  doc.on("pageAdded", header);
  function page(nextTitle: string) { title = nextTitle; continued = false; doc.addPage(); }
  function ensure(height: number) { if (doc.y + height > bottom) { continued = true; doc.addPage(); } }
  function paragraph(text: string, heading?: string) {
    ensure(heading ? 58 : 35);
    if (heading) { doc.font("Bold").fontSize(10).fillColor(colors.ink).text(heading, 42, doc.y, { width }); doc.moveDown(.5); }
    body(); doc.text(clean(text), 42, doc.y, { width, lineGap: 3 }); doc.moveDown(1.1);
  }
  function table(rows: ReportRow[], measurement = false, widths?: number[], labels?: string[]) {
    const columns = widths ?? (measurement ? [280, 112, 136] : [396, 132]);
    function heading() {
      ensure(38); const y = doc.y;
      doc.rect(42, y, width, 27).fill(colors.soft);
      let x = 42; (labels ?? [measurement ? "Measured or configured value" : "Maintenance criterion", "Result", ...(measurement ? ["PM reference"] : [])]).forEach((label, i) => {
        doc.font("Bold").fontSize(8).fillColor(colors.muted).text(label, x + 8, y + 8, { width: columns[i] - 16 }); x += columns[i];
      }); doc.y = y + 27; body();
    }
    heading();
    for (const row of rows) {
      const values = [row.label, row.value, ...(measurement ? [row.reference || "-"] : [])].map(clean);
      body();
      const height = Math.max(24, ...values.map((value, i) => doc.heightOfString(value, { width: columns[i] - 16, lineGap: 2 }) + 12));
      if (doc.y + height > bottom) { continued = true; doc.addPage(); heading(); }
      const y = doc.y; let x = 42;
      values.forEach((value, i) => { body(); doc.text(value, x + 8, y + 8, { width: columns[i] - 16, lineGap: 2 }); x += columns[i]; });
      doc.moveTo(42, y + height).lineTo(570, y + height).strokeColor(colors.line).lineWidth(.5).stroke(); doc.y = y + height;
    }
    doc.y += 10;
  }
  page("Equipment identification");
  if (freezer) doc.image(freezer, 205, 137, { fit: [200, 160], align: "center", valign: "center" });
  doc.font("Body").fontSize(8).fillColor(colors.muted).text(!image ? "Equipment image not available." : image.exact ? `Model reference: ${record.model}` : `Reference image: ${record.modelFamily}. Verify the equipment label.`, 42, 307, { width, align: "center" });
  doc.y = 337; table(content.facts.map(([label, value]) => ({ label, value })), false, [168, 360], ["Equipment / service field", "Recorded value"]);
  for (const section of content.sections) {
    page(section.title); paragraph(section.intro);
    for (const group of section.groups) {
      if (group.title) { ensure(80); doc.font("Bold").fontSize(10).fillColor(colors.ink).text(group.title, 42, doc.y, { width }); doc.moveDown(.6); }
      table(group.rows, group.measurement);
    }
    paragraph(section.note, `${section.title.slice(5)} observations`);
  }
  page("05 / Service closure");
  paragraph(content.general, "General service notes");
  paragraph(record.correctionPublication ? `Correction finalized by ${record.correctionPublication.name} on ${record.correctionPublication.createdAt}. Original signatures refer to ${record.signatureReference?.recordNumber || "the previously signed version"}. No new signatures were collected.` : "The technician signature documents responsibility for the work recorded in this PM. The recipient signature documents receipt of the PM.", "Maintenance record");
  if (record.signatureReference) paragraph(`Signatures from document version ${record.signatureReference.documentVersion} - ${record.signatureReference.recordNumber}`, "Original signature reference");
  paragraph(`PM date: ${date(record.performedOn)} | Record: ${record.recordNumber} | Version: ${record.documentVersion || 1}`);
  for (const role of ["technician", "recipient"] as const) {
    ensure(160);
    const y = doc.y;
    doc.font("Bold").fontSize(10).fillColor(colors.ink).text(role === "technician" ? `Responsible technician: ${signing.technicianName || "Not recorded"}` : "PM recipient", 42, y, { width });
    body(); doc.fontSize(8).fillColor(colors.muted).text(`Signed: ${signing[`${role}SignatureCapturedAt`] || "Not recorded"} (UTC)`, 42, doc.y + 5, { width });
    const imageY = doc.y + 10;
    if (signatures[role]) doc.image(signatures[role], 42, imageY, { fit: [300, 80] });
    else { body(); doc.text("Signature no longer available", 42, imageY + 22, { width }); }
    doc.y = imageY + 102;
  }
  paragraph(`Signature retention date: ${date(signing.technicianSignatureRetentionUntil || signing.recipientSignatureRetentionUntil)}`);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const bodyBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 16;
    doc.moveTo(42, 751).lineTo(570, 751).lineWidth(.5).strokeColor(colors.line).stroke();
    doc.font("Body").fontSize(7).fillColor(colors.muted).text(`${record.recordNumber} | ${recordBrandLabel(record)} | ${record.freezerSerial || "Serial not recorded"}`, 42, 761, { width: 425, lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, 500, 761, { width: 70, align: "right", lineBreak: false });
    doc.page.margins.bottom = bodyBottom;
  }
  doc.end();
  return done;
}
