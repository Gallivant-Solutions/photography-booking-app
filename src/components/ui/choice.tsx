import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A card that is a radio. Native input, selected state drawn with :has() — no
 * client JS. Use `plain` for the lighter "leave this out" row.
 */
export function ChoiceCard({
  title,
  description,
  right,
  plain,
  className,
  children,
  ...input
}: {
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  plain?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"input">, "title" | "className" | "children">) {
  return (
    <label className={cn("choice", plain && "choice-plain", className)}>
      <input type="radio" {...input} />
      <span className="dot" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-3">
          <span className={cn("font-semibold text-text", plain ? "text-[14.5px] font-normal text-neutral-800" : "text-[15.5px]")}>{title}</span>
          {right ? <span className="font-heading text-[19px] text-text">{right}</span> : null}
        </span>
        {description ? <span className="mt-1 text-[13.5px] leading-[1.55] text-neutral-700">{description}</span> : null}
        {children}
      </span>
    </label>
  );
}

/** Pill chip that is a radio (shoot type). */
export function ChipRadio({ label, className, ...input }: { label: ReactNode; className?: string } & Omit<ComponentProps<"input">, "className">) {
  return (
    <label className={cn("chip", className)}>
      <input type="radio" {...input} />
      {label}
    </label>
  );
}

/** Segmented control on native radios. */
export function Seg({
  name,
  options,
  defaultValue,
  className,
}: {
  name: string;
  options: Array<{ value: string; label: ReactNode }>;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={cn("seg", className)} role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className="seg-opt">
          <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
