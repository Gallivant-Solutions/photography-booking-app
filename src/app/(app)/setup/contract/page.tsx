import type { Metadata } from "next";
import Link from "next/link";
import { StepFooter } from "@/components/setup/step-footer";
import { Tag } from "@/components/ui/tag";
import { withTenant } from "@/db/client";
import { CLAUSE_KEYS, CLAUSES, summarizeClause } from "@/server/clauses";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Setup · Contract" };

export default async function ContractPage() {
  const studio = await requireStudio();
  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));
  if (!bundle) return null;
  const byKey = new Map(bundle.clauses.map((c) => [c.clauseKey, c]));
  const active = CLAUSE_KEYS.filter((k) => !byKey.get(k)?.omitted).length;

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Tag tone="accent-2">Written for you</Tag>
          <span className="text-[13px] text-neutral-700">From your answers · {active} clauses</span>
        </div>
        <h1 className="mt-3 font-heading text-[30px] leading-[1.06] text-text">Your contract is ready</h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-neutral-700">Read it once. Change any clause that isn&apos;t how you actually work.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {CLAUSE_KEYS.map((key) => {
          const def = CLAUSES[key];
          const c = byKey.get(key);
          const custom = Boolean(c?.customText);
          const omitted = Boolean(c?.omitted);
          return (
            <Link
              key={key}
              href={`/setup/contract/${key}`}
              className={`flex items-center gap-4 rounded-lg border px-5 py-4 text-text hover:text-text ${
                custom ? "border-2 border-accent bg-accent-100 shadow-sm" : "border-neutral-300 bg-neutral-100 hover:border-neutral-500"
              } ${omitted ? "opacity-60" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className={`kicker ${custom ? "text-accent-800" : ""}`}>{def.title}</span>
                  {custom ? <Tag tone="accent" className="px-2.5 py-[3px] text-[11.5px]">Your wording</Tag> : null}
                  {omitted ? <Tag tone="neutral" className="px-2.5 py-[3px] text-[11.5px]">Left out</Tag> : null}
                </div>
                <div className="mt-1 truncate text-[15px] text-text">
                  {omitted ? "Not in the contract" : c ? summarizeClause(key, c.variantKey, c.params, c.customText) : "Not set"}
                </div>
              </div>
              <span className="text-[13.5px] font-semibold text-accent-700">Change</span>
            </Link>
          );
        })}
        <div className="rounded-lg border-[1.5px] border-dashed border-neutral-400 px-5 py-[15px] text-center text-[14.5px] font-semibold text-neutral-700">
          Add a clause · travel, overtime, model release — coming soon
        </div>
      </div>

      <StepFooter previewHref={`/s/${studio.tenant.slug}`} back={{ href: "/setup/questions", label: "Back" }} next={{ href: "/setup/deposit", label: "Looks right · Deposit" }} />
    </>
  );
}
