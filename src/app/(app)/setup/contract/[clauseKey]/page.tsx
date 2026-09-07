import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClauseEditor } from "@/components/setup/clause-editor";
import { withTenant } from "@/db/client";
import { CLAUSES, isClauseKey } from "@/server/clauses";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Setup · Clause" };

export default async function ClausePage({ params }: PageProps<"/setup/contract/[clauseKey]">) {
  const { clauseKey } = await params;
  if (!isClauseKey(clauseKey)) notFound();
  const studio = await requireStudio();
  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));
  if (!bundle) return null;
  const def = CLAUSES[clauseKey];
  const current = bundle.clauses.find((c) => c.clauseKey === clauseKey) ?? null;

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="kicker">Clause · {def.title}</div>
      <h1 className="mt-2 font-heading text-[29px] leading-[1.06] text-text">{def.question}</h1>
      <div className="mt-5">
        <ClauseEditor
          def={def}
          current={current ? { variantKey: current.variantKey, params: current.params, customText: current.customText, omitted: current.omitted } : null}
        />
      </div>
    </div>
  );
}
