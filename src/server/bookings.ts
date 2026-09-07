import "server-only";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { TenantTx } from "@/db/client";
import { bookings, ledgerEntries, type Booking, type LedgerEntry } from "@/db/schema";
import { NEEDS_YOU, OPEN_BALANCE, UNFINISHED, summarize, type MoneySummary } from "./ledger";

/** The photographer's read side. */

export type BookingFilter = "all" | "needs_you" | "balance" | "unfinished";

export interface BookingRow extends Booking {
  money: MoneySummary;
}

export async function listBookings(tx: TenantTx, tenantId: string, filter: BookingFilter): Promise<BookingRow[]> {
  const where = [eq(bookings.tenantId, tenantId)];
  if (filter === "needs_you") where.push(inArray(bookings.status, NEEDS_YOU));
  if (filter === "balance") where.push(inArray(bookings.status, OPEN_BALANCE));
  if (filter === "unfinished") where.push(inArray(bookings.status, UNFINISHED));

  const rows = await tx
    .select()
    .from(bookings)
    .where(and(...where))
    .orderBy(desc(bookings.lastActivityAt))
    .limit(200);
  if (rows.length === 0) return [];

  const entries = await tx
    .select()
    .from(ledgerEntries)
    .where(
      inArray(
        ledgerEntries.bookingId,
        rows.map((r) => r.id),
      ),
    );
  const byBooking = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const list = byBooking.get(e.bookingId) ?? [];
    list.push(e);
    byBooking.set(e.bookingId, list);
  }
  return rows.map((b) => ({ ...b, money: summarize(b, byBooking.get(b.id) ?? []) }));
}

export async function getBooking(tx: TenantTx, bookingId: string): Promise<{ booking: Booking; entries: LedgerEntry[]; money: MoneySummary } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return null;
  const entries = await tx
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.bookingId, bookingId))
    .orderBy(ledgerEntries.occurredAt);
  return { booking, entries, money: summarize(booking, entries) };
}

export interface DashboardStats {
  needsYou: number;
  confirmed: number;
  collectedThisMonthCents: number;
  lastPayout: { netCents: number; occurredAt: Date; methodLabel: string | null } | null;
}

export async function dashboardStats(tx: TenantTx, tenantId: string): Promise<DashboardStats> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [counts] = await tx
    .select({
      needsYou: sql<number>`count(*) filter (where ${bookings.status} in ('payment_failed','awaiting_deposit'))`.mapWith(Number),
      confirmed: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed')`.mapWith(Number),
    })
    .from(bookings)
    .where(eq(bookings.tenantId, tenantId));

  const [month] = await tx
    .select({
      collected: sql<number>`coalesce(sum(case when ${ledgerEntries.type} in ('charge','refund','adjustment') then ${ledgerEntries.amountCents} else 0 end), 0)`.mapWith(Number),
    })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), gte(ledgerEntries.occurredAt, monthStart)));

  const [payout] = await tx
    .select({ netCents: ledgerEntries.netCents, occurredAt: ledgerEntries.occurredAt, methodLabel: ledgerEntries.methodLabel })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.tenantId, tenantId), eq(ledgerEntries.type, "payout")))
    .orderBy(desc(ledgerEntries.occurredAt))
    .limit(1);

  return {
    needsYou: counts?.needsYou ?? 0,
    confirmed: counts?.confirmed ?? 0,
    collectedThisMonthCents: month?.collected ?? 0,
    lastPayout: payout ?? null,
  };
}

/** Idempotent ledger write keyed on the Stripe object id. */
export async function recordLedgerEntry(
  tx: TenantTx,
  entry: {
    tenantId: string;
    bookingId: string;
    type: LedgerEntry["type"];
    amountCents: number;
    feeCents?: number;
    netCents: number;
    currency: string;
    stripeObjectId: string | null;
    methodLabel?: string | null;
    note?: string | null;
    occurredAt?: Date;
  },
): Promise<LedgerEntry | null> {
  const [row] = await tx
    .insert(ledgerEntries)
    .values({
      tenantId: entry.tenantId,
      bookingId: entry.bookingId,
      type: entry.type,
      amountCents: entry.amountCents,
      feeCents: entry.feeCents ?? 0,
      netCents: entry.netCents,
      currency: entry.currency,
      stripeObjectId: entry.stripeObjectId,
      methodLabel: entry.methodLabel ?? null,
      note: entry.note ?? null,
      occurredAt: entry.occurredAt ?? new Date(),
    })
    .onConflictDoNothing({ target: ledgerEntries.stripeObjectId })
    .returning();
  return row ?? null;
}

export async function setBookingStatus(
  tx: TenantTx,
  bookingId: string,
  status: Booking["status"],
  extra: Partial<Pick<Booking, "lastPaymentError" | "cancelledAt" | "refundOverrideNote" | "stripeCustomerId">> = {},
) {
  await tx
    .update(bookings)
    .set({ status, ...extra, updatedAt: new Date(), lastActivityAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function findBookingByPaymentIntent(tx: TenantTx, paymentIntentId: string): Promise<Booking | null> {
  const [b] = await tx.select().from(bookings).where(eq(bookings.stripePaymentIntentId, paymentIntentId)).limit(1);
  return b ?? null;
}
