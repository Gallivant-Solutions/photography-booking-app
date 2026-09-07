"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/ui/choice";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMoney } from "@/lib/money";
import { refundAction } from "@/server/actions/bookings";

export function RefundForm({
  bookingId,
  refundableCents,
  feeCents,
  contractNote,
  fullLabel,
}: {
  bookingId: string;
  refundableCents: number;
  feeCents: number;
  contractNote: string | null;
  fullLabel: string;
}) {
  const [state, action] = useActionState(refundAction.bind(null, bookingId), undefined);
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState((refundableCents / 100).toFixed(2));
  const amountCents = scope === "full" ? refundableCents : Math.round(Number(amount || 0) * 100);

  return (
    <form action={action} className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-2.5">
        <ChoiceCard name="scope" value="full" checked={scope === "full"} onChange={() => setScope("full")} title={fullLabel} description="Releases the date and cancels the booking." />
        <ChoiceCard name="scope" value="partial" checked={scope === "partial"} onChange={() => setScope("partial")} title="Partial" description="Keeps the booking and the date." />
      </div>
      {scope === "partial" ? (
        <Field label="Amount" htmlFor="amount" hint={`Up to ${formatMoney(refundableCents, { cents: true })}`}>
          <div className="flex items-center gap-3">
            <span className="font-heading text-[19px] text-text">$</span>
            <Input id="amount" name="amount" type="number" step="0.01" min="0.01" max={(refundableCents / 100).toFixed(2)} value={amount} onChange={(e) => setAmount(e.target.value)} className="max-w-[160px] tabular" />
          </div>
        </Field>
      ) : null}
      <Field label="Reason — appears on their receipt" htmlFor="reason">
        <Input id="reason" name="reason" required minLength={3} placeholder="Date released at the client's request" />
      </Field>
      {contractNote ? (
        <div className="rounded-lg border border-accent-300 bg-accent-100 px-[19px] py-[17px]">
          <div className="text-[14px] font-semibold text-accent-800">{contractNote}</div>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-accent-800">You can refund it anyway. We&apos;ll note the override on the ledger so the record matches the money.</p>
        </div>
      ) : null}
      {feeCents > 0 ? <p className="text-[12.5px] text-neutral-700">Stripe&apos;s {formatMoney(feeCents, { cents: true })} fee is not returned.</p> : null}
      <FormError error={state?.error} />
      <div className="flex gap-2.5">
        <Button href={`/dashboard/bookings/${bookingId}`} variant="secondary">Cancel</Button>
        <SubmitButton className="flex-1" pendingText="Refunding…" disabled={amountCents <= 0 || amountCents > refundableCents}>
          Refund {formatMoney(Math.max(0, amountCents), { cents: true })}
        </SubmitButton>
      </div>
    </form>
  );
}
