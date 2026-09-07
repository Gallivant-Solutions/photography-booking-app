import { NextResponse } from "next/server";
import { withTenant } from "@/db/client";
import { findTenantBySlug } from "@/db/system";
import { createBooking, loadDefaultForm, setBookingCookie } from "@/server/intake";
import { clientBase, paths } from "@/server/client-paths";

export const dynamic = "force-dynamic";

/**
 * GET /start — a plain link version of the Start button, so a photographer
 * can deep-link straight into a fresh questionnaire (e.g. from an email).
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const tenant = await findTenantBySlug(slug);
  if (!tenant) return new Response("Not found", { status: 404 });
  const base = await clientBase(slug);
  const { booking, token } = await withTenant(tenant.id, async (tx) => {
    const bundle = await loadDefaultForm(tx, tenant.id);
    if (!bundle) throw new Error("No booking link configured");
    return createBooking(tx, tenant.id, bundle.form.id);
  });
  await setBookingCookie(booking.id, token);
  return NextResponse.redirect(new URL(paths.question(base, booking.id, 1), req.url), 303);
}
