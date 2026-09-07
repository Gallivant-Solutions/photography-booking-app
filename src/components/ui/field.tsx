import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-neutral-700">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="px-1 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="px-1 text-[12.5px] text-neutral-700">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn("input", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn("input", className)} />;
}

/** Inline error banner for server-action results. */
export function FormError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-accent-300 bg-accent-100 px-4 py-3 text-[13.5px] text-accent-800">
      {error}
    </div>
  );
}

export function FormSuccess({ show, children }: { show?: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <div role="status" className="rounded-md border border-accent-2-300 bg-accent-2-100 px-4 py-3 text-[13.5px] text-accent-2-800">
      {children}
    </div>
  );
}
