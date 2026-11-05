import { requireUser } from "@/lib/auth";
import { PmWorkspace } from "@/features/pm/PmWorkspace";
export default async function Home() {
  const user = await requireUser();
  return <PmWorkspace user={{ id: user.id, displayName: user.displayName, role: user.role }} />;
}
