"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { publicEnv } from "@/env";

type IntentResponse =
  | { ok: true; data: { clientSecret: string; stripeAccountId: string; amountCents: number; currency: string } }
  | { ok: false; error: string };

/**
 * Embedded card field on the photographer's own page. The PaymentIntent lives
 * on their connected account, so Stripe.js is initialised with `stripeAccount`.
 */
export function DepositCheckout({ slug, bookingId, amountLabel, returnUrl }: { slug: string; bookingId: string; amountLabel: string; returnUrl: string }) {
  const [intent, setIntent] = useState<IntentResponse["ok"] extends true ? never : Extract<IntentResponse, { ok: true }>["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/bookings/${bookingId}/payment-intent`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const j = (await r.json()) as IntentResponse;
        if (cancelled) return;
        if (!j.ok) setError(j.error);
        else setIntent(j.data);
      } catch {
        if (!cancelled) setError("Couldn't reach the payment service. Refresh to try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId, slug]);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(
    () => (intent ? loadStripe(publicEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, { stripeAccount: intent.stripeAccountId }) : null),
    [intent],
  );

  if (error) return <FormError error={error} />;
  if (!intent || !stripePromise) {
    return (
      <div className="flex items-center gap-2 px-1 text-[13.5px] text-neutral-700">
        <Loader2 size={16} strokeWidth={2.75} className="animate-spin" /> Preparing a secure card field…
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: intent.clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            colorPrimary: "#c67139",
            colorBackground: "#f9f4ed",
            colorText: "#201e1d",
            colorDanger: "#a83a2a",
            fontFamily: "Figtree, system-ui, sans-serif",
            borderRadius: "999px",
            spacingUnit: "5px",
          },
          rules: {
            ".Input": { border: "1.5px solid #c0b6a5", padding: "15px 22px", fontSize: "15.5px" },
            ".Input:focus": { border: "1.5px solid #c67139", boxShadow: "none" },
            ".Label": { fontSize: "13px", fontWeight: "600", color: "#645c50" },
            ".Tab, .Block": { borderRadius: "16px" },
          },
        },
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap" }],
      }}
    >
      <CardForm amountLabel={amountLabel} returnUrl={returnUrl} />
    </Elements>
  );
}

function CardForm({ amountLabel, returnUrl }: { amountLabel: string; returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: new URL(returnUrl, window.location.origin).toString() },
    });
    // Only reached on immediate failure; success redirects to return_url.
    if (error) setErr(error.message ?? "Payment didn't go through");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <FormError error={err} />
      <div className="flex-1" />
      <div className="flex flex-col gap-2.5">
        <button type="submit" disabled={!stripe || busy} className={buttonClass({ size: "lg", block: true })}>
          {busy ? <Loader2 size={16} strokeWidth={2.75} className="animate-spin" /> : null}
          Pay {amountLabel} deposit
        </button>
        <div className="text-center text-[12.5px] text-neutral-700">Payments by Stripe · you stay on this page</div>
      </div>
    </form>
  );
}
