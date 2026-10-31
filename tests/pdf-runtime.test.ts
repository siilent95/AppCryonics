import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/pdfjs/[...asset]/route";
test("self-hosted PDF runtime serves supported assets and rejects arbitrary file paths", async () => {
 const request = new Request("http://localhost:3000/api/pdfjs/build/pdf.mjs");
 for (const asset of [["build","pdf.mjs"],["build","pdf.worker.min.mjs"],["wasm","qcms_bg.wasm"]]) {
  const response = await GET(request, {params:Promise.resolve({asset})}); assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>1000);
 }
 for (const asset of [["..","..",".env.local"],["build","pdf.mjs.map"],["standard_fonts","..","..","package.json"]]) assert.equal((await GET(request,{params:Promise.resolve({asset})})).status,404);
});
