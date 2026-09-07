import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { badRequest, handler, ok, unauthorized } from "@/server/api";
import { createBillingCheckout } from "@/server/stripe";
import { getStudio } from "@/server/tenant";

export const dynamic = "force-dynamic";

const q = z.object({ plan: z.enum(["solo", "studio"]), interval: z.enum(["monthly", "yearly"]).default("monthly") });

async function checkoutUrl(plan: "solo" | "studio", interval: "monthly" | "yearly") {
  const studio = await getStudio();
  if (!studio) throw unauthorized();
  const user = await currentUser();
  const session = await createBillingCheckout(studio.tenant, plan, interval, user?.primaryEmailAddress?.emailAddress ?? null);
  if (!session.url) throw badRequest("Stripe did not return a checkout URL");
  return session.url;
}

/** GET /api/billing/checkout?plan=studio&interval=monthly → 303 to Stripe Checkout */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const parsed = q.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw badRequest("plan must be solo|studio, interval monthly|yearly");
  const studio = await getStudio();
  // Not onboarded yet → set up the studio first, then come back.
  if (!studio) return NextResponse.redirect(new URL("/onboarding", url.origin), 303);
  return NextResponse.redirect(await checkoutUrl(parsed.data.plan, parsed.data.interval), 303);
});

/** POST /api/billing/checkout { plan, interval } → { url } */
export const POST = handler(async (req) => {
  const parsed = q.parse(await req.json());
  return ok({ url: await checkoutUrl(parsed.plan, parsed.interval) });
});
