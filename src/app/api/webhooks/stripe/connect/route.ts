import type Stripe from "stripe";
import { withTenant } from "@/db/client";
import { claimStripeEvent, findTenantByStripeAccount, finishStripeEvent } from "@/db/system";
import { serverEnv } from "@/env";
import { findBookingByPaymentIntent, recordLedgerEntry, setBookingStatus } from "@/server/bookings";
import { updateTenantProfile } from "@/server/setup";
import { chargeBreakdown, stripe } from "@/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe **Connect** webhook — events that happen on photographers' accounts.
 * Register this URL in the Dashboard under "Listen to events on Connected
 * accounts". Every event carries `event.account`, which is how we find the
 * tenant before opening a tenant-scoped transaction.
 *
 * This is the only place a booking becomes "confirmed". Nothing is ever
 * marked paid by hand.
 */
export async function POST(req: Request) {
  const secret = serverEnv().STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_CONNECT_WEBHOOK_SECRET not set", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }

  const fresh = await claimStripeEvent({ id: event.id, type: event.type, account: event.account });
  if (!fresh) return Response.json({ received: true, duplicate: true });

  const accountId = event.account;
  const tenant = accountId ? await findTenantByStripeAccount(accountId) : null;
  if (!tenant) {
    await finishStripeEvent(event.id, null, "no tenant for account");
    return Response.json({ received: true, ignored: true });
  }

  try {
    await withTenant(tenant.id, async (tx) => {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object;
          const booking = await findBookingByPaymentIntent(tx, pi.id);
          if (!booking) return;
          const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
          const breakdown = chargeId ? await chargeBreakdown(chargeId, tenant.stripeAccountId!) : null;
          await recordLedgerEntry(tx, {
            tenantId: tenant.id,
            bookingId: booking.id,
            type: "charge",
            amountCents: pi.amount_received,
            feeCents: breakdown?.fee ?? 0,
            netCents: breakdown?.net ?? pi.amount_received,
            currency: pi.currency,
            stripeObjectId: chargeId ?? pi.id,
            methodLabel: breakdown?.methodLabel ?? "Card",
            note: "Deposit",
            occurredAt: breakdown?.created ?? new Date(pi.created * 1000),
          });
          await setBookingStatus(tx, booking.id, "confirmed", {
            lastPaymentError: null,
            stripeCustomerId: typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null),
          });
          // TODO(email): send signed PDF + receipt to both parties.
          return;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object;
          const booking = await findBookingByPaymentIntent(tx, pi.id);
          if (!booking || booking.status === "confirmed") return;
          await setBookingStatus(tx, booking.id, "payment_failed", {
            lastPaymentError: pi.last_payment_error?.message ?? "Payment failed",
          });
          return;
        }
        case "charge.refunded": {
          const ch = event.data.object;
          const piId = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
          if (!piId) return;
          const booking = await findBookingByPaymentIntent(tx, piId);
          if (!booking) return;
          // Refunds started from the dashboard are already on the ledger (same
          // refund id) — onConflictDoNothing makes this a safe replay.
          const refunds = await stripe().refunds.list({ charge: ch.id, limit: 20 }, { stripeAccount: tenant.stripeAccountId! });
          for (const r of refunds.data) {
            await recordLedgerEntry(tx, {
              tenantId: tenant.id,
              bookingId: booking.id,
              type: "refund",
              amountCents: -r.amount,
              netCents: -r.amount,
              currency: r.currency,
              stripeObjectId: r.id,
              methodLabel: "Original card",
              note: (r.metadata?.reason as string | undefined) ?? r.reason ?? null,
              occurredAt: new Date(r.created * 1000),
            });
          }
          if (ch.amount_refunded >= ch.amount) {
            await setBookingStatus(tx, booking.id, "refunded", { cancelledAt: booking.cancelledAt ?? new Date() });
          }
          return;
        }
        case "payout.paid": {
          const po = event.data.object;
          // Payouts aren't per-booking; attach to the most recent charged booking
          // so the dashboard can show "next payout". A fuller model would have a
          // payouts table — left for the reconciliation pass.
          const [latest] = await tx.query.ledgerEntries.findMany({
            where: (l, { eq }) => eq(l.type, "charge"),
            orderBy: (l, { desc }) => desc(l.occurredAt),
            limit: 1,
          });
          if (!latest) return;
          await recordLedgerEntry(tx, {
            tenantId: tenant.id,
            bookingId: latest.bookingId,
            type: "payout",
            amountCents: 0,
            netCents: po.amount,
            currency: po.currency,
            stripeObjectId: po.id,
            methodLabel: "Bank",
            occurredAt: new Date((po.arrival_date ?? po.created) * 1000),
          });
          return;
        }
        case "account.updated": {
          const acct = event.data.object;
          await updateTenantProfile(tx, tenant.id, {
            stripeChargesEnabled: Boolean(acct.charges_enabled),
            stripePayoutsEnabled: Boolean(acct.payouts_enabled),
          });
          return;
        }
        default:
          return;
      }
    });
    await finishStripeEvent(event.id, tenant.id);
  } catch (e) {
    await finishStripeEvent(event.id, tenant.id, (e as Error).message);
    // 500 → Stripe retries with backoff
    return new Response("handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
