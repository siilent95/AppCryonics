export type UserRole = "admin" | "technician";
export type ManagedUser = { id: string; displayName: string; email: string; username: string | null; role: UserRole; disabled: number; activatedAt: string | null; passwordSetupRequired: number };
export type InvitationLink = { url: string; expiresAt: string };
