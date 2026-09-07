import type { Booking, BookingStatus, LedgerEntry } from "@/db/schema";

/**
 * Money math lives here and nowhere else. The ledger is the booking's spine:
 * what's collected, refunded and owed is summed from entries, never typed.
 */
export interface MoneySummary {
  contractTotalCents: number;
  collectedCents: number; // gross charges
  refundedCents: number; // positive number
  feeCents: number;
  netCents: number; // what actually reached the photographer (charges - refunds - fees)
  balanceCents: number; // still owed by the client
  paidOutCents: number;
  collectedPct: number; // 0–100 of contract total, net of refunds
}

export function summarize(booking: Pick<Booking, "packagePriceCents">, entries: LedgerEntry[]): MoneySummary {
  const total = booking.packagePriceCents ?? 0;
  let collected = 0;
  let refunded = 0;
  let fees = 0;
  let paidOut = 0;
  for (const e of entries) {
    if (e.type === "charge") {
      collected += e.amountCents;
      fees += e.feeCents;
    } else if (e.type === "refund") {
      refunded += Math.abs(e.amountCents);
    } else if (e.type === "payout") {
      paidOut += Math.abs(e.netCents);
    } else if (e.type === "adjustment") {
      collected += e.amountCents;
    }
  }
  const netCollected = collected - refunded;
  return {
    contractTotalCents: total,
    collectedCents: collected,
    refundedCents: refunded,
    feeCents: fees,
    netCents: netCollected - fees,
    balanceCents: Math.max(0, total - netCollected),
    paidOutCents: paidOut,
    collectedPct: total > 0 ? Math.round((Math.max(0, netCollected) / total) * 100) : 0,
  };
}

/** Human status label + tone used by the dashboard tags. */
export function statusPresentation(status: BookingStatus, booking?: Pick<Booking, "currentStep" | "lastActivityAt">) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", tone: "accent-2" as const };
    case "payment_failed":
      return { label: "Card declined", tone: "accent" as const };
    case "awaiting_deposit":
      return { label: "Signed · deposit due", tone: "accent" as const };
    case "awaiting_signature":
      return { label: "Answers in · unsigned", tone: "outline" as const };
    case "in_progress":
      return { label: booking ? `Unfinished · step ${booking.currentStep}` : "Unfinished", tone: "outline" as const };
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" as const };
    case "refunded":
      return { label: "Refunded", tone: "neutral" as const };
  }
}

/** Anything the photographer should look at. */
export const NEEDS_YOU: BookingStatus[] = ["payment_failed", "awaiting_deposit"];
export const OPEN_BALANCE: BookingStatus[] = ["confirmed", "payment_failed", "awaiting_deposit"];
export const UNFINISHED: BookingStatus[] = ["in_progress", "awaiting_signature"];
