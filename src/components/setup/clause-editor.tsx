"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/ui/choice";
import { FormError, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { saveClauseAction, } from "@/server/actions/setup";
import type { ClauseDef } from "@/server/clauses";

type Current = { variantKey: string | null; params: Record<string, number | string>; customText: string | null; omitted: boolean } | null;

export function ClauseEditor({ def, current }: { def: ClauseDef; current: Current }) {
  const [state, action] = useActionState(saveClauseAction.bind(null, def.key), undefined);
  const [mode, setMode] = useState<"variant" | "custom">(current?.customText ? "custom" : "variant");
  const initialVariant = current?.omitted ? "__omit__" : (current?.variantKey ?? def.variants[0]!.key);
  const [variant, setVariant] = useState(initialVariant);

  return (
    <form action={action} className="flex flex-col gap-4.5">
      <input type="hidden" name="mode" value={mode} />
      <div className="seg self-stretch" role="tablist">
        <label className="seg-opt"><input type="radio" name="_mode" checked={mode === "variant"} onChange={() => setMode("variant")} /><span>Pick a variant</span></label>
        <label className="seg-opt"><input type="radio" name="_mode" checked={mode === "custom"} onChange={() => setMode("custom")} /><span>Write my own</span></label>
      </div>

      {mode === "variant" ? (
        <div className="flex flex-col gap-2.5">
          {def.variants.map((v) => (
            <ChoiceCard
              key={v.key}
              name="variantKey"
              value={v.key}
              checked={variant === v.key}
              onChange={() => setVariant(v.key)}
              title={v.label}
              description={<Quote text={v.text} params={v.params ?? []} current={current} variantKey={v.key} active={variant === v.key} />}
            />
          ))}
          {def.optional ? (
            <ChoiceCard plain name="variantKey" value="__omit__" checked={variant === "__omit__"} onChange={() => setVariant("__omit__")} title={def.omitLabel ?? "Leave this clause out"} />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Textarea
            name="customText"
            defaultValue={current?.customText ?? ""}
            rows={6}
            placeholder={def.variants[0]?.text}
            required
            minLength={20}
          />
          <p className="px-1 text-[12.5px] text-neutral-700">
            Merge tags you can use: {"{{client}}"} {"{{studio}}"} {"{{date}}"} {"{{package}}"} {"{{deposit}}"} {"{{balance}}"} {"{{total}}"}
          </p>
        </div>
      )}

      <div
        className={
          mode === "custom"
            ? "rounded-md border border-accent-300 bg-accent-100 px-[18px] py-3.5 text-[13.5px] leading-[1.5] text-accent-800"
            : "rounded-md border border-accent-2-300 bg-accent-2-100 px-[18px] py-3.5 text-[13.5px] leading-[1.5] text-accent-2-800"
        }
      >
        {mode === "custom" ? (
          <>
            <span className="font-semibold">You&apos;re writing your own wording.</span> This clause is no longer one of our reviewed ones. It goes in the
            contract as typed, flagged as yours.
          </>
        ) : (
          <>Every variant here has been reviewed. Write your own and we&apos;ll flag it on the contract as your wording.</>
        )}
      </div>

      <FormError error={state?.error} />
      <div className="flex items-center gap-3">
        <Button href="/setup/contract" variant="secondary">Cancel</Button>
        <div className="flex-1" />
        <SubmitButton pendingText="Saving…">Save clause</SubmitButton>
      </div>
    </form>
  );
}

/** Clause text with its blanks rendered as small number inputs. */
function Quote({
  text,
  params,
  current,
  variantKey,
  active,
}: {
  text: string;
  params: ClauseDef["variants"][number]["params"] & {};
  current: Current;
  variantKey: string;
  active: boolean;
}) {
  const parts = text.split(/(\{\{\s*[a-z_]+\s*\}\})/gi);
  return (
    <span className="text-[13.5px] leading-[1.7] text-neutral-800">
      “
      {parts.map((p, i) => {
        const m = /^\{\{\s*([a-z_]+)\s*\}\}$/i.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        const tag = m[1]!;
        const param = params.find((x) => x.key === tag);
        if (!param) return <b key={i}>{`{${tag}}`}</b>;
        const def = current?.variantKey === variantKey ? Number(current?.params[param.key] ?? param.default) : param.default;
        return (
          <input
            key={i}
            name={`param.${variantKey}.${param.key}`}
            type="number"
            defaultValue={def}
            min={param.min}
            max={param.max}
            disabled={!active}
            aria-label={`${param.label} (${param.unit})`}
            onClick={(e) => e.stopPropagation()}
            className="mx-0.5 inline-block w-[58px] rounded-full border-[1.5px] border-neutral-400 bg-bg px-2 py-0.5 text-center font-semibold text-text tabular disabled:opacity-60"
          />
        );
      })}
      ”
    </span>
  );
}
