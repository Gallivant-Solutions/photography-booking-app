"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";

export function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass({ variant: "secondary", className })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          window.prompt("Copy your link", url);
        }
      }}
    >
      {done ? <Check size={16} strokeWidth={2.75} /> : <Copy size={16} strokeWidth={2.75} />}
      {done ? "Copied" : "Copy link"}
    </button>
  );
}
