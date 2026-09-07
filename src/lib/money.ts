/** All amounts are integer cents in the given currency. */

export function formatMoney(cents: number, opts: { currency?: string; cents?: boolean } = {}): string {
  const { currency = "USD", cents: showCents } = opts;
  const value = cents / 100;
  const wantsCents = showCents ?? cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: wantsCents ? 2 : 0,
    maximumFractionDigits: wantsCents ? 2 : 0,
  }).format(value);
}

export type DepositMode = "percent" | "flat";

/** Deposit is computed from the package price — never entered by hand. */
export function computeDepositCents(priceCents: number, mode: DepositMode, value: number): number {
  if (mode === "flat") return Math.min(Math.max(0, Math.round(value)), priceCents);
  const pct = Math.min(Math.max(0, value), 100);
  return Math.round((priceCents * pct) / 100);
}

/** Parse a Postgres `date` (YYYY-MM-DD) as a local calendar day, not UTC midnight. */
export function parseDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

export function formatDate(date: Date | string | null | undefined, style: "short" | "long" | "full" = "short"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseDateOnly(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  if (style === "short") return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
  if (style === "long")
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}
