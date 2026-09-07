"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "./button";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<"button">, "children"> & {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "inverse" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
};

export function SubmitButton({ children, pendingText, variant, size, block, className, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || rest.disabled}
      className={buttonClass({ variant, size, block, className })}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 size={16} strokeWidth={2.75} className="animate-spin" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
