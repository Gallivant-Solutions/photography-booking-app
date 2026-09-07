import { notFound, redirect } from "next/navigation";
import { PhoneShell, ScreenTitle, SectionLabel, StepHeader } from "@/components/intake/phone-shell";
import { StepForm } from "@/components/intake/step-form";
import { ChipRadio, ChoiceCard } from "@/components/ui/choice";
import { Field, Input, Textarea } from "@/components/ui/field";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { computeDepositCents, formatMoney } from "@/lib/money";
import { tenantHostLabel } from "@/lib/tenant-host";
import { clientBase, paths } from "@/server/client-paths";
import { getBookingForClient, loadDefaultForm } from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";

export default async function QuestionPage({ params }: PageProps<"/s/[slug]/b/[bookingId]/q/[step]">) {
  const { slug, bookingId, step: stepStr } = await params;
  const step = Number(stepStr);
  const tenant = await requireTenantBySlug(slug);
  const base = await clientBase(slug);
  const data = await withTenant(tenant.id, async (tx) => ({
    bundle: await loadDefaultForm(tx, tenant.id),
    booking: await getBookingForClient(tx, bookingId),
  }));
  if (!data.bundle || !data.booking) notFound();
  const { bundle, booking } = data;
  if (booking.signedAt) redirect(paths.deposit(base, booking.id));
  const total = bundle.questions.length;
  if (!Number.isInteger(step) || step < 1 || step > total) redirect(paths.question(base, booking.id, 1));
  const q = bundle.questions[step - 1]!;
  const host = tenantHostLabel(tenant.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  const backHref = step === 1 ? paths.welcome(base) : paths.question(base, booking.id, step - 1);
  const isLast = step === total;

  return (
    <PhoneShell host={host}>
      <div className="flex flex-1 flex-col gap-5">
        <StepHeader backHref={backHref} progress={(step / total) * 100} label={`${step} of ${total}`} />
        <ScreenTitle>{q.title}</ScreenTitle>
        <StepForm slug={tenant.slug} bookingId={booking.id} step={step} nextLabel={isLast ? "Review agreement" : "Next"} skippable={!q.required && q.kind === "notes"} backHref={backHref}>
          {q.kind === "contact" ? (
            <>
              <Field htmlFor="clientName" label="Your name"><Input id="clientName" name="clientName" autoComplete="name" required defaultValue={booking.clientName ?? ""} placeholder="Jordan Lee" autoFocus /></Field>
              <Field htmlFor="clientEmail" label="Email"><Input id="clientEmail" name="clientEmail" type="email" autoComplete="email" inputMode="email" required defaultValue={booking.clientEmail ?? ""} placeholder="you@example.com" /></Field>
              <Field htmlFor="clientPhone" label="Phone" hint="Optional — for the day itself"><Input id="clientPhone" name="clientPhone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={booking.clientPhone ?? ""} placeholder="+1 415 555 0142" /></Field>
            </>
          ) : q.kind === "shoot" ? (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Shoot type">
                {bundle.form.shootTypes.map((t, i) => (
                  <ChipRadio key={t} name="shootType" value={t} label={t} required defaultChecked={booking.shootType ? booking.shootType === t : i === 0} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-col gap-2.5">
                <SectionLabel>Choose a package</SectionLabel>
                {bundle.packages.filter((p) => p.active).map((p) => {
                  const dep = computeDepositCents(p.priceCents, bundle.form.depositMode, bundle.form.depositValue);
                  return (
                    <ChoiceCard key={p.id} name="packageId" value={p.id} required defaultChecked={booking.packageId === p.id} title={p.name} right={formatMoney(p.priceCents)} description={p.description}>
                      <span className="mt-2 inline-block self-start rounded-full bg-accent-2-200 px-[11px] py-1 text-[12px] font-semibold text-accent-2-800">{formatMoney(dep)} deposit</span>
                    </ChoiceCard>
                  );
                })}
              </div>
            </>
          ) : q.kind === "schedule" ? (
            <>
              <Field htmlFor="eventDate" label="Date"><Input id="eventDate" name="eventDate" type="date" defaultValue={booking.eventDate ?? ""} /></Field>
              <div className="flex flex-col gap-2">
                <SectionLabel>Date not fixed?</SectionLabel>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  {[
                    ["fixed", "It's fixed"],
                    ["flexible", "Flexible"],
                    ["month", "A month"],
                    ["season", "A season"],
                  ].map(([v, l], i) => (
                    <ChipRadio key={v} name="dateFlexibility" value={v} label={l} className="chip-sm" defaultChecked={booking.dateFlexibility ? booking.dateFlexibility === v : i === 0} />
                  ))}
                </div>
              </div>
              <Field htmlFor="location" label="Location" hint="A place, a venue, or 'not sure yet'"><Input id="location" name="location" defaultValue={booking.location ?? ""} placeholder="Point Reyes" /></Field>
            </>
          ) : q.kind === "notes" ? (
            <>
              <Textarea name="notes" rows={5} defaultValue={booking.notes ?? ""} placeholder={q.config.placeholder ?? "Must-have shots, people, mood, access"} autoFocus />
              <p className="px-1 text-[12.5px] text-neutral-700">{q.subtitle?.includes("optional") ? "Optional. Skip it if you'd rather talk." : q.subtitle}</p>
            </>
          ) : (
            <>
              {q.subtitle ? <p className="-mt-2 text-[14.5px] text-neutral-700">{q.subtitle}</p> : null}
              <Textarea name="answer" rows={5} required={q.required} defaultValue={String(booking.answers[q.id] ?? "")} autoFocus />
            </>
          )}
        </StepForm>
      </div>
    </PhoneShell>
  );
}
