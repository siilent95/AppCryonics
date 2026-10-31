"use client";
import { useDialogDismiss } from "@/features/shared/useDialogDismiss";
import { useEffect, useRef, useState } from "react";
import type { ManagedUser } from "./types";
import { accountRequest } from "./useUsers";
export function EditUserDialog({ user, onClose, onSaved }: { user: ManagedUser; onClose: () => void; onSaved: (name: string, invitationsRevoked: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = displayName.trim() !== user.displayName || email.trim().toLowerCase() !== user.email || (username.trim().toLowerCase() || null) !== user.username;
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  const dismiss = useDialogDismiss(busy);
  return <dialog {...dismiss} ref={dialog} className="catalogDialog editUserDialog" aria-labelledby="edit-user-title" aria-describedby="edit-user-help" onClose={onClose}>
    <header><div><p>{user.displayName}</p><h2 id="edit-user-title">Edit user details</h2></div></header>
    <p id="edit-user-help">Update this account’s contact and sign-in details. New email and username values apply at the next sign-in.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const result = await accountRequest(`/api/admin/users/${user.id}/profile`, "PATCH", { displayName, email, username, expectedProfile: { displayName: user.displayName, email: user.email, username: user.username } });
        onSaved(result.user.displayName, result.invitationsRevoked); onClose();
      } catch (error) { setError(error instanceof Error ? error.message : "Unable to save user details."); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}><label>Name<input autoFocus name="displayName" value={displayName} onChange={event => setDisplayName(event.target.value)} required maxLength={160} autoComplete="off" /></label>
      <label>Email<input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
      <label>Username (optional)<input name="username" value={username} onChange={event => setUsername(event.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,63}" maxLength={64} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="edit-username-help" /></label><small id="edit-username-help">3–64 characters, starting with a letter or number. Dots, underscores and hyphens are allowed. Leave blank to use email only.</small></fieldset>
      {error && <p className="accountError" role="alert">{error}</p>}
      <div className="editUserActions"><button className="ghostButton" disabled={busy} type="button" onClick={() => dialog.current?.close()}>Cancel</button><button className="primaryAction" disabled={busy || !changed || !displayName.trim() || !email.trim()} type="submit">{busy ? "Saving…" : "Save changes"}</button></div>
    </form>
  </dialog>;
}
