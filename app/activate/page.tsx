"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/features/accounts/PasswordInput";
export default function Activate() {
  const token = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [mismatch, setMismatch] = useState(false);
  useEffect(() => {
    // URL fragments are client-only; initialization must also finish in background tabs.
    let cancelled = false;
    const readLink = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (fragment) token.current = fragment;
      window.history.replaceState(null, "", window.location.pathname);
      queueMicrotask(() => { if (!cancelled) setHasToken(Boolean(token.current)); });
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => { cancelled = true; window.removeEventListener("hashchange", readLink); };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!token.current) { setHasToken(false); return; }
    if (form.get("password") !== form.get("confirmation")) { setMismatch(true); setError("Passwords do not match. Enter the same password in both fields."); event.currentTarget.querySelector<HTMLInputElement>('[name="confirmation"]')?.focus(); return; }
    setMismatch(false);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, password: form.get("password") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to set password.");
      token.current = ""; setDone(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to set password."); }
    finally { setBusy(false); }
  }
  return <main className="loginPanel"><h1>{done ? "Account ready" : hasToken === false ? "Invitation link needed" : "Choose your password"}</h1>{done ? <><p>Your password has been saved. Sign in using your email or username.</p><a className="activationLogin" href="/login">Go to sign in</a></> : hasToken === null ? <p role="status">Checking invitation link…</p> : !hasToken ? <><p>Open the invitation or password reset link shared by your administrator. Ask for a new link if yours has expired.</p><a className="activationLogin" href="/login">Go to sign in</a></> : <><p id="password-requirements">Use at least 12 characters. Choose a password you do not use elsewhere.</p><form onSubmit={event => void submit(event)}>
    <PasswordInput id="new-password" name="password" label="New password" autoComplete="new-password" minLength={12} describedBy="password-requirements" />
    <PasswordInput id="confirm-password" name="confirmation" label="Confirm password" autoComplete="new-password" minLength={12} invalid={mismatch} describedBy={mismatch ? "activation-error" : "password-requirements"} />
    {error && <p id="activation-error" role="alert">{error}</p>}<button className="primaryButton" disabled={busy} type="submit">{busy ? "Saving…" : "Set password"}</button></form></>}</main>;
}
