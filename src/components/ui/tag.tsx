import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TagTone = "accent" | "accent-2" | "neutral" | "outline" | "solid" | "sage-solid";

export function Tag({ tone = "neutral", className, children }: { tone?: TagTone; className?: string; children: ReactNode }) {
  return <span className={cn("tag", `tag-${tone}`, className)}>{children}</span>;
}
