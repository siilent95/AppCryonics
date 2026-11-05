import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { OfflineEngine } from '../features/offline/engine';
import { clearOwner, entries, metadata, openVault, readEntry, updateEntry, writeEntry } from '../features/offline/vault';
import { emptyCapture, type SyncOperation, type WorkspaceSnapshot } from '../features/offline/types';
import type { ReportDetail } from '../features/pm/types';
const user={id:'offline-technician',displayName:'Synthetic QA',role:'technician' as const};
const snapshot=():WorkspaceSnapshot=>({catalogBrandId:'taylor',catalogBrandName:'Taylor-Wharton',requestedStep:'construction',correctsRecordId:null,correctionReason:'',capture:{...emptyCapture},body:{brand:'taylor',modelFamily:'K-Series',model:'3K',facility:null,labName:'Synthetic underground laboratory',clientOrganization:'QA only',performedOn:'2026-11-05',firmwareVersion:null,freezerSerial:'QA-OFFLINE',controllerSerial:'',location:'Basement',controllerType:'CS200',templateVersion:'0.2',currentStep:'construction',payload:{responses:{},notes:{general:'Field notes preserved'},examination:{temperatureUnit:'°C',levelUnit:'in',lowTemperature:'-190'},measurements:{roomResistance:'6.8'}}}});
const reply=(data:unknown,status=200)=>Response.json(data,{status});
test('protected offline storage, retries, conflicts, recovery and technician handover',async t=>{
  await clearOwner(user.id);
  const ledger=new Map<string,unknown>();let creations=0,revision=0,loseResponse=false,expired=false,conflictId='',logout=0;
  const transport:typeof fetch=async (url,init)=>{
    if(url==='/api/offline/session')return expired?reply({error:'expired'},401):reply({user});
    if(url==='/api/auth/logout'){logout++;return reply({ok:true});}
    const op=JSON.parse(init?.body as string) as SyncOperation;
    if(op.recordId===conflictId)return reply({error:'This PM was edited elsewhere.'},409);
    if(ledger.has(op.operationId))return reply(ledger.get(op.operationId));
    const result={localId:op.localId,sequence:op.sequence,record:{id:op.recordId||`server-${++creations}`,recordNumber:'QA-OFFLINE',revision:++revision}};
    ledger.set(op.operationId,result);if(loseResponse){loseResponse=false;throw new TypeError('Response lost after commit');}return reply(result);
  };
  const engine=new OfflineEngine(transport);await engine.activate(user);
  await t.test('raw records are encrypted, keys cannot be exported, profiles remain separated',async()=>{
    await writeEntry(user.id,'proof',{secret:'synthetic confidential note'});
    assert.deepEqual(await readEntry(user.id,'proof'),{secret:'synthetic confidential note'});
    assert.equal(await readEntry('other-owner','proof'),undefined);
    const db=await openVault();
    const raw=await new Promise<{id:string;owner:string;iv:Uint8Array;bytes:ArrayBuffer}>(resolve=>{const r=db.transaction('entries').objectStore('entries').get(user.id+':proof');r.onsuccess=()=>resolve(r.result);});
    assert.ok(!JSON.stringify(raw).includes('confidential'));
    const key=await new Promise<CryptoKey>(resolve=>{const r=db.transaction('keys').objectStore('keys').get(user.id);r.onsuccess=()=>resolve(r.result.value);});
    assert.equal(key.extractable,false);await assert.rejects(crypto.subtle.exportKey('raw',key));
    const tx=db.transaction('entries','readwrite');tx.objectStore('entries').put({...raw,id:user.id+':tampered'});await new Promise(resolve=>{tx.oncomplete=resolve;});
    await assert.rejects(readEntry(user.id,'tampered'));
    const clean=db.transaction('entries','readwrite');clean.objectStore('entries').delete(user.id+':tampered');await new Promise(resolve=>{clean.oncomplete=resolve;});
  });
  await t.test('concurrent encrypted updates use compare-and-swap without losing values',async()=>{
    await writeEntry(user.id,'counter',0);
    await Promise.all(Array.from({length:12},()=>updateEntry<number>(user.id,'counter',n=>(n||0)+1)));
    assert.equal(await readEntry(user.id,'counter'),12);
  });
  const id=crypto.randomUUID(),initial=snapshot();initial.capture.technicianSignature='data:image/png;base64,synthetic-unit-fixture';
  await engine.persist(id,initial,{formal:true});
  await t.test('reload restores fields, units, notes and provisional signature without a PIN',async()=>{
    await engine.release(id);const reopened=new OfflineEngine(transport);await reopened.activate(user);
    const restored=await reopened.resume(id);assert.deepEqual(restored.snapshot,initial);assert.equal((await reopened.checkpoint())?.activeId,id);
    await reopened.release(id);await engine.resume(id);
  });
  await t.test('a lost acknowledgement retains the same immutable operation and preserves later edits',async()=>{
    loseResponse=true;await engine.sync();const frozen=(await engine.draft(id))!.operation!;assert.ok(frozen);assert.equal(creations,1);
    const changed=snapshot();changed.body.labName='Edited after lost acknowledgement';await engine.persist(id,changed);
    await engine.sync();let d=(await engine.draft(id))!;assert.equal(creations,1);assert.equal(d.snapshot.body.labName,changed.body.labName);assert.ok(d.sequence>d.syncedSequence);assert.equal(d.server?.revision,1);
    await engine.sync();d=(await engine.draft(id))!;assert.equal(d.sequence,d.syncedSequence);assert.equal(creations,1);assert.equal(d.server?.revision,2);
  });
  await t.test('another tab cannot edit the same PM while its lease is held',async()=>{
    const other=new OfflineEngine(transport);await other.activate(user);await assert.rejects(other.resume(id),/another tab/);await assert.rejects(other.persist(id,snapshot()),/another tab/);
  });
  const second=crypto.randomUUID();
  await t.test('session expiry preserves pending data and blocks a technician switch',async()=>{
    await engine.persist(second,snapshot(),{formal:true});expired=true;await engine.sync();assert.ok(engine.getState().error.includes('Sign in'));assert.equal((await engine.draft(second))!.server,null);
    const other=new OfflineEngine(transport);await other.activate({...user,id:'other-technician'});assert.equal(other.getState().blocked,true);assert.equal((await metadata<{owner:string}>('active'))?.owner,user.id);
    expired=false;await engine.sync();assert.ok((await engine.draft(second))!.server);
  });
  await t.test('a conflict blocks only that PM; another PM still synchronizes',async()=>{
    conflictId=(await engine.draft(id))!.server!.id;await engine.persist(id,snapshot());
    const next=snapshot();next.body.freezerSerial='Second PM independent';await engine.persist(second,next);await engine.sync();
    assert.equal((await engine.draft(id))!.status,'blocked');assert.equal((await engine.draft(second))!.sequence,(await engine.draft(second))!.syncedSequence);
    const detail={record:{id:conflictId,recordNumber:'QA-OFFLINE',revision:20,status:'draft',brand:'taylor',equipmentBrandId:'taylor',modelFamily:'K-Series',model:'3K',canEdit:true}} as ReportDetail;
    await engine.resolve(id,detail,true);assert.equal((await entries(user.id,'recovery:')).length,1);assert.equal((await engine.draft(id))!.server!.revision,20);conflictId='';await engine.sync();
  });
  await t.test('storage transaction failure does not acknowledge a device save',async()=>{
    const db=await openVault(),prototype=Object.getPrototypeOf(db.transaction('entries','readwrite').objectStore('entries')),put=prototype.put;
    prototype.put=function(){throw new DOMException('Device full','QuotaExceededError');};
    try {await assert.rejects(engine.persist(crypto.randomUUID(),snapshot()),/Device full/);}finally{prototype.put=put;}
  });
  await t.test('sign out requires confirmed drafts, then erases private records and keys',async()=>{
    const unsaved=crypto.randomUUID();await engine.persist(unsaved,snapshot());await assert.rejects(engine.handover(),/Synchronize/);assert.equal(logout,0);
    await engine.persist(unsaved,snapshot(),{formal:true});await engine.sync();await engine.handover();assert.equal(logout,1);assert.equal(await metadata('active'),undefined);assert.equal((await entries(user.id,'draft:')).length,0);
    await assert.rejects(engine.persist(unsaved,snapshot()),/not ready/);
  });
});
