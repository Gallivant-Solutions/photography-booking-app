"use client";

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { StepBadge } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Tag } from "@/components/ui/tag";
import type { Package, Question } from "@/db/schema";
import { computeDepositCents, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  archivePackageAction,
  deleteQuestionAction,
  moveQuestionAction,
  savePackageAction,
  saveQuestionAction,
  saveShootTypesAction,
} from "@/server/actions/setup";

// ── Questions ────────────────────────────────────────────────────────────────
export function QuestionsEditor({ questions }: { questions: Question[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-2.5">
      {questions.map((q, i) =>
        editing === q.id ? (
          <QuestionForm key={q.id} question={q} onDone={() => setEditing(null)} />
        ) : (
          <div
            key={q.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-4 sm:gap-4 sm:px-5",
              q.kind === "shoot" ? "border-2 border-accent bg-accent-100 shadow-sm" : "border-neutral-300 bg-neutral-100",
            )}
          >
            <span className="hidden text-neutral-600 sm:block" aria-hidden><GripVertical size={16} strokeWidth={2.75} /></span>
            <StepBadge n={i + 1} active={q.kind === "shoot"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15.5px] font-semibold text-text">{q.title}</div>
              <div className="truncate text-[13px] text-neutral-700">
                {q.subtitle ?? (q.kind === "custom" ? "Long answer" : "")}
                {!q.required ? " · optional" : ""}
              </div>
            </div>
            {q.kind === "shoot" ? <Tag tone="accent-2" className="hidden sm:inline-flex">Sets the deposit</Tag> : null}
            <div className="flex items-center gap-0.5">
              <IconBtn label="Move up" disabled={i === 0} onClick={() => start(() => moveQuestionAction(q.id, "up"))}><ArrowUp size={15} strokeWidth={2.75} /></IconBtn>
              <IconBtn label="Move down" disabled={i === questions.length - 1} onClick={() => start(() => moveQuestionAction(q.id, "down"))}><ArrowDown size={15} strokeWidth={2.75} /></IconBtn>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(q.id)}>Edit</button>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <QuestionForm onDone={() => setEditing(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-neutral-400 px-5 py-4 text-[14.5px] font-semibold text-neutral-700 hover:border-neutral-600 hover:text-text"
        >
          <Plus size={16} strokeWidth={2.75} /> Add a question
        </button>
      )}
    </div>
  );
}

function QuestionForm({ question, onDone }: { question?: Question; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof saveQuestionAction>>, fd: FormData) => {
    const r = await saveQuestionAction(prev, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  const [, start] = useTransition();
  const builtIn = question && question.kind !== "custom";

  return (
    <form action={action} className="flex flex-col gap-3.5 rounded-lg border-2 border-accent bg-accent-100 p-5">
      <input type="hidden" name="id" value={question?.id ?? ""} />
      <Field label="Question" htmlFor="q-title">
        <Input id="q-title" name="title" defaultValue={question?.title} required autoFocus placeholder="Anything I should know?" />
      </Field>
      <Field label="Hint under the question" htmlFor="q-sub" hint={builtIn ? "The inputs for this step are fixed; only the wording changes." : "Custom questions get a long-answer box."}>
        <Input id="q-sub" name="subtitle" defaultValue={question?.subtitle ?? ""} placeholder="Must-have shots, people, mood, access" />
      </Field>
      <label className="flex items-center gap-2.5 text-[14px] text-neutral-800">
        <input type="checkbox" name="required" defaultChecked={question ? question.required : false} disabled={builtIn && question?.kind !== "notes"} className="size-4 accent-accent" />
        Required
      </label>
      <FormError error={state?.error} />
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
        <div className="flex-1" />
        {question && !builtIn ? (
          <Button variant="ghost" size="sm" onClick={() => start(async () => { await deleteQuestionAction(question.id); onDone(); })}>
            <Trash2 size={15} strokeWidth={2.75} /> Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function IconBtn({ label, children, ...rest }: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className="rounded-full p-1.5 text-neutral-700 hover:bg-neutral-300/70 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent">
      {children}
    </button>
  );
}

// ── Packages ─────────────────────────────────────────────────────────────────
export function PackagesEditor({ packages, depositMode, depositValue }: { packages: Package[]; depositMode: "percent" | "flat"; depositValue: number }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {packages.map((p) =>
        editing === p.id ? (
          <PackageForm key={p.id} pkg={p} onDone={() => setEditing(null)} />
        ) : (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[15px] font-semibold text-text">{p.name}</span>
                <span className="font-heading text-[18px] text-text">{formatMoney(p.priceCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px] text-neutral-700">
                <span className="truncate">{p.description}</span>
                <span className="flex-none">{formatMoney(computeDepositCents(p.priceCents, depositMode, depositValue))} deposit</span>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p.id)}>Edit</button>
            {packages.length > 1 ? (
              <IconBtn label="Remove package" onClick={() => start(() => archivePackageAction(p.id))}><X size={15} strokeWidth={2.75} /></IconBtn>
            ) : null}
          </div>
        ),
      )}
      {editing === "new" ? (
        <PackageForm onDone={() => setEditing(null)} />
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="rounded-lg border-[1.5px] border-dashed border-neutral-400 px-4 py-3 text-[14px] font-semibold text-neutral-700 hover:border-neutral-600 hover:text-text">
          + Add a package
        </button>
      )}
    </div>
  );
}

function PackageForm({ pkg, onDone }: { pkg?: Package; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof savePackageAction>>, fd: FormData) => {
    const r = await savePackageAction(prev, fd);
    if (r?.ok) onDone();
    return r;
  }, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border-2 border-accent bg-accent-100 p-4">
      <input type="hidden" name="id" value={pkg?.id ?? ""} />
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Name" htmlFor="p-name"><Input id="p-name" name="name" defaultValue={pkg?.name} required autoFocus placeholder="Full day" /></Field>
        <Field label="Price (USD)" htmlFor="p-price"><Input id="p-price" name="price" type="number" min="0" step="1" defaultValue={pkg ? pkg.priceCents / 100 : ""} required className="tabular" /></Field>
      </div>
      <Field label="What's included" htmlFor="p-desc"><Input id="p-desc" name="description" defaultValue={pkg?.description ?? ""} placeholder="Eight hours · 150 edited images" /></Field>
      <FormError error={state?.error} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Shoot types ──────────────────────────────────────────────────────────────
export function ShootTypesEditor({ shootTypes }: { shootTypes: string[] }) {
  const [types, setTypes] = useState(shootTypes);
  const [draft, setDraft] = useState("");
  const [state, action] = useActionState(saveShootTypesAction, undefined);
  const dirty = types.join(",") !== shootTypes.join(",");

  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-neutral-100 p-4">
      <input type="hidden" name="shootTypes" value={types.join(",")} />
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <span key={t} className="chip chip-sm gap-1.5 pr-2.5">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => setTypes(types.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-neutral-300"><X size={13} strokeWidth={2.75} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a type, e.g. Elopement"
          className="min-h-[40px] py-2 text-[14px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draft.trim();
              if (v && !types.includes(v)) setTypes([...types, v]);
              setDraft("");
            }
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => { const v = draft.trim(); if (v && !types.includes(v)) setTypes([...types, v]); setDraft(""); }}>Add</Button>
      </div>
      <FormError error={state?.error} />
      {dirty ? <SubmitButton size="sm" pendingText="Saving…">Save shoot types</SubmitButton> : null}
    </form>
  );
}
