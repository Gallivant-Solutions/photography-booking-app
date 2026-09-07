"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveStepAction } from "@/server/actions/intake";

export function StepForm({
  slug,
  bookingId,
  step,
  nextLabel,
  skippable,
  backHref,
  children,
}: {
  slug: string;
  bookingId: string;
  step: number;
  nextLabel: string;
  skippable?: boolean;
  backHref: string;
  children: ReactNode;
}) {
  const [state, action] = useActionState(saveStepAction.bind(null, { slug, bookingId, step }), undefined);
  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      {children}
      <FormError error={state?.error} />
      <div className="flex-1" />
      <div className="flex gap-2.5 pt-2">
        <Button href={backHref} variant="secondary" size="lg" className="shadow-none">{step === 1 ? "Back" : "Back"}</Button>
        <SubmitButton size="lg" className="flex-1" pendingText="Saving…" formNoValidate={skippable}>
          {nextLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
