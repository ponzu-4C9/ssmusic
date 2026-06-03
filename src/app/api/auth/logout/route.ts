import { deleteSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await deleteSession();
  return Response.json({ ok: true });
}
