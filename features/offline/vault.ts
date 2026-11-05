// The non-extractable device key is intentionally stored for PIN-free continuity.
// It protects raw records at rest, not a person holding an already-unlocked tablet.
// Never store passwords, session cookies or server credentials in this database.
export const DATABASE = "cryopm-offline-v1";
type Sealed = { id: string; owner: string; iv: Uint8Array; bytes: ArrayBuffer };
let opening: Promise<IDBDatabase> | undefined;
function request<T>(value: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); }); }
function complete(tx: IDBTransaction) { return new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error || new Error("Device storage transaction failed.")); }); }
export function openVault() {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => { for (const name of ["meta", "keys", "entries"]) req.result.createObjectStore(name, { keyPath: "id" }); };
    req.onerror = () => { opening = undefined; reject(req.error); };
    req.onblocked = () => { opening = undefined; reject(new Error("Close other CryoPM tabs to update device storage.")); };
    req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); opening = undefined; }; resolve(req.result); };
  });
  return opening;
}
export async function metadata<T>(id: string): Promise<T | undefined> {
  const db = await openVault(); const tx = db.transaction("meta"); const done = complete(tx);
  const row = await request(tx.objectStore("meta").get(id)); await done; return row?.value;
}
export async function setMetadata(id: string, value: unknown) {
  const db = await openVault(); const tx = db.transaction("meta", "readwrite"); const done = complete(tx);
  tx.objectStore("meta").put({ id, value }); await done;
}
type ActiveOwner = { owner: string; generation: string };
const changedOwner = () => new Error("The active technician changed. Sign in again before saving.");
export async function activateOwner(owner: string): Promise<ActiveOwner> {
  const db=await openVault(),tx=db.transaction("meta","readwrite"),done=complete(tx),store=tx.objectStore("meta");
  const current=await request(store.get("active"));
  if(current?.value?.owner && current.value.owner!==owner){await done;throw changedOwner();}
  const value={owner,generation:current?.value?.generation || crypto.randomUUID()};
  store.put({id:"active",value});await done;return value;
}
async function activeOwner(owner: string) {
  const active=await metadata<ActiveOwner>("active");
  if(active?.owner!==owner || !active.generation)throw changedOwner();
  return active;
}
function sameOwner(active: ActiveOwner | undefined, expected: ActiveOwner) { return active?.owner===expected.owner && active.generation===expected.generation; }
async function key(owner: string, create=false, expected?: ActiveOwner) {
  const db=await openVault(),read=db.transaction("keys"),readDone=complete(read);
  const existing=await request(read.objectStore("keys").get(owner));await readDone;
  if(existing)return existing.value as CryptoKey;
  if(!create)throw new Error("The device key is unavailable. Connect and sign in again.");
  const holder=expected || await activeOwner(owner);
  const generated=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  const tx=db.transaction(["keys","meta"],"readwrite"),done=complete(tx),store=tx.objectStore("keys");
  const active=await request(tx.objectStore("meta").get("active"));
  if(!sameOwner(active?.value,holder)){await done;throw changedOwner();}
  const winner=await request(store.get(owner));if(!winner)store.put({id:owner,value:generated});
  await done;return (winner?.value || generated) as CryptoKey;
}
export async function seal(owner: string, id: string, value: unknown, expected?: ActiveOwner): Promise<Sealed> {
  const holder=expected || await activeOwner(owner),iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(`${owner}:${id}`)},await key(owner,true,holder),new TextEncoder().encode(JSON.stringify(value)));
  return {id:`${owner}:${id}`,owner,iv,bytes};
}
async function unseal<T>(row: Sealed): Promise<T> {
  const id = row.id.slice(row.owner.length + 1);
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv as Uint8Array<ArrayBuffer>, additionalData: new TextEncoder().encode(`${row.owner}:${id}`) }, await key(row.owner), row.bytes);
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function readEntry<T>(owner: string, id: string): Promise<T | undefined> {
  const db = await openVault(); const tx = db.transaction("entries"); const done = complete(tx);
  const row = await request(tx.objectStore("entries").get(`${owner}:${id}`)); await done;
  return row ? unseal<T>(row) : undefined;
}
export async function writeEntry(owner: string, id: string, value: unknown) {
  const expected=await activeOwner(owner),row=await seal(owner,id,value,expected),db=await openVault();
  const tx=db.transaction(["entries","meta"],"readwrite"),done=complete(tx);
  const active=await request(tx.objectStore("meta").get("active"));
  if(!sameOwner(active?.value,expected)){await done;throw changedOwner();}
  tx.objectStore("entries").put(row);await done;
}
export async function deleteEntry(owner: string, id: string) {
  const expected=await activeOwner(owner),db=await openVault(),tx=db.transaction(["entries","meta"],"readwrite"),done=complete(tx);
  const active=await request(tx.objectStore("meta").get("active"));
  if(!sameOwner(active?.value,expected)){await done;throw changedOwner();}
  tx.objectStore("entries").delete(`${owner}:${id}`);await done;
}
export async function entries<T>(owner: string, prefix: string): Promise<T[]> {
  const db = await openVault(); const tx = db.transaction("entries"); const done = complete(tx);
  const rows: Sealed[] = await request(tx.objectStore("entries").getAll(IDBKeyRange.bound(`${owner}:${prefix}`, `${owner}:${prefix}\uffff`))); await done;
  return Promise.all(rows.filter(row => row.owner === owner).map(row => unseal<T>(row)));
}
// Optimistic CAS keeps crypto outside the IDB transaction and retries across tabs.
export async function updateEntry<T>(owner: string, id: string, change: (value: T | undefined) => T | null): Promise<T | undefined> {
  const expected=await activeOwner(owner),db=await openVault();
  for (let attempt = 0; attempt < 30; attempt++) {
    const read = db.transaction("entries"); const readDone = complete(read); const before: Sealed | undefined = await request(read.objectStore("entries").get(`${owner}:${id}`)); await readDone;
    const next = change(before ? await unseal<T>(before) : undefined); const row = next === null ? null : await seal(owner, id, next, expected);
    const tx = db.transaction(["entries", "meta"], "readwrite"); const done = complete(tx); const store = tx.objectStore("entries");
    const active=await request(tx.objectStore("meta").get("active"));
    if(!sameOwner(active?.value,expected)){await done;throw changedOwner();}
    const current: Sealed | undefined = await request(store.get(`${owner}:${id}`));
    const same = (!current && !before) || (current && before && current.iv.every((v, i) => v === before.iv[i]));
    if (same) { if (row) store.put(row); else store.delete(`${owner}:${id}`); }
    await done; if (same) return next ?? undefined;
  }
  throw new Error("Another tab is updating this PM. Please retry.");
}
export async function clearOwner(owner: string, generation?: string) {
  const db = await openVault(); const tx = db.transaction(["entries", "keys", "meta"], "readwrite"); const done = complete(tx);
  const active=await request(tx.objectStore("meta").get("active"));
  if(generation && !sameOwner(active?.value,{owner,generation})){await done;throw changedOwner();}
  const cursor = tx.objectStore("entries").openCursor(IDBKeyRange.bound(`${owner}:`, `${owner}:\uffff`));
  cursor.onsuccess = () => { const c = cursor.result; if (c) { c.delete(); c.continue(); } };
  tx.objectStore("keys").delete(owner); if(active?.value?.owner===owner)tx.objectStore("meta").delete("active"); await done;
}
