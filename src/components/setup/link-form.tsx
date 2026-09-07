"use client";

import { useActionState, useState } from "react";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { tenantHostLabel, tenantUrl } from "@/lib/tenant-host";
import { publishLinkAction, saveLinkAction } from "@/server/actions/setup";
import { SlugField } from "./slug-field";

export function LinkForm({
  tenant,
  form,
  rootDomain,
}: {
  tenant: { slug: string; name: string; tagline: string | null; publishedAt: string | null; stripeReady: boolean };
  form: { welcomeHeading: string; welcomeBody: string };
  rootDomain: string;
}) {
  const [state, action] = useActionState(saveLinkAction, undefined);
  const [pubState, publish] = useActionState(publishLinkAction, undefined);
  const [slug, setSlug] = useState(tenant.slug);
  const url = tenantUrl(tenant.slug, rootDomain);

  return (
    <div className="flex flex-col gap-6">
      {tenant.publishedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent-2-300 bg-accent-2-100 px-5 py-4">
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-accent-2-800">Live</div>
            <div className="text-[15.5px] font-semibold text-accent-2-900">{tenantHostLabel(tenant.slug, rootDomain)}</div>
          </div>
          <CopyLinkButton url={url} />
          <Button href={url} variant="ghost" target="_blank" rel="noreferrer">Open ↗</Button>
        </div>
      ) : null}

      <form action={action} className="flex flex-col gap-4.5">
        <SlugField value={slug} onChange={setSlug} rootDomain={rootDomain} currentSlug={tenant.slug} label="Subdomain" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Studio name" htmlFor="name"><Input id="name" name="name" defaultValue={tenant.name} required /></Field>
          <Field label="Tagline" htmlFor="tagline"><Input id="tagline" name="tagline" defaultValue={tenant.tagline ?? ""} placeholder="Portrait & wedding · Bay Area" /></Field>
        </div>
        <Field label="Welcome heading" htmlFor="welcomeHeading">
          <Input id="welcomeHeading" name="welcomeHeading" defaultValue={form.welcomeHeading} required className="input-heading" />
        </Field>
        <Field label="Welcome message" htmlFor="welcomeBody" hint="Shown on the first screen, in your words.">
          <Textarea id="welcomeBody" name="welcomeBody" defaultValue={form.welcomeBody} rows={3} required />
        </Field>
        <FormError error={state?.error} />
        <FormSuccess show={state?.ok}>Saved.</FormSuccess>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="secondary" pendingText="Saving…">Save</SubmitButton>
          <Button variant="secondary" aria-disabled disabled title="Studio plan · coming soon">Use my own domain</Button>
        </div>
      </form>

      {!tenant.publishedAt ? (
        <form action={publish} className="flex flex-col gap-3 border-t border-divider pt-5">
          <div className="text-[14.5px] text-neutral-800">
            {tenant.stripeReady ? "Everything's in place. Publish and send it to your next enquiry." : "Connect Stripe on the Deposit step before publishing — the link takes money."}
          </div>
          <FormError error={pubState?.error} />
          <div>
            <SubmitButton size="lg" pendingText="Publishing…" disabled={!tenant.stripeReady}>Publish link</SubmitButton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
