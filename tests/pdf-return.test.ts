import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAppleTouchDevice,pdfFile,canSaveWithShare,sharePdf } from '../features/pm/pdf-transfer';
import { OfflineEngine } from '../features/offline/engine';
import { clearOwner,writeEntry } from '../features/offline/vault';

test('PDF preparation keeps the downloaded bytes, a safe filename and PDF MIME type',async()=>{
 const bytes='%PDF-1.7\nsynthetic QA';
 const file=await pdfFile(new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="QA-report.pdf"'}}));
 assert.equal(file.name,'QA-report.pdf');assert.equal(file.type,'application/pdf');assert.equal(await file.text(),bytes);
 await assert.rejects(pdfFile(Response.json({error:'Not authorized'},{status:403})),/Not authorized/);
 await assert.rejects(pdfFile(new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}})),/did not return a PDF/);
 const safe=await pdfFile(new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="../../bad/report.pdf"'}}));
 assert.equal(safe.name.includes('/'),false);
});
test('Apple touch detection includes iPad desktop mode without changing Mac desktop downloads',()=>{
 assert.equal(isAppleTouchDevice({userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5}),true);
 assert.equal(isAppleTouchDevice({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(isAppleTouchDevice({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}),false);
 assert.equal(isAppleTouchDevice({userAgent:'Android',platform:'Linux',maxTouchPoints:5}),false);
});
test('native save shares the PDF file synchronously on a fresh click and preserves cancellation',async()=>{
 const file=new File(['QA'],'QA.pdf',{type:'application/pdf'});let invoked=false;
 const device={canShare:(data:ShareData)=>data.files?.[0]===file,share:(data:ShareData)=>{invoked=true;assert.deepEqual(data,{files:[file]});return Promise.resolve();}};
 assert.equal(canSaveWithShare(file,device),true);
 const saving=sharePdf(file,device);assert.equal(invoked,true);await saving;
 assert.equal(canSaveWithShare(file,{...device,canShare:()=>false}),false);
 await assert.rejects(sharePdf(file,{share:()=>Promise.reject(new DOMException('Cancelled','AbortError'))}),{name:'AbortError'});
 assert.equal(await file.text(),'QA');
});
test('encrypted report return survives reload without replacing the active PM and is scoped to the technician',async()=>{
 const user={id:'return-qa',displayName:'Synthetic QA',role:'technician' as const};
 await clearOwner(user.id);
 const engine=new OfflineEngine();await engine.activate(user);await engine.setActive('separate-active-draft');
 await engine.rememberReport('completed-synthetic-pm');
 const reloaded=new OfflineEngine();await reloaded.activate(user);
 assert.equal((await reloaded.reportReturn())?.id,'completed-synthetic-pm');
 assert.equal((await reloaded.checkpoint())?.activeId,'separate-active-draft');
 await reloaded.rememberReport(null);assert.equal(await reloaded.reportReturn(),undefined);
 assert.equal((await reloaded.checkpoint())?.activeId,'separate-active-draft');
 await writeEntry(user.id,'report-return',{id:'expired',at:Date.now()-13*60*60*1000});assert.equal(await reloaded.reportReturn(),undefined);
 await writeEntry(user.id,'report-return',{id:123,at:Date.now()});assert.equal(await reloaded.reportReturn(),undefined);
 await reloaded.rememberReport('completed-synthetic-pm');
 const other=new OfflineEngine();await other.activate({...user,id:'return-other'});
 assert.equal(await other.reportReturn(),undefined);await clearOwner('return-other');
});
