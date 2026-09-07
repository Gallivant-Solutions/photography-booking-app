import type { Metadata } from "next";
import { LinkForm } from "@/components/setup/link-form";
import { StepFooter } from "@/components/setup/step-footer";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Setup · Your link" };

export default async function LinkPage() {
  const studio = await requireStudio();
  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));
  if (!bundle) return null;

  return (
    <>
      <div>
        <div className="kicker">Setup 4 · Your link</div>
        <h1 className="mt-2 font-heading text-[30px] leading-[1.06] text-text">{studio.tenant.publishedAt ? "Your link is live" : "Where clients land"}</h1>
        <p className="mt-2 max-w-[480px] text-[15px] leading-[1.55] text-neutral-700">
          Two branding controls, on purpose: your subdomain and your welcome message. The rest stays out of the way.
        </p>
      </div>
      <LinkForm
        tenant={{ slug: studio.tenant.slug, name: studio.tenant.name, tagline: studio.tenant.tagline, publishedAt: studio.tenant.publishedAt?.toISOString() ?? null, stripeReady: studio.tenant.stripeChargesEnabled }}
        form={{ welcomeHeading: bundle.form.welcomeHeading, welcomeBody: bundle.form.welcomeBody }}
        rootDomain={publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}
      />
      <StepFooter previewHref={`/s/${studio.tenant.slug}`} back={{ href: "/setup/deposit", label: "Back" }} />
    </>
  );
}
