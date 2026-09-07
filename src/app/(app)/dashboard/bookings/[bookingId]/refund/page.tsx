import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { RefundForm } from "@/components/dashboard/refund-form";
import { Kicker, Panel } from "@/components/ui/bits";
import { withTenant } from "@/db/client";
import { formatMoney } from "@/lib/money";
import { getBooking } from "@/server/bookings";
import { summarizeClause } from "@/server/clauses";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Refund" };

export default async function RefundPage({ params }: PageProps<"/dashboard/bookings/[bookingId]/refund">) {
  const studio = await requireStudio();
  const { bookingId } = await params;
  const data = await withTenant(studio.tenant.id, async (tx) => {
    const found = await getBooking(tx, bookingId);
    if (!found) return null;
    const bundle = await loadDefaultForm(tx, studio.tenant.id);
    return { ...found, bundle };
  });
  if (!data) notFound();
  const { booking: b, money, bundle } = data;
  const refundable = money.collectedCents - money.refundedCents;
  if (refundable <= 0) redirect(`/dashboard/bookings/${b.id}`);

  const depositClause = bundle?.clauses.find((c) => c.clauseKey === "deposit");
  const clauseSummary = depositClause ? summarizeClause("deposit", depositClause.variantKey, depositClause.params, depositClause.customText) : null;
  const nonRefundable = depositClause?.variantKey === "nonrefundable";

  return (
    <AppShell tenant={studio.tenant} active="bookings">
      <div className="mx-auto w-full max-w-[460px]">
        <Panel className="p-7 sm:p-[30px]">
          <Kicker>Refund · {b.clientName}</Kicker>
          <h1 className="mt-2 font-heading text-[30px] leading-[1.06] text-text">How much are you sending back?</h1>
          <div className="mt-5">
            <RefundForm
              bookingId={b.id}
              refundableCents={refundable}
              feeCents={money.feeCents}
              contractNote={nonRefundable ? `Their contract says the retainer is non-refundable` : clauseSummary ? `Their contract: ${clauseSummary}` : null}
              fullLabel={`Full — ${formatMoney(refundable, { cents: true })}`}
            />
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
