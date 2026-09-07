import { notFound, redirect } from "next/navigation";
import { PhoneShell, ScreenTitle, SectionLabel, StepHeader } from "@/components/intake/phone-shell";
import { SignForm } from "@/components/intake/sign-form";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { formatDate, formatMoney } from "@/lib/money";
import { tenantHostLabel } from "@/lib/tenant-host";
import { clientBase, paths } from "@/server/client-paths";
import { renderContract } from "@/server/contracts";
import { answersComplete, getBookingForClient, loadDefaultForm } from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";

export default async function SignPage({ params }: PageProps<"/s/[slug]/b/[bookingId]/sign">) {
  const { slug, bookingId } = await params;
  const tenant = await requireTenantBySlug(slug);
  const base = await clientBase(slug);
  const data = await withTenant(tenant.id, async (tx) => ({
    bundle: await loadDefaultForm(tx, tenant.id),
    booking: await getBookingForClient(tx, bookingId),
  }));
  if (!data.bundle || !data.booking) notFound();
  const { bundle, booking } = data;
  if (booking.signedAt) redirect(paths.deposit(base, booking.id));
  if (!answersComplete(bundle, booking)) redirect(paths.question(base, booking.id, Math.max(1, Math.min(booking.currentStep, bundle.questions.length))));

  const contract = renderContract(tenant, bundle.form, bundle.clauses, booking);
  const host = tenantHostLabel(tenant.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);

  return (
    <PhoneShell host={host}>
      <div className="flex flex-1 flex-col gap-4">
        <StepHeader backHref={paths.question(base, booking.id, bundle.questions.length)} progress={100} label="Sign" />
        <ScreenTitle>Your agreement</ScreenTitle>
        <p className="text-[14.5px] text-neutral-700">
          {[booking.packageName, booking.eventDate ? formatDate(booking.eventDate, "long") : null, booking.packagePriceCents ? formatMoney(booking.packagePriceCents) : null].filter(Boolean).join(" · ")}
        </p>

        <div className="inset relative max-h-[40vh] min-h-[220px] overflow-y-auto p-5 sm:max-h-[300px]" id="agreement" tabIndex={0}>
          <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.08em] text-neutral-700">{contract.title}</div>
          <p className="text-[13.5px] leading-[1.65] text-neutral-800">{contract.intro}</p>
          {contract.clauses.map((c) => (
            <p key={c.key} className="mt-2.5 text-[13.5px] leading-[1.65] text-neutral-800">
              <span className="font-semibold text-text">{c.title}. </span>
              {c.text}
              {c.isCustom ? <span className="ml-1 text-[11px] text-accent-700">(photographer&apos;s wording)</span> : null}
            </p>
          ))}
          <p className="mt-3 text-[12.5px] text-neutral-700">{contract.signatureLine}</p>
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Sign by typing your full name</SectionLabel>
          <SignForm slug={tenant.slug} bookingId={booking.id} expectedName={booking.clientName ?? ""} />
        </div>
      </div>
    </PhoneShell>
  );
}
