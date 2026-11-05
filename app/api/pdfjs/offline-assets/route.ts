import {readdir} from "node:fs/promises";
import path from "node:path";
/** Public runtime filenames only: no PMs, user files or configuration. */
export async function GET() {
  const assets=["/api/pdfjs/build/pdf.mjs","/api/pdfjs/build/pdf.worker.min.mjs"];
  for(const directory of ["cmaps","standard_fonts","wasm"]) {
    const names=await readdir(path.join(process.cwd(),"node_modules/pdfjs-dist",directory));
    for(const name of names)if(/^[a-zA-Z0-9_.-]+\.(bcmap|pfb|ttf|wasm)$/.test(name))assets.push(`/api/pdfjs/${directory}/${name}`);
  }
  return Response.json({assets},{headers:{"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}});
}
