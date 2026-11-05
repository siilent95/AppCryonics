"use client";
import { useEffect } from "react";
import { offlineEngine } from "./engine";
import { useOffline } from "./useOffline";
import { prepareDevice } from "./data";
import type { OfflineUser } from "./types";
export function OfflineBoundary({user,children,offlineStart=false}:{user:OfflineUser;children:React.ReactNode;offlineStart?:boolean}) {
  const state=useOffline();
  const {id,displayName,role}=user;
  useEffect(()=>{
    let disposed=false;
    offlineEngine.activate({id,displayName,role},offlineStart).then(()=>{
      if(disposed||!offlineEngine.getState().ready)return;
      void offlineEngine.sync();
      // Production builds have stable resource hashes; dev HMR is not an offline shell.
      if(process.env.NODE_ENV==="production"&&navigator.onLine&&!offlineEngine.getState().prepared)void prepareDevice();
    }).catch(e=>offlineEngine.publish({blocked:true,error:`Device recovery could not start: ${e.message}`}));
    const online=()=>{offlineEngine.publish({online:true});void offlineEngine.sync();};
    const offline=()=>offlineEngine.publish({online:false});
    const foreground=()=>{if(document.visibilityState==="visible")void offlineEngine.sync();};
    window.addEventListener("online",online);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",foreground);
    const timer=setInterval(()=>{if(document.visibilityState==="visible")void offlineEngine.sync();},30_000+Math.random()*5000);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener("online",online);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",foreground);};
  },[id,displayName,role,offlineStart]);
  if(state.blocked)return <main className="loginPanel"><h1>Tablet handover needs attention</h1><p role="alert">{state.error}</p><p>The previous technician’s pending work has not been deleted or transferred.</p><a href="/login">Return to sign in</a></main>;
  if(!state.ready)return <main className="loginPanel"><h1>CryoPM</h1><p role="status">Opening protected device storage…</p></main>;
  return children;
}
