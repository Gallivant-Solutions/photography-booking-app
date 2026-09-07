"use client";

import { useActionState, useState } from "react";
import { FormError, FormSuccess } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { computeDepositCents, formatMoney } from "@/lib/money";
import { saveDepositAction } from "@/server/actions/setup";

export function DepositForm({
  depositMode,
  depositValue,
  packages,
}: {
  depositMode: "percent" | "flat";
  depositValue: number;
  packages: Array<{ name: string; priceCents: number }>;
}) {
  const [state, action] = useActionState(saveDepositAction, undefined);
  const [mode, setMode] = useState(depositMode);
  const [percent, setPercent] = useState(depositMode === "percent" ? depositValue : 25);
  const [flat, setFlat] = useState(depositMode === "flat" ? depositValue / 100 : 250);
  const value = mode === "percent" ? percent : Math.round(flat * 100);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-neutral-700">Deposit amount</div>
      <div className="seg self-stretch sm:self-start sm:min-w-[320px]" role="radiogroup">
        <label className="seg-opt"><input type="radio" name="depositMode" value="percent" checked={mode === "percent"} onChange={() => setMode("percent")} /><span>Percentage</span></label>
        <label className="seg-opt"><input type="radio" name="depositMode" value="flat" checked={mode === "flat"} onChange={() => setMode("flat")} /><span>Flat fee</span></label>
      </div>
      <div className="flex items-center gap-3.5">
        {mode === "percent" ? (
          <label className="flex items-center rounded-full border-[1.5px] border-neutral-400 bg-neutral-100 px-5 py-3 font-heading text-[22px] text-text focus-within:border-accent">
            <input name="percent" type="number" min={1} max={100} value={percent} onChange={(e) => setPercent(Number(e.target.value))} className="w-[52px] bg-transparent text-right outline-none tabular" aria-label="Deposit percentage" />
            <span>%</span>
          </label>
        ) : (
          <label className="flex items-center rounded-full border-[1.5px] border-neutral-400 bg-neutral-100 px-5 py-3 font-heading text-[22px] text-text focus-within:border-accent">
            <span>$</span>
            <input name="flat" type="number" min={1} step={1} value={flat} onChange={(e) => setFlat(Number(e.target.value))} className="w-[88px] bg-transparent outline-none tabular" aria-label="Flat deposit" />
          </label>
        )}
        <div className="text-[14px] leading-[1.5] text-neutral-800">
          {mode === "percent" ? "of the package price," : "for every package,"}
          <br />
          collected before the date is held
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-[18px] py-[15px]">
        <div className="kicker">So your clients see</div>
        {packages.map((p) => (
          <div key={p.name} className="flex justify-between text-[14.5px] text-neutral-800">
            <span>{p.name} · {formatMoney(p.priceCents)}</span>
            <span className="font-semibold text-text">{formatMoney(computeDepositCents(p.priceCents, mode, value))} deposit</span>
          </div>
        ))}
      </div>

      <FormError error={state?.error} />
      <FormSuccess show={state?.ok}>Saved. New bookings use this from now on; signed contracts keep theirs.</FormSuccess>
      <div>
        <SubmitButton size="sm" pendingText="Saving…">Save deposit</SubmitButton>
      </div>
    </form>
  );
}
