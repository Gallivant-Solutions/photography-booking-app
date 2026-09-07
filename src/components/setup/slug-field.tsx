"use client";

import { useEffect, useMemo, useState } from "react";
import { isValidSlug } from "@/lib/tenant-host";
import { cn } from "@/lib/utils";

type Status = "idle" | "checking" | "available" | "taken" | "invalid" | "current";
type Remote = { slug: string; available: boolean; valid: boolean };

/** Subdomain input with live availability from /api/tenants/slug. */
export function SlugField({
  value,
  onChange,
  rootDomain,
  currentSlug,
  label = "Your link",
}: {
  value: string;
  onChange: (v: string) => void;
  rootDomain: string;
  currentSlug?: string;
  label?: string;
}) {
  const slug = value.trim().toLowerCase();
  const [remote, setRemote] = useState<Remote | null>(null);

  // Everything knowable without the network is derived, not stored.
  const local: Status | "check" = useMemo(() => {
    if (!slug) return "idle";
    if (currentSlug && slug === currentSlug) return "current";
    if (!isValidSlug(slug)) return "invalid";
    return "check";
  }, [slug, currentSlug]);

  useEffect(() => {
    if (local !== "check") return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tenants/slug?slug=${encodeURIComponent(slug)}`, { signal: ctl.signal });
        const j = (await r.json()) as { ok: boolean; data?: { available: boolean; valid: boolean } };
        if (j.ok && j.data) setRemote({ slug, available: j.data.available, valid: j.data.valid });
      } catch {
        /* aborted or offline — stay in "checking" */
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [local, slug]);

  const status: Status =
    local !== "check" ? local : remote?.slug === slug ? (!remote.valid ? "invalid" : remote.available ? "available" : "taken") : "checking";

  const badge: Record<Status, { text: string; cls: string } | null> = {
    idle: null,
    checking: { text: "Checking…", cls: "bg-neutral-200 text-neutral-700" },
    available: { text: "Available", cls: "bg-accent-2-200 text-accent-2-800" },
    current: { text: "Yours", cls: "bg-accent-2-200 text-accent-2-800" },
    taken: { text: "Taken", cls: "bg-accent-100 text-accent-800" },
    invalid: { text: "Letters, numbers, dashes", cls: "bg-accent-100 text-accent-800" },
  };
  const b = badge[status];
  const host = rootDomain.split(":")[0];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="slug" className="text-[13px] font-semibold text-neutral-700">{label}</label>
      <div className="flex items-center overflow-hidden rounded-full border-[1.5px] border-neutral-400 bg-neutral-100 focus-within:border-accent">
        <input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3.5 pl-[22px] pr-1 text-[15.5px] font-semibold text-text outline-none"
          placeholder="marin"
          aria-describedby="slug-status"
        />
        <span className="py-3.5 text-[15.5px] text-neutral-700">.{host}</span>
        <span className="flex-1" />
        {b ? (
          <span id="slug-status" className={cn("self-stretch px-5 py-3.5 text-[12.5px] font-semibold", b.cls)}>
            {b.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
