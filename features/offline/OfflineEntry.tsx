"use client";
import { useEffect, useState } from "react";
import { PmWorkspace } from "../pm/PmWorkspace";
import { metadata, readEntry } from "./vault";
import type { OfflineUser } from "./types";
export function OfflineEntry() {
  const [user,setUser]=useState<OfflineUser|null>(null),[error,setError]=useState("");
  useEffect(()=>{metadata<{owner:string}>("active").then(async active=>{
    if(!active)throw new Error("This tablet has no prepared technician. Connect and sign in before your visit.");
    const profile=await readEntry<OfflineUser>(active.owner,"profile");if(!profile)throw new Error("The prepared technician could not be recovered. Connect and sign in again.");setUser(profile);
  }).catch(e=>setError(e.message));},[]);
  if(user)return <PmWorkspace user={user} offlineStart />;
  return <main className="loginPanel"><h1>CryoPM</h1><p role={error?"alert":"status"}>{error||"Recovering your prepared workspace…"}</p>{error&&<a href="/login">Sign in with a connection</a>}</main>;
}
