"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/bits";
import type { Tenant } from "@/db/schema";
import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, key: "questions", label: "Questions", href: "/setup/questions" },
  { n: 2, key: "contract", label: "Contract", href: "/setup/contract" },
  { n: 3, key: "deposit", label: "Deposit", href: "/setup/deposit" },
  { n: 4, key: "link", label: "Your link", href: "/setup/link" },
] as const;

export function SetupSidebar({
  tenant,
  done,
  questionCount,
}: {
  tenant: Pick<Tenant, "name" | "publishedAt">;
  done: Record<(typeof STEPS)[number]["key"], boolean>;
  questionCount: number;
}) {
  const path = usePathname();
  return (
    <aside className="flex w-full flex-none flex-col gap-2 bg-surface px-5 py-6 lg:w-[232px] lg:px-[22px]">
      <div className="mb-3 flex items-center gap-3 lg:mb-4">
        <Avatar name={tenant.name} size={32} />
        <div className="text-[14px] font-semibold text-text">{tenant.name}</div>
      </div>
      <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-2">
        {STEPS.map((s) => {
          const active = path.startsWith(s.href);
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-none items-center justify-between gap-3 rounded-full px-[18px] py-[11px] text-[14px] whitespace-nowrap",
                active ? "bg-accent-700 font-semibold text-bg hover:text-bg" : "text-neutral-800 hover:bg-bg/60 hover:text-text",
              )}
            >
              <span>
                {s.n} · {s.label}
              </span>
              {s.key === "questions" && active ? (
                <span>{questionCount}</span>
              ) : done[s.key] ? (
                <Check size={16} strokeWidth={2.75} className={active ? "text-bg" : "text-accent-2-700"} />
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="hidden flex-1 lg:block" />
      <div className="mt-3 rounded-md bg-bg px-4 py-[15px] lg:mt-0">
        <div className="text-[13px] font-semibold text-text">{tenant.publishedAt ? "Live" : "Not published yet"}</div>
        <div className="mt-1 text-[12.5px] leading-[1.45] text-neutral-700">
          {tenant.publishedAt ? "Edits go live as you save." : "You can publish now and keep editing."}
        </div>
      </div>
    </aside>
  );
}
