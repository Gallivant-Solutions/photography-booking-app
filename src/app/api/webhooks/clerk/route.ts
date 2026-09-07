import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deleteMembershipsForUser } from "@/db/system";

export const dynamic = "force-dynamic";

/**
 * Clerk webhook. Set CLERK_WEBHOOK_SIGNING_SECRET and subscribe to user.deleted.
 * A studio whose only owner is deleted keeps its data (bookings are contracts)
 * but loses its membership; ownership can be reassigned by support.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET });
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }

  if (evt.type === "user.deleted" && evt.data.id) {
    await deleteMembershipsForUser(evt.data.id);
  }
  return Response.json({ received: true });
}
