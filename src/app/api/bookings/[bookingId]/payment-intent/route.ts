import { z } from "zod";
import { withTenant } from "@/db/client";
import { findTenantBySlug } from "@/db/system";
import { badRequest, handler, notFoundError, ok, parseJson } from "@/server/api";
import { attachPaymentIntent, getBookingForClient } from "@/server/intake";
import { ensureDepositIntent } from "@/server/stripe";

export const dynamic = "force-dynamic";

const body = z.object({ slug: z.string().min(1) });

/**
 * POST /api/bookings/:id/payment-intent  { slug }
 * Public, but gated by the booking's httpOnly token cookie. Returns what the
 * embedded PaymentElement needs. The amount comes from the booking row.
 */
export const POST = handler<{ params: Promise<{ bookingId: string }> }>(async (req, ctx) => {
  const { bookingId } = await ctx.params;
  const { slug } = await parseJson(req, body);
  const tenant = await findTenantBySlug(slug);
  if (!tenant) throw notFoundError("Studio");
  if (!tenant.stripeAccountId || !tenant.stripeChargesEnabled) throw badRequest("This studio isn't taking deposits yet");

  const result = await withTenant(tenant.id, async (tx) => {
    const booking = await getBookingForClient(tx, bookingId);
    if (!booking) throw notFoundError("Booking");
    if (!booking.signedAt) throw badRequest("Sign the agreement first");
    if (booking.status === "confirmed") throw badRequest("Deposit already paid");
    const intent = await ensureDepositIntent(tenant, booking);
    if (intent.id !== booking.stripePaymentIntentId) await attachPaymentIntent(tx, booking.id, intent.id);
    return { clientSecret: intent.client_secret, amountCents: intent.amount, currency: intent.currency };
  });

  return ok({ ...result, stripeAccountId: tenant.stripeAccountId });
});
