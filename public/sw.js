/* Public shell only. Private assets are read from the active technician's vault. */
const SHELL = "cryopm-shell-v1";
self.addEventListener("install", () => { /* Activation waits for existing clients. */ });
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
const reqValue = r => new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function deviceAsset(path) {
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("cryopm-offline-v1",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>{r.transaction.abort();reject(new Error("No prepared device"));};});
  try {
    const active=await reqValue(db.transaction("meta").objectStore("meta").get("active"));
    if(!active?.value?.owner)return null;
    const owner=active.value.owner,id="resource:"+path;
    const row=await reqValue(db.transaction("entries").objectStore("entries").get(owner+":"+id));
    if(!row||row.owner!==owner)return null;
    const key=await reqValue(db.transaction("keys").objectStore("keys").get(owner));if(!key)return null;
    const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:row.iv,additionalData:new TextEncoder().encode(owner+":"+id)},key.value,row.bytes);
    const data=JSON.parse(new TextDecoder().decode(plain));
    if(data.expiresAt&&Date.parse(data.expiresAt)<=Date.now())return null;
    if(!data.type?.startsWith("image/")&&data.type!=="application/pdf")return null;
    return new Response(Uint8Array.from(atob(data.bytes),c=>c.charCodeAt(0)),{headers:{"Content-Type":data.type,"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"}});
  } finally {db.close();}
}
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);if(url.origin!==self.location.origin||event.request.method!=="GET")return;
  if(event.request.mode==="navigate"&&(url.pathname==="/"||url.pathname==="/offline")) {
    event.respondWith((async()=>{
      try {
        const r=await fetch(event.request,{signal:AbortSignal.timeout(3500)});
        if(r.ok&&!r.redirected)return r;
        const offline=await caches.match("/offline",{cacheName:SHELL});
        return offline||r;
      } catch {
        return await caches.match("/offline",{cacheName:SHELL})||new Response("Connect to prepare CryoPM before using it offline.",{status:503,headers:{"Content-Type":"text/plain"}});
      }
    })());return;
  }
  if(/^\/api\/(equipment\/models\/[^/]+\/assets|pm-records\/[^/]+\/signature)$/.test(url.pathname)) {
    event.respondWith((async()=>{
      if(event.request.cache==="no-store")return fetch(event.request);
      const asset=new URL(url),download=asset.searchParams.get("download");asset.searchParams.delete("download");
      const stored=await deviceAsset(asset.pathname+asset.search).catch(()=>null);
      if(!stored)return fetch(event.request);
      if(download==="1"&&stored.headers.get("Content-Type")==="application/pdf")stored.headers.set("Content-Disposition",'attachment; filename="datasheet.pdf"');
      return stored;
    })());return;
  }
  if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/brand/")||url.pathname.startsWith("/freezers/")||url.pathname.startsWith("/api/pdfjs/")) {
    event.respondWith((async()=>{
      const cache=await caches.open(SHELL),hit=await cache.match(event.request);if(hit)return hit;
      const r=await fetch(event.request);if(r.ok&&!r.redirected)await cache.put(event.request,r.clone());return r;
    })());
  }
});
