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
  await t.test('a late preparation response cannot recreate private data after handover, even to the same account',async()=>{
    for(const target of [user,{...user,id:'next-technician'}]) {
      const holder=new OfflineEngine(transport);await holder.activate(user);
      const encrypt=crypto.subtle.encrypt;
      let entered!:()=>void,release!:()=>void;
      const started=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
      crypto.subtle.encrypt=async function(...args:Parameters<SubtleCrypto['encrypt']>){entered();await gate;return encrypt.apply(this,args);};
      const late=writeEntry(user.id,'resource:late',{private:'synthetic old visit'});
      const rejected=assert.rejects(late,/active technician changed/);
      try {
        await started;crypto.subtle.encrypt=encrypt;
        await holder.handover();
        const next=new OfflineEngine(transport);await next.activate(target);
        release();await rejected;
        assert.equal(await readEntry(user.id,'resource:late'),undefined);
        assert.equal((await metadata<{owner:string}>('active'))?.owner,target.id);
        assert.equal((await readEntry<{id:string}>(target.id,'profile'))?.id,target.id);
        if(target.id!==user.id) {
          const db=await openVault();
          const orphan=await new Promise<unknown>(resolve=>{const r=db.transaction('keys').objectStore('keys').get(user.id);r.onsuccess=()=>resolve(r.result);});
          assert.equal(orphan,undefined,'a rejected late response cannot recreate the old encryption key');
          await clearOwner(user.id);
          assert.equal((await metadata<{owner:string}>('active'))?.owner,target.id,'cleanup of an old owner cannot erase the new active profile');
        }
        await clearOwner(target.id);
      } finally {crypto.subtle.encrypt=encrypt;release();}
    }
    await assert.rejects(writeEntry(user.id,'late-after-logout',{private:'synthetic'}),/active technician changed/);
    await assert.rejects(updateEntry(user.id,'late-update',()=>({private:'synthetic'})),/active technician changed/);
  });
  await t.test('a session belonging to another technician blocks handover before logout or cleanup',async()=>{
    let loggedOut=false;
    const guarded=new OfflineEngine(async url=>{
      if(url==='/api/auth/logout'){loggedOut=true;return reply({ok:true});}
      return reply({user:{...user,id:'different-server-account'}});
    });
    await guarded.activate(user);
    await assert.rejects(guarded.handover(),/another technician/);
    assert.equal(loggedOut,false);
    assert.equal((await metadata<{owner:string}>('active'))?.owner,user.id);
    await clearOwner(user.id);
  });

});

