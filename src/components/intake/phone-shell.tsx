import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/bits";
import { cn } from "@/lib/utils";

/**
 * Mobile-first frame for the client flow. Full-bleed on phones; on larger
 * screens it becomes the rounded 390px card from the design so the preview
 * from the dashboard looks like what the client sees.
 */
export function PhoneShell({ children, host, dark }: { children: ReactNode; host: string; dark?: boolean }) {
  return (
    <div className={cn("flex flex-1 flex-col sm:items-center sm:justify-center sm:p-6", dark ? "sm:bg-neutral-200" : "")}>
      <div
        className={cn(
          "relative flex w-full flex-1 flex-col overflow-hidden sm:min-h-[816px] sm:max-w-[390px] sm:flex-none sm:rounded-phone sm:shadow-lg",
          dark ? "bg-accent-2-800" : "bg-bg",
        )}
      >
        <div className={cn("hidden h-[52px] items-center justify-between px-[30px] text-[12px] font-semibold sm:flex", dark ? "text-accent-2-300" : "text-neutral-700")}>
          <span>{new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/ [AP]M/, "")}</span>
          <span>{host}</span>
        </div>
        <div className={cn("flex flex-1 flex-col px-6 pt-4 sm:px-[30px] sm:pt-1.5", "pb-[max(24px,env(safe-area-inset-bottom))] sm:pb-[34px]")}>{children}</div>
      </div>
    </div>
  );
}

export function StepHeader({ backHref, progress, label }: { backHref?: string; progress: number; label: string }) {
  return (
    <div className="flex items-center gap-3.5">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className="-ml-1 rounded-full p-1 text-neutral-700 hover:bg-neutral-300/60 hover:text-text">
          <ArrowLeft size={20} strokeWidth={2.75} />
        </Link>
      ) : (
        <span className="w-6" />
      )}
      <Progress value={progress} className="flex-1" />
      <span className="text-[12.5px] font-semibold text-neutral-700">{label}</span>
    </div>
  );
}

export function ScreenTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("font-heading text-[32px] leading-[1.08] text-text sm:text-[34px]", className)}>{children}</h1>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-neutral-700">{children}</div>;
}
