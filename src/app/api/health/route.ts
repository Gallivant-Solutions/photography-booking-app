import { ok } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ status: "ok", time: new Date().toISOString() });
}
