import type { Metadata } from "next";
import { Check } from "lucide-react";
import { DepositForm } from "@/components/setup/deposit-form";
import { StepFooter, StepHeading } from "@/components/setup/step-footer";
import { SubmitButton } from "@/components/ui/submit-button";
import { withTenant } from "@/db/client";
import { connectStripeAction, refreshStripeStatusAction } from "@/server/actions/setup";
import { loadDefaultForm } from "@/server/intake";
import { fetchAccountStatus } from "@/server/stripe";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Setup · Deposit" };

export default async function DepositPage({ searchParams }: PageProps<"/setup/deposit">) {
  const studio = await requireStudio();
  const sp = await searchParams;
  // Coming back from Stripe: refresh once so the badge is right immediately.
  if (sp.stripe === "return" && studio.tenant.stripeAccountId) await refreshStripeStatusAction();

  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));
  if (!bundle) return null;
  const t = studio.tenant;
  const status = t.stripeAccountId ? await fetchAccountStatus(t.stripeAccountId).catch(() => null) : null;
  const connected = Boolean(status?.chargesEnabled || t.stripeChargesEnabled);

  return (
    <>
      <div>
        <div className="kicker">Setup 3 · Deposit</div>
        <StepHeading title="Where the money lands" />
      </div>

      {connected ? (
        <div className="flex items-center gap-3.5 rounded-lg border border-accent-2-300 bg-accent-2-100 px-5 py-[19px]">
          <span className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-accent-2-600 text-bg"><Check size={18} strokeWidth={2.75} /></span>
          <div className="flex-1">
            <div className="text-[15.5px] font-semibold text-accent-2-900">Stripe connected</div>
            <div className="mt-0.5 text-[13.5px] text-accent-2-800">
              {status?.bankLast4 ? `Payouts to Bank ••${status.bankLast4}${status.payoutSchedule ? `, ${status.payoutSchedule}` : ""}` : "Payouts go to your bank"}
              {status && !status.payoutsEnabled ? " · payouts pending verification" : ""}
            </div>
          </div>
          <form action={connectStripeAction}>
            <SubmitButton variant="ghost" size="sm" pendingText="Opening…">Manage</SubmitButton>
          </form>
        </div>
      ) : (
        <div className="rounded-lg border border-accent-300 bg-accent-100 px-5 py-[19px]">
          <div className="text-[15.5px] font-semibold text-accent-900">Connect Stripe · in-page card</div>
          <p className="mt-1 max-w-[440px] text-[13.5px] leading-[1.55] text-accent-800">
            Clients pay without leaving your link. Confirmed instantly, payouts to your bank. Stripe verifies your identity once, before the link can go live.
          </p>
          <form action={connectStripeAction} className="mt-3.5">
            <SubmitButton pendingText="Opening Stripe…">{t.stripeAccountId ? "Continue Stripe setup ↗" : "Continue to Stripe ↗"}</SubmitButton>
          </form>
        </div>
      )}

      <DepositForm
        depositMode={bundle.form.depositMode}
        depositValue={bundle.form.depositValue}
        packages={bundle.packages.filter((p) => p.active).map((p) => ({ name: p.name, priceCents: p.priceCents }))}
      />

      <StepFooter back={{ href: "/setup/contract", label: "Back" }} next={{ href: "/setup/link", label: "Next · Your link" }} />
    </>
  );
}
