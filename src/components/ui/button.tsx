import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "danger";
type Size = "sm" | "md" | "lg";

type Common = { variant?: Variant; size?: Size; block?: boolean; children: ReactNode; className?: string };
type AsButton = Common & Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type AsLink = Common & Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: string };

export function buttonClass({ variant = "primary", size = "md", block, className }: Omit<Common, "children">) {
  return cn(
    "btn",
    variant === "primary" && "btn-primary",
    variant === "secondary" && "btn-secondary",
    variant === "ghost" && "btn-ghost",
    variant === "inverse" && "btn-inverse",
    variant === "danger" && "btn-danger",
    size === "sm" && "btn-sm",
    size === "lg" && "btn-lg",
    block && "btn-block",
    className,
  );
}

export function Button(props: AsButton | AsLink) {
  const { variant, size, block, className, children, ...rest } = props;
  const cls = buttonClass({ variant, size, block, className });
  if ("href" in rest && typeof rest.href === "string") {
    return (
      <Link {...(rest as AsLink)} className={cls}>
        {children}
      </Link>
    );
  }
  const b = rest as AsButton;
  return (
    <button type={b.type ?? "button"} {...b} className={cls}>
      {children}
    </button>
  );
}
