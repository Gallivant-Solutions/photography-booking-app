import { notFound, redirect } from "next/navigation";
import { DepositCheckout } from "@/components/intake/deposit-checkout";
import { PhoneShell, ScreenTitle, StepHeader } from "@/components/intake/phone-shell";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { formatDate, formatMoney } from "@/lib/money";
import { tenantHostLabel } from "@/lib/tenant-host";
import { clientBase, paths } from "@/server/client-paths";
import { getBookingForClient } from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";

export default async function DepositPage({ params }: PageProps<"/s/[slug]/b/[bookingId]/deposit">) {
  const { slug, bookingId } = await params;
  const tenant = await requireTenantBySlug(slug);
  const base = await clientBase(slug);
  const booking = await withTenant(tenant.id, (tx) => getBookingForClient(tx, bookingId));
  if (!booking) notFound();
  if (!booking.signedAt) redirect(paths.sign(base, booking.id));
  if (booking.status === "confirmed") redirect(paths.done(base, booking.id));

  const host = tenantHostLabel(tenant.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  const total = booking.packagePriceCents ?? 0;
  const deposit = booking.depositCents ?? 0;
  const ready = Boolean(tenant.stripeAccountId && tenant.stripeChargesEnabled);

  return (
    <PhoneShell host={`🔒 ${host}`}>
      <div className="flex flex-1 flex-col gap-5">
        <StepHeader progress={100} label="Deposit" />
        <ScreenTitle>Hold your date</ScreenTitle>

        <div className="rounded-lg border border-accent-2-300 bg-accent-2-100 p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[14.5px] text-accent-2-800">Due now</span>
            <span className="font-heading text-[38px] leading-none text-accent-2-900">{formatMoney(deposit)}</span>
          </div>
          <div className="my-4 h-px bg-accent-2-300" />
          <div className="flex justify-between text-[13.5px] text-accent-2-800">
            <span>{[booking.packageName, booking.eventDate ? formatDate(booking.eventDate) : null].filter(Boolean).join(" · ")}</span>
            <span>{formatMoney(total)}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-[13.5px] text-accent-2-800">
            <span>Balance on the day</span>
            <span>{formatMoney(Math.max(0, total - deposit))}</span>
          </div>
        </div>

        {booking.lastPaymentError ? (
          <div className="rounded-md border border-accent-300 bg-accent-100 px-4 py-3 text-[13.5px] text-accent-800">
            {booking.lastPaymentError} Try another card below.
          </div>
        ) : null}

        {ready ? (
          <DepositCheckout slug={tenant.slug} bookingId={booking.id} amountLabel={formatMoney(deposit)} returnUrl={paths.done(base, booking.id)} />
        ) : (
          <div className="inset p-5 text-[14px] leading-[1.55] text-neutral-800">
            {tenant.name} hasn&apos;t finished connecting payments yet, so the deposit can&apos;t be taken here today. Your answers and signature are saved — they&apos;ll be in touch to hold the date.
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
