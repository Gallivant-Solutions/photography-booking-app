import type { ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

/** Studio mark: a terracotta circle with the first letter. */
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex flex-none items-center justify-center rounded-full bg-accent-700 font-heading text-bg", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
      aria-hidden
    >
      {initials(name).charAt(0)}
    </span>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("kicker", className)}>{children}</div>;
}

export function Heading({ children, className, size = "md" }: { children: ReactNode; className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sz = { sm: "text-[26px]", md: "text-[30px]", lg: "text-[34px]", xl: "text-[42px] sm:text-[44px]" }[size];
  return <h1 className={cn("font-heading leading-[1.06] text-text", sz, className)}>{children}</h1>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel overflow-hidden", className)}>{children}</div>;
}

export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("inset", className)}>{children}</div>;
}

export function Progress({ value, className, tone = "accent" }: { value: number; className?: string; tone?: "accent" | "sage" }) {
  return (
    <div className={cn("h-[5px] overflow-hidden rounded-full bg-neutral-300", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", tone === "accent" ? "bg-accent" : "bg-accent-2-500")} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function StepBadge({ n, active, className }: { n: number | string; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-[26px] flex-none items-center justify-center rounded-full text-[12px] font-bold",
        active ? "bg-accent-700 text-bg" : "bg-accent-2-200 text-accent-2-800",
        className,
      )}
    >
      {n}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "accent" }) {
  return (
    <div className="bg-bg px-6 py-5 sm:px-[30px]">
      <div className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-neutral-700">{label}</div>
      <div className={cn("mt-1.5 font-heading text-[32px] leading-[1.1]", tone === "accent" ? "text-accent-700" : "text-text")}>{value}</div>
      {sub ? <div className="mt-1 text-[12.5px] text-neutral-700">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10 sm:px-[30px]">
      <div className="font-heading text-[22px] text-text">{title}</div>
      {body ? <p className="max-w-[460px] text-[14.5px] text-neutral-700">{body}</p> : null}
      {action}
    </div>
  );
}

export function Blob({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("blob", className)} style={style} />;
}
