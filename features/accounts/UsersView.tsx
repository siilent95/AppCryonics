"use client";
import { EditUserDialog } from "./EditUserDialog";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { InvitationLink, ManagedUser, UserRole } from "./types";
import { accountRequest, useUsers } from "./useUsers";
function UserRow({ user, busy, onUpdate, onInvite, onEdit }: { user: ManagedUser; busy: boolean; onUpdate: (user: ManagedUser, role: UserRole, disabled: boolean) => void; onInvite: (user: ManagedUser) => void; onEdit: (user: ManagedUser) => void }) {
  const [role, setRole] = useState(user.role);
  return <tr role="row"><td role="cell"><strong>{user.displayName}</strong><small>{user.username ? `@${user.username}` : user.email}</small></td><td role="cell" data-label="Email">{user.email}</td><td role="cell" data-label="Role"><select aria-label={`Role for ${user.displayName}`} disabled={busy} value={role} onChange={e => setRole(e.target.value as UserRole)}><option value="technician">Technician</option><option value="admin">Admin</option></select></td><td role="cell" data-label="Status">{user.disabled ? "Disabled" : !user.activatedAt ? "Invitation pending" : user.passwordSetupRequired ? "Password setup required" : "Active"}</td><td role="cell" data-label="Actions"><div className="userRowActions"><button className="ghostButton" type="button" disabled={busy} onClick={() => onEdit(user)} aria-label={`Edit details for ${user.displayName}`}>Edit details</button><button className="ghostButton" type="button" disabled={busy || role === user.role} onClick={() => onUpdate(user, role, Boolean(user.disabled))}>Save role</button><button className="ghostButton" type="button" disabled={busy} onClick={() => onUpdate(user, user.role, !user.disabled)}>{user.disabled ? "Enable" : "Disable"}</button><button className="ghostButton" type="button" disabled={busy || Boolean(user.disabled)} onClick={() => onInvite(user)}>{user.activatedAt ? "Reset password" : "New invitation"}</button></div></td></tr>;
}
export function UsersView() {
  const router = useRouter();
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [version, setVersion] = useState(0);
  const response = useUsers(version);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invitation, setInvitation] = useState<InvitationLink | null>(null);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    setBusy(true); setError(""); setNotice(""); setInvitation(null);
    try { const result = await accountRequest("/api/admin/users", "POST", Object.fromEntries(new FormData(form))); setInvitation(result.invitation); setVersion(v => v + 1); form.reset(); setNotice("User created. Share the invitation privately so they can choose their password."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to create user."); }
    finally { setBusy(false); }
  }
  async function update(user: ManagedUser, role: UserRole, disabled: boolean) {
    setBusy(true); setError(""); setNotice(""); setInvitation(null);
    try { await accountRequest(`/api/admin/users/${user.id}`, "PATCH", { role, disabled }); setVersion(v => v + 1); setNotice("Account updated. Disabled accounts and role changes invalidate existing sessions."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to update account."); }
    finally { setBusy(false); }
  }
  async function invite(user: ManagedUser) {
    setBusy(true); setError(""); setNotice(""); setInvitation(null);
    try { const result = await accountRequest(`/api/admin/users/${user.id}/invitation`, "POST", { purpose: user.activatedAt ? "reset" : "activation" }); setInvitation(result.invitation); setVersion(v => v + 1); setNotice(user.activatedAt ? "Reset link created. The user must choose a new password before signing in again." : "New invitation created. Previous invitation links are invalid."); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to issue invitation."); }
    finally { setBusy(false); }
  }
  return <div className="managementView accountManagement"><section className="viewHero"><div><div className="eyebrow">Administration</div><h1>Users</h1></div></section>
    <section className="accountPanel"><h2>Invite a user</h2><p>Copy and share the invitation link privately. It expires in 24 hours; no email is sent automatically.</p><form className="newUserForm" onSubmit={e => void create(e)}><label>Name<input name="displayName" required maxLength={160} autoComplete="name" /></label><label>Email<input name="email" type="email" required maxLength={320} autoComplete="email" autoCapitalize="none" spellCheck={false} /></label><label>Username (optional)<input name="username" pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,63}" maxLength={64} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby="invite-username-help" /><small id="invite-username-help">3–64 characters. Start with a letter or number; dots, underscores and hyphens are allowed.</small></label><label>Role<select name="role" defaultValue="technician"><option value="technician">Technician</option><option value="admin">Admin</option></select></label><button className="primaryAction" type="submit" disabled={busy}>{busy ? "Working…" : "Create invitation"}</button></form></section>
    {error && <p className="accountError" role="alert">{error}</p>}{notice && <p className="accountNotice" role="status">{notice}</p>}
    {invitation && <section className="accountPanel invitationResult"><h2>Private invitation link</h2><p>Valid until {new Date(invitation.expiresAt).toLocaleString()}. Copy it now; the link is only shown for this request.</p><label>Invitation URL<textarea readOnly value={invitation.url} onFocus={event => event.currentTarget.select()} /></label><button className="ghostButton" type="button" onClick={() => { void navigator.clipboard.writeText(invitation.url).then(() => setNotice("Invitation link copied.")).catch(() => setError("Select the invitation URL and copy it manually.")); }}>Copy invitation</button></section>}
    <section className="dataPanel"><div className="accountPanelHeading"><h2>Account directory</h2><button className="ghostButton" type="button" onClick={() => setVersion(v => v + 1)}>Refresh users</button></div>{!response ? <p className="accountStatus" role="status">Loading users…</p> : response.error ? <p className="accountError" role="alert">{response.error}</p> : <div className="tableWrap"><table className="recordsTable" role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">User</th><th role="columnheader" scope="col">Email</th><th role="columnheader" scope="col">Role</th><th role="columnheader" scope="col">Status</th><th role="columnheader" scope="col">Access management</th></tr></thead><tbody role="rowgroup">{response.users?.map(user => <UserRow key={`${user.id}-${version}`} user={user} busy={busy} onUpdate={(user, role, disabled) => void update(user, role, disabled)} onInvite={user => void invite(user)} onEdit={user => { setError(""); setNotice(""); setInvitation(null); setEditing(user); }} />)}</tbody></table></div>}</section>
    {editing && <EditUserDialog key={editing.id} user={editing} onClose={() => setEditing(null)} onSaved={(name, invitationsRevoked) => { setVersion(value => value + 1); setNotice(`Details for ${name} saved.${invitationsRevoked ? " Previous invitation/reset links were invalidated after the email change. Issue a new link if needed." : ""}`); router.refresh(); }} />}
  </div>;
}
