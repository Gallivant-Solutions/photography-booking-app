"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "./button";

export function PrintButton({ children = "Print / save as PDF" }: { children?: React.ReactNode }) {
  return (
    <button type="button" className={buttonClass({ variant: "secondary" })} onClick={() => window.print()}>
      <Printer size={16} strokeWidth={2.75} />
      {children}
    </button>
  );
}