test('cancelling new PMs is local, isolated and safe against synchronization races',async t=>{
  const actor={...user,id:'cancel-qa'};
  let posts=0,logout=0;
  const transport:typeof fetch=async (url,init)=>{
    if(url==='/api/offline/session')return reply({user:actor});
    if(url==='/api/auth/logout'){logout++;return reply({ok:true});}
    posts++;
    const op=JSON.parse(init!.body as string) as SyncOperation;
    return reply({localId:op.localId,sequence:op.sequence,record:{id:'saved-qa',recordNumber:'QA',revision:1}});
  };
  const engine=new OfflineEngine(transport);await engine.activate(actor,true);
  await t.test('offline cancellation removes visit data and prevents later writes or reload resurrection',async()=>{
    const id=crypto.randomUUID();await engine.persist(id,snapshot());await engine.cancel(id);
    assert.equal(engine.getState().pending,0);assert.equal(await engine.draft(id),undefined);
    assert.deepEqual(await readEntry(actor.id,`draft:${id}`),{id,cancelled:true});
    assert.equal((await engine.checkpoint())?.activeId,null);
    await assert.rejects(engine.persist(id,snapshot()),/cancelled/);
    const reloaded=new OfflineEngine(transport);await reloaded.activate(actor,true);
    assert.equal((await reloaded.drafts()).length,0);await assert.rejects(reloaded.resume(id),/not found/);
    await assert.rejects(reloaded.persist(id,snapshot()),/cancelled/);
    await engine.retry(id);assert.equal(posts,0);
  });
  await t.test('cancelling a queued but unsent draft does not upload it or disturb the current PM',async()=>{
    const cancelled=crypto.randomUUID(),current=crypto.randomUUID();
    await engine.persist(cancelled,snapshot(),{formal:true});await engine.persist(current,snapshot());
    await engine.cancel(cancelled);await engine.sync();
    assert.equal(posts,0);assert.equal((await engine.checkpoint())?.activeId,current);
    assert.equal((await engine.draft(current))?.snapshot.body.freezerSerial,'QA-OFFLINE');
    await engine.cancel(current);
  });
  await t.test('another tab cannot discard a PM with a live editing lease',async()=>{
    const id=crypto.randomUUID();await engine.persist(id,snapshot());
    const other=new OfflineEngine(transport);await other.activate(actor);
    await assert.rejects(other.cancel(id),/another tab/);assert.ok(await engine.draft(id));await engine.cancel(id);
  });
  await t.test('cancellation before operation selection commits prevents any upload',async()=>{
    const id=crypto.randomUUID();await engine.persist(id,snapshot(),{formal:true});
    const encrypt=crypto.subtle.encrypt;let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    crypto.subtle.encrypt=async function(...args:Parameters<SubtleCrypto['encrypt']>){entered();await gate;return encrypt.apply(this,args);};
    const sending=engine.sync();
    try{await started;crypto.subtle.encrypt=encrypt;await engine.cancel(id);release();await sending;assert.equal(posts,0);assert.equal(await engine.draft(id),undefined);}
    finally{crypto.subtle.encrypt=encrypt;release();}
  });
  await t.test('an operation selected before cancellation remains intact even if its response is lost',async()=>{
    let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    const sender=new OfflineEngine(async(url)=>{
      if(url==='/api/offline/session')return reply({user:actor});
      entered();await gate;throw new TypeError('Synthetic acknowledgement lost');
    });
    await sender.activate(actor);const id=crypto.randomUUID();await sender.persist(id,snapshot(),{formal:true});
    const sending=sender.sync();await started;
    try{await assert.rejects(sender.cancel(id),/already been saved or sent/);assert.ok((await sender.draft(id))?.operation);}
    finally{release();await sending;}
    await assert.rejects(sender.cancel(id),/already been saved or sent/);
    await sender.release(id);await engine.resume(id);await engine.sync();
    assert.equal(posts,1);await assert.rejects(engine.cancel(id),/already been saved or sent/);
    assert.equal((await engine.draft(id))?.server?.id,'saved-qa');
  });
  await t.test('cancellation wins against an encrypting late save in another tab',async()=>{
    const lockDescriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
    Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
    const id=crypto.randomUUID();await engine.persist(id,snapshot());await engine.release(id);
    const lateWriter=new OfflineEngine(transport);await lateWriter.activate(actor);
    const encrypt=crypto.subtle.encrypt;let entered!:()=>void,release!:()=>void;
    const started=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    crypto.subtle.encrypt=async function(...args:Parameters<SubtleCrypto['encrypt']>){entered();await gate;return encrypt.apply(this,args);};
    const late=lateWriter.persist(id,snapshot());const rejected=assert.rejects(late,/cancelled/);
    try{await started;crypto.subtle.encrypt=encrypt;await engine.cancel(id);release();await rejected;assert.equal(await engine.draft(id),undefined);}
    finally{crypto.subtle.encrypt=encrypt;release();if(lockDescriptor)Object.defineProperty(navigator,'locks',lockDescriptor);else Reflect.deleteProperty(navigator,'locks');}
  });
  await t.test('a cancelled PM no longer blocks confirmed online handover',async()=>{
    const id=crypto.randomUUID();await engine.persist(id,snapshot());
    await assert.rejects(engine.handover(),/Synchronize/);assert.equal(logout,0);
    await engine.cancel(id);await engine.handover();assert.equal(logout,1);
    assert.equal(await metadata('active'),undefined);assert.equal((await entries(actor.id,'draft:')).length,0);
  });
});
