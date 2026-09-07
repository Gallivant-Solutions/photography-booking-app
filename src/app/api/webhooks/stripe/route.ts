import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { withTenant } from "@/db/client";
import { subscriptions, tenants } from "@/db/schema";
import { claimStripeEvent, findTenantByStripeCustomer, finishStripeEvent } from "@/db/system";
import { serverEnv } from "@/env";
import { stripe } from "@/server/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe **platform** webhook — Bookedin's own billing (Solo / Studio plans).
 * Register this URL for events on *your account* (not connected accounts).
 */
export async function POST(req: Request) {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }

  const fresh = await claimStripeEvent({ id: event.id, type: event.type });
  if (!fresh) return Response.json({ received: true, duplicate: true });

  let tenantId: string | null = null;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        tenantId = s.metadata?.tenantId ?? s.client_reference_id ?? null;
        const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (tenantId && customerId) {
          await withTenant(tenantId, (tx) =>
            tx.update(tenants).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(tenants.id, tenantId!)),
          );
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        tenantId = sub.metadata?.tenantId ?? (await findTenantByStripeCustomer(customerId))?.id ?? null;
        if (!tenantId) break;
        const plan = (sub.metadata?.plan as "solo" | "studio" | undefined) ?? planFromPrice(sub.items.data[0]?.price.id);
        const status = mapStatus(sub.status);
        const active = status === "active" || status === "trialing";
        const periodEnd = sub.items.data[0]?.current_period_end;
        await withTenant(tenantId, async (tx) => {
          await tx
            .insert(subscriptions)
            .values({
              tenantId: tenantId!,
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0]?.price.id ?? null,
              plan,
              status,
              currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            })
            .onConflictDoUpdate({
              target: subscriptions.tenantId,
              set: {
                stripeSubscriptionId: sub.id,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
                plan,
                status,
                currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
                cancelAtPeriodEnd: sub.cancel_at_period_end,
                updatedAt: new Date(),
              },
            });
          await tx
            .update(tenants)
            .set({ plan: active ? plan : "free", stripeCustomerId: customerId, updatedAt: new Date() })
            .where(eq(tenants.id, tenantId!));
        });
        break;
      }
      default:
        break;
    }
    await finishStripeEvent(event.id, tenantId);
  } catch (e) {
    await finishStripeEvent(event.id, tenantId, (e as Error).message);
    return new Response("handler error", { status: 500 });
  }
  return Response.json({ received: true });
}

function planFromPrice(priceId: string | undefined): "solo" | "studio" {
  const env = serverEnv();
  if (priceId && (priceId === env.STRIPE_PRICE_STUDIO_MONTHLY || priceId === env.STRIPE_PRICE_STUDIO_YEARLY)) return "studio";
  return "solo";
}

type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";

const KNOWN: ReadonlySet<string> = new Set<SubStatus>(["trialing", "active", "past_due", "canceled", "incomplete", "unpaid"]);

function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  if (KNOWN.has(s)) return s as SubStatus;
  if (s === "incomplete_expired") return "canceled";
  if (s === "paused") return "past_due";
  return "incomplete";
}
