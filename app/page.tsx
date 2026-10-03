import { requireUser } from "@/lib/auth";
import { PmWorkspace } from "@/features/pm/PmWorkspace";
export default async function Home() {
  const user = await requireUser();
  return <><div className="accountBar"><span>{user.displayName}</span><form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form></div><PmWorkspace /></>;
}
