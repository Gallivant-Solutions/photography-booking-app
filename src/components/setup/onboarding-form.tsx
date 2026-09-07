"use client";

import { useActionState, useState } from "react";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { slugify } from "@/lib/utils";
import { createStudioAction } from "@/server/actions/onboarding";
import { SlugField } from "./slug-field";

export function OnboardingForm({ suggestedName, rootDomain }: { suggestedName: string; rootDomain: string }) {
  const [state, action] = useActionState(createStudioAction, undefined);
  const [name, setName] = useState(suggestedName);
  const [slug, setSlug] = useState(slugify(suggestedName));
  const [touched, setTouched] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Studio name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          value={name}
          autoFocus
          placeholder="Marin & Co"
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Tagline" htmlFor="tagline" hint="Shown under your name on the first screen. Optional.">
        <Input id="tagline" name="tagline" placeholder="Portrait & wedding · Bay Area" />
      </Field>
      <SlugField
        value={slug}
        rootDomain={rootDomain}
        onChange={(v) => {
          setTouched(true);
          setSlug(v);
        }}
      />
      <FormError error={state?.error} />
      <SubmitButton size="lg" pendingText="Setting up…">Create my studio</SubmitButton>
    </form>
  );
}
