import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { deleteShowcase } from "@/lib/showcase";

// DELETE turns a showcase off: its address stops working straight away.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!(await deleteShowcase(auth.userId, id))) return Response.json({ error: "No such showcase" }, { status: 404 });
  void log.info("showcase.removed", { user: auth.userId });
  return Response.json({ ok: true });
}
