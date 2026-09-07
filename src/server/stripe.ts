import "server-only";
import Stripe from "stripe";
import { serverEnv, publicEnv } from "@/env";
import type { Booking, Tenant } from "@/db/schema";

let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(serverEnv().STRIPE_SECRET_KEY, {
      appInfo: { name: "Bookedin", version: "0.1.0" },
      typescript: true,
    });
  }
  return client;
}

/**
 * Deposits use Stripe Connect *direct charges* on the photographer's own
 * account: the charge, the fee and the payout all belong to them ("money moves
 * to your bank, not ours"). The account has a full Stripe dashboard and pays
 * its own processing fees, so the platform never touches the funds.
 */
export async function createConnectAccount(tenant: Tenant, email: string | null): Promise<string> {
  const account = await stripe().accounts.create({
    controller: {
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      stripe_dashboard: { type: "full" },
    },
    email: email ?? undefined,
    business_profile: { name: tenant.name, product_description: "Photography bookings and deposits" },
    metadata: { tenantId: tenant.id, slug: tenant.slug },
  });
  return account.id;
}

export async function createAccountOnboardingLink(accountId: string): Promise<string> {
  const base = publicEnv.NEXT_PUBLIC_APP_URL;
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/setup/deposit?stripe=refresh`,
    return_url: `${base}/setup/deposit?stripe=return`,
  });
  return link.url;
}

export async function fetchAccountStatus(accountId: string) {
  const a = await stripe().accounts.retrieve(accountId);
  const bank = a.external_accounts?.data.find((x) => x.object === "bank_account") as
    | Stripe.BankAccount
    | undefined;
  return {
    chargesEnabled: Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
    bankLast4: bank?.last4 ?? null,
    payoutSchedule: a.settings?.payouts?.schedule?.interval ?? null,
  };
}

/**
 * One PaymentIntent per booking, created on the connected account. The amount
 * is the booking's snapshotted deposit — computed from the package, never
 * accepted from the client.
 */
export async function ensureDepositIntent(tenant: Tenant, booking: Booking): Promise<Stripe.PaymentIntent> {
  if (!tenant.stripeAccountId) throw new Error("Studio has not connected Stripe");
  if (!booking.depositCents || booking.depositCents <= 0) throw new Error("Booking has no deposit amount");
  const opts = { stripeAccount: tenant.stripeAccountId };

  if (booking.stripePaymentIntentId) {
    const existing = await stripe().paymentIntents.retrieve(booking.stripePaymentIntentId, {}, opts);
    if (existing.status !== "succeeded" && existing.status !== "canceled") {
      if (existing.amount !== booking.depositCents) {
        return stripe().paymentIntents.update(existing.id, { amount: booking.depositCents }, opts);
      }
      return existing;
    }
  }

  return stripe().paymentIntents.create(
    {
      amount: booking.depositCents,
      currency: booking.currency,
      automatic_payment_methods: { enabled: true },
      // Card is saved so Studio-plan photographers can charge the balance later.
      setup_future_usage: "off_session",
      receipt_email: booking.clientEmail ?? undefined,
      description: `${tenant.name} · ${booking.packageName ?? "Booking"} deposit`,
      statement_descriptor_suffix: tenant.name.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || undefined,
      metadata: { tenantId: tenant.id, bookingId: booking.id, kind: "deposit" },
    },
    { ...opts, idempotencyKey: `deposit:${booking.id}:${booking.depositCents}` },
  );
}

export async function refundDeposit(
  tenant: Tenant,
  booking: Booking,
  amountCents: number,
  reason: string,
): Promise<Stripe.Refund> {
  if (!tenant.stripeAccountId) throw new Error("Studio has not connected Stripe");
  if (!booking.stripePaymentIntentId) throw new Error("Nothing to refund");
  return stripe().refunds.create(
    {
      payment_intent: booking.stripePaymentIntentId,
      amount: amountCents,
      metadata: { tenantId: tenant.id, bookingId: booking.id, reason: reason.slice(0, 500) },
    },
    { stripeAccount: tenant.stripeAccountId, idempotencyKey: `refund:${booking.id}:${amountCents}:${Date.now()}` },
  );
}

/** Fee + net for a succeeded charge, from its balance transaction. */
export async function chargeBreakdown(chargeId: string, accountId: string) {
  const ch = await stripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] }, { stripeAccount: accountId });
  const bt = ch.balance_transaction as Stripe.BalanceTransaction | null;
  const card = ch.payment_method_details?.card;
  return {
    amount: ch.amount,
    fee: bt?.fee ?? 0,
    net: bt?.net ?? ch.amount,
    methodLabel: card ? `${capitalize(card.brand ?? "Card")} ••${card.last4}` : "Card",
    created: new Date(ch.created * 1000),
  };
}

// ── Platform billing (Solo / Studio) ────────────────────────────────────────
export type PlanKey = "solo" | "studio";
export type Interval = "monthly" | "yearly";

export function priceIdFor(plan: PlanKey, interval: Interval): string | undefined {
  const env = serverEnv();
  const map = {
    solo: { monthly: env.STRIPE_PRICE_SOLO_MONTHLY, yearly: env.STRIPE_PRICE_SOLO_YEARLY },
    studio: { monthly: env.STRIPE_PRICE_STUDIO_MONTHLY, yearly: env.STRIPE_PRICE_STUDIO_YEARLY },
  } as const;
  return map[plan][interval];
}

export async function createBillingCheckout(tenant: Tenant, plan: PlanKey, interval: Interval, email: string | null) {
  const price = priceIdFor(plan, interval);
  if (!price) throw new Error(`No Stripe price configured for ${plan}/${interval}`);
  const base = publicEnv.NEXT_PUBLIC_APP_URL;
  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer: tenant.stripeCustomerId ?? undefined,
    customer_email: tenant.stripeCustomerId ? undefined : (email ?? undefined),
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}/dashboard?billing=success`,
    cancel_url: `${base}/pricing`,
    client_reference_id: tenant.id,
    subscription_data: { metadata: { tenantId: tenant.id, plan } },
    metadata: { tenantId: tenant.id, plan },
    allow_promotion_codes: true,
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
