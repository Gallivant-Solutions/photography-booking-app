"use client";

import { useActionState } from "react";
import { FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { signAction } from "@/server/actions/intake";

export function SignForm({ slug, bookingId, expectedName }: { slug: string; bookingId: string; expectedName: string }) {
  const [state, action] = useActionState(signAction.bind(null, { slug, bookingId }), undefined);
  const now = new Date();
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <Input name="signerName" required minLength={2} autoComplete="name" placeholder={expectedName || "Your full name"} className="input-heading" aria-label="Type your full name to sign" />
      <div className="px-1 text-[12px] text-neutral-700">
        Signing on {now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · a timestamped PDF goes to you both
      </div>
      <label className="flex items-start gap-2.5 px-1 text-[13.5px] leading-[1.45] text-neutral-800">
        <input type="checkbox" name="agree" required className="mt-0.5 size-4 accent-accent" />
        I&apos;ve read the agreement and I agree to these terms
      </label>
      <FormError error={state?.error} />
      <div className="flex-1" />
      <SubmitButton size="lg" block pendingText="Signing…">Sign &amp; continue</SubmitButton>
    </form>
  );
}
