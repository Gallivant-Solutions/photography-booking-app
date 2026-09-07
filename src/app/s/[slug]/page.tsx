import { PhoneShell, } from "@/components/intake/phone-shell";
import { Avatar, Blob, StepBadge } from "@/components/ui/bits";
import { SubmitButton } from "@/components/ui/submit-button";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { tenantHostLabel } from "@/lib/tenant-host";
import { startBookingAction } from "@/server/actions/intake";
import { loadDefaultForm } from "@/server/intake";
import { requireTenantBySlug } from "@/server/tenant";

export default async function WelcomePage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const tenant = await requireTenantBySlug(slug);
  const bundle = await withTenant(tenant.id, (tx) => loadDefaultForm(tx, tenant.id));
  const host = tenantHostLabel(tenant.slug, publicEnv.NEXT_PUBLIC_ROOT_DOMAIN);
  const live = Boolean(tenant.publishedAt);

  return (
    <PhoneShell host={host}>
      <Blob className="bg-accent-200 opacity-55" style={{ top: -90, right: -110, width: 300, height: 300 }} />
      <div className="relative z-[1] flex flex-1 flex-col gap-6">
        <div className="flex items-center gap-3">
          <Avatar name={tenant.name} size={44} />
          <div>
            <div className="text-[15px] font-semibold text-text">{tenant.name}</div>
            {tenant.tagline ? <div className="text-[12.5px] text-neutral-700">{tenant.tagline}</div> : null}
          </div>
        </div>
        <h1 className="font-heading text-[40px] leading-[1.02] tracking-[-0.5px] text-text sm:text-[44px]">{bundle?.form.welcomeHeading ?? "Let's get your shoot on the books"}</h1>
        <p className="text-[16.5px] leading-[1.55] text-neutral-700">{bundle?.form.welcomeBody}</p>
        <ol className="flex flex-col gap-3.5 border-t border-divider pt-5">
          {["Tell me about the shoot", "Sign the agreement", "Pay the deposit"].map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[14.5px] text-neutral-800">
              <StepBadge n={i + 1} className="size-7" />
              {s}
            </li>
          ))}
        </ol>
        <div className="flex-1" />
        <form action={startBookingAction.bind(null, tenant.slug)} className="flex flex-col gap-3 pb-1.5">
          {!live ? (
            <div className="rounded-md border border-accent-300 bg-accent-100 px-4 py-2.5 text-center text-[12.5px] text-accent-800">
              Preview — this link isn&apos;t published yet
            </div>
          ) : null}
          <SubmitButton size="lg" block pendingText="One moment…" disabled={!bundle}>Start</SubmitButton>
          <div className="text-center text-[12.5px] text-neutral-700">Your answers save as you go</div>
        </form>
      </div>
    </PhoneShell>
  );
}
