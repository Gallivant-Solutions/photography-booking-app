import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function StepFooter({ previewHref, back, next }: { previewHref?: string; back?: { href: string; label: string }; next?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-divider pt-4">
      {previewHref ? (
        <Button href={previewHref} variant="secondary" target="_blank" rel="noreferrer">
          Preview as a client
        </Button>
      ) : null}
      {back ? <Button href={back.href} variant="secondary">{back.label}</Button> : null}
      <div className="flex-1" />
      {next ? <Button href={next.href}>{next.label}</Button> : null}
    </div>
  );
}

export function StepHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div>
      <h1 className="font-heading text-[30px] leading-[1.06] text-text">{title}</h1>
      {body ? <p className="mt-2 max-w-[480px] text-[15px] leading-[1.55] text-neutral-700">{body}</p> : null}
    </div>
  );
}
